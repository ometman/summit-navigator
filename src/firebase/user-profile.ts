'use client';

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import { type Auth } from 'firebase/auth';
import type { RegistrationTrack } from '@/lib/registrations';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  auth: Auth | null,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface SaveUserProfileInput {
  uid: string;
  fullName: string;
  email: string;
  organization: string;
  role: string;
  track: RegistrationTrack;
  mfaVerifiedAt: string;
}

export interface VerifiedUserProfile {
  uid: string;
  fullName: string;
  email: string;
  organization: string;
  role: string;
  track: RegistrationTrack;
  mfaMethod: string;
  mfaVerifiedAt: string;
}

export async function getVerifiedUserProfile(
  firestore: Firestore,
  auth: Auth | null,
  uid: string
): Promise<VerifiedUserProfile | null> {
  const path = `users/${uid}`;
  const ref = doc(firestore, 'users', uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as VerifiedUserProfile;
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.GET, path);
  }
}

const VALID_ROLES = [
  'Senior Pastor',
  'Ministry Lead',
  'Operations & Strategy',
  'Youth & Outreach',
  'Volunteer Coordinator',
];

const VALID_TRACKS: RegistrationTrack[] = [
  'Morning & Afternoon',
  'Morning Track',
  'Afternoon Track',
];

export async function saveVerifiedUserProfile(
  firestore: Firestore,
  auth: Auth | null,
  input: SaveUserProfileInput
): Promise<void> {
  const path = `users/${input.uid}`;
  const ref = doc(firestore, 'users', input.uid);

  const trimmedName = input.fullName.trim();
  const sanitizedFullName = (
    trimmedName.length >= 2 ? trimmedName : 'Summit Attendee'
  ).slice(0, 120);
  const sanitizedOrg = (input.organization.trim() || 'Summit Attendee').slice(0, 150);
  const role = VALID_ROLES.includes(input.role) ? input.role : 'Ministry Lead';
  const track = VALID_TRACKS.includes(input.track)
    ? input.track
    : 'Morning & Afternoon';

  let existingSnap;
  try {
    existingSnap = await getDoc(ref);
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.GET, path);
  }

  try {
    if (existingSnap && existingSnap.exists()) {
      await setDoc(
        ref,
        {
          fullName: sanitizedFullName,
          organization: sanitizedOrg,
          role,
          track,
          mfaVerifiedAt: input.mfaVerifiedAt,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } else {
      await setDoc(ref, {
        uid: input.uid,
        fullName: sanitizedFullName,
        email: input.email.trim().slice(0, 254),
        organization: sanitizedOrg,
        role,
        track,
        mfaMethod: 'email_otp',
        mfaVerifiedAt: input.mfaVerifiedAt,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.WRITE, path);
  }
}
