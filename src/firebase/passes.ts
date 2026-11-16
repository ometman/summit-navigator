'use client';

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { type Auth } from 'firebase/auth';
import { handleFirestoreError, OperationType } from '@/firebase/user-profile';
import { ID_PATTERN } from '@/firebase/qa';
import {
  VALID_PASS_ROLES,
  VALID_PASS_TRACKS,
  type PassCheckInMethod,
  type PassStatus,
  type SignedPassPayload,
} from '@/lib/pass-types';
import type { RegistrationTrack } from '@/lib/registrations';

export interface AttendeePassRecord {
  uid: string;
  passCode: string;
  fullName: string;
  email: string;
  organization: string;
  role: string;
  track: RegistrationTrack;
  status: PassStatus;
  checkInMethod: PassCheckInMethod;
  checkedInBy: string;
  checkedInAt: string;
  mfaVerifiedAt: string;
  qrSignatureDigest: string;
  createdAtMs: number;
  updatedAtMs: number;
}

function timestampToMs(value: unknown): number {
  if (value instanceof Timestamp) {
    return value.toMillis();
  }
  if (
    value &&
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof (value as { toMillis: () => number }).toMillis === 'function'
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

function mapDocToPassRecord(
  id: string,
  data: Record<string, unknown>
): AttendeePassRecord {
  return {
    uid: String(data.uid ?? id),
    passCode: String(data.passCode ?? ''),
    fullName: String(data.fullName ?? 'Summit Attendee'),
    email: String(data.email ?? ''),
    organization: String(data.organization ?? 'Summit Attendee'),
    role: String(data.role ?? 'Ministry Lead'),
    track: (VALID_PASS_TRACKS.includes(data.track as RegistrationTrack)
      ? data.track
      : 'Morning & Afternoon') as RegistrationTrack,
    status: data.status === 'Checked In' ? 'Checked In' : 'Confirmed',
    checkInMethod:
      data.checkInMethod === 'self_checkin' ||
      data.checkInMethod === 'organizer_scan'
        ? data.checkInMethod
        : 'none',
    checkedInBy: String(data.checkedInBy ?? ''),
    checkedInAt: String(data.checkedInAt ?? ''),
    mfaVerifiedAt: String(data.mfaVerifiedAt ?? ''),
    qrSignatureDigest: String(data.qrSignatureDigest ?? ''),
    createdAtMs: timestampToMs(data.createdAt),
    updatedAtMs: timestampToMs(data.updatedAt),
  };
}

function buildPassError(
  error: unknown,
  auth: Auth | null,
  operationType: OperationType,
  path: string
): Error {
  const errInfo = {
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
  const serialized = JSON.stringify(errInfo);
  console.error('Firestore Error: ', serialized);
  return new Error(serialized);
}

function sanitizePassFields(input: {
  fullName: string;
  organization: string;
  role: string;
  track: RegistrationTrack;
  mfaVerifiedAt: string;
  qrSignatureDigest: string;
}) {
  const trimmedName = input.fullName.trim();
  const fullName = (
    trimmedName.length >= 2 ? trimmedName : 'Summit Attendee'
  ).slice(0, 120);
  const organization = (input.organization.trim() || 'Summit Attendee').slice(
    0,
    150
  );
  const role = (VALID_PASS_ROLES as readonly string[]).includes(input.role)
    ? input.role
    : 'Ministry Lead';
  const track = VALID_PASS_TRACKS.includes(input.track)
    ? input.track
    : 'Morning & Afternoon';
  const mfaVerifiedAt =
    input.mfaVerifiedAt.length >= 10
      ? input.mfaVerifiedAt.slice(0, 64)
      : new Date().toISOString();
  const qrSignatureDigest = input.qrSignatureDigest
    .toLowerCase()
    .replace(/[^a-f0-9]/g, '')
    .slice(0, 64);

  return {
    fullName,
    organization,
    role,
    track,
    mfaVerifiedAt,
    qrSignatureDigest:
      qrSignatureDigest.length >= 8 ? qrSignatureDigest : '00000000',
  };
}

export async function ensureAttendeePassDocument(
  firestore: Firestore,
  auth: Auth | null,
  input: {
    uid: string;
    passCode: string;
    email: string;
    fullName: string;
    organization: string;
    role: string;
    track: RegistrationTrack;
    mfaVerifiedAt: string;
    qrSignatureDigest: string;
  }
): Promise<void> {
  if (!ID_PATTERN.test(input.uid)) {
    throw new Error('Invalid user UID.');
  }

  const path = `attendeePasses/${input.uid}`;
  const ref = doc(firestore, 'attendeePasses', input.uid);
  const clean = sanitizePassFields(input);

  let existingSnap;
  try {
    existingSnap = await getDoc(ref);
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.GET, path);
  }

  try {
    if (existingSnap && existingSnap.exists()) {
      const current = existingSnap.data();
      const unchanged =
        current.fullName === clean.fullName &&
        current.organization === clean.organization &&
        current.role === clean.role &&
        current.track === clean.track &&
        current.mfaVerifiedAt === clean.mfaVerifiedAt &&
        current.qrSignatureDigest === clean.qrSignatureDigest;

      if (unchanged) return;

      await updateDoc(ref, {
        fullName: clean.fullName,
        organization: clean.organization,
        role: clean.role,
        track: clean.track,
        mfaVerifiedAt: clean.mfaVerifiedAt,
        qrSignatureDigest: clean.qrSignatureDigest,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        uid: input.uid,
        passCode: input.passCode.toUpperCase().replace(/[^A-Z0-9\-]/g, '').slice(0, 32),
        email: input.email.trim().slice(0, 254),
        fullName: clean.fullName,
        organization: clean.organization,
        role: clean.role,
        track: clean.track,
        status: 'Confirmed',
        checkInMethod: 'none',
        checkedInBy: '',
        checkedInAt: '',
        mfaVerifiedAt: clean.mfaVerifiedAt,
        qrSignatureDigest: clean.qrSignatureDigest,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.WRITE, path);
  }
}

export function subscribeToAttendeePass(
  firestore: Firestore,
  auth: Auth | null,
  uid: string,
  onData: (pass: AttendeePassRecord | null) => void,
  onError: (err: Error) => void
): Unsubscribe {
  if (!uid || !ID_PATTERN.test(uid)) {
    onData(null);
    return () => {};
  }

  const path = `attendeePasses/${uid}`;
  return onSnapshot(
    doc(firestore, 'attendeePasses', uid),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }
      onData(
        mapDocToPassRecord(
          snapshot.id,
          snapshot.data() as Record<string, unknown>
        )
      );
    },
    (error) => {
      onError(buildPassError(error, auth, OperationType.GET, path));
    }
  );
}

export function subscribeToAllAttendeePasses(
  firestore: Firestore,
  auth: Auth | null,
  onData: (passes: AttendeePassRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'attendeePasses';
  const passesQuery = query(
    collection(firestore, 'attendeePasses'),
    where('status', 'in', ['Confirmed', 'Checked In'])
  );
  return onSnapshot(
    passesQuery,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) =>
        mapDocToPassRecord(
          docSnap.id,
          docSnap.data() as Record<string, unknown>
        )
      );
      items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onData(items);
    },
    (error) => {
      onError(buildPassError(error, auth, OperationType.LIST, path));
    }
  );
}

export async function confirmSelfCheckIn(
  firestore: Firestore,
  auth: Auth | null,
  uid: string
): Promise<string> {
  if (!ID_PATTERN.test(uid)) {
    throw new Error('Invalid attendee UID.');
  }

  const checkedInAt = new Date().toISOString();
  const path = `attendeePasses/${uid}`;
  try {
    await updateDoc(doc(firestore, 'attendeePasses', uid), {
      status: 'Checked In',
      checkInMethod: 'self_checkin',
      checkedInBy: uid,
      checkedInAt,
      updatedAt: serverTimestamp(),
    });
    return checkedInAt;
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.UPDATE, path);
  }
}

export async function checkInPassByOrganizer(
  firestore: Firestore,
  auth: Auth | null,
  params: {
    payload: SignedPassPayload;
    signatureDigest: string;
    organizerUid: string;
  }
): Promise<{
  alreadyCheckedIn: boolean;
  record: AttendeePassRecord;
}> {
  const { payload, signatureDigest, organizerUid } = params;
  if (!ID_PATTERN.test(payload.uid) || !ID_PATTERN.test(organizerUid)) {
    throw new Error('Invalid attendee or organizer UID.');
  }

  const path = `attendeePasses/${payload.uid}`;
  const ref = doc(firestore, 'attendeePasses', payload.uid);

  let existingSnap;
  try {
    existingSnap = await getDoc(ref);
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.GET, path);
  }

  if (existingSnap && existingSnap.exists()) {
    const record = mapDocToPassRecord(
      existingSnap.id,
      existingSnap.data() as Record<string, unknown>
    );
    if (record.status === 'Checked In') {
      return { alreadyCheckedIn: true, record };
    }

    const checkedInAt = new Date().toISOString();
    try {
      await updateDoc(ref, {
        status: 'Checked In',
        checkInMethod: 'organizer_scan',
        checkedInBy: organizerUid,
        checkedInAt,
        updatedAt: serverTimestamp(),
      });
      return {
        alreadyCheckedIn: false,
        record: {
          ...record,
          status: 'Checked In',
          checkInMethod: 'organizer_scan',
          checkedInBy: organizerUid,
          checkedInAt,
          updatedAtMs: Date.now(),
        },
      };
    } catch (error) {
      handleFirestoreError(error, auth, OperationType.UPDATE, path);
    }
  } else {
    const clean = sanitizePassFields({
      fullName: payload.fullName,
      organization: payload.organization,
      role: payload.role,
      track: payload.track,
      mfaVerifiedAt: payload.mfaVerifiedAt,
      qrSignatureDigest: signatureDigest,
    });
    const checkedInAt = new Date().toISOString();

    try {
      await setDoc(ref, {
        uid: payload.uid,
        passCode: payload.passCode.toUpperCase().replace(/[^A-Z0-9\-]/g, '').slice(0, 32),
        email: payload.email.trim().slice(0, 254),
        fullName: clean.fullName,
        organization: clean.organization,
        role: clean.role,
        track: clean.track,
        status: 'Checked In',
        checkInMethod: 'organizer_scan',
        checkedInBy: organizerUid,
        checkedInAt,
        mfaVerifiedAt: clean.mfaVerifiedAt,
        qrSignatureDigest: clean.qrSignatureDigest,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return {
        alreadyCheckedIn: false,
        record: {
          uid: payload.uid,
          passCode: payload.passCode,
          email: payload.email,
          fullName: clean.fullName,
          organization: clean.organization,
          role: clean.role,
          track: clean.track,
          status: 'Checked In',
          checkInMethod: 'organizer_scan',
          checkedInBy: organizerUid,
          checkedInAt,
          mfaVerifiedAt: clean.mfaVerifiedAt,
          qrSignatureDigest: clean.qrSignatureDigest,
          createdAtMs: Date.now(),
          updatedAtMs: Date.now(),
        },
      };
    } catch (error) {
      handleFirestoreError(error, auth, OperationType.CREATE, path);
    }
  }
}

export async function revertPassCheckInByOrganizer(
  firestore: Firestore,
  auth: Auth | null,
  targetUid: string
): Promise<void> {
  if (!ID_PATTERN.test(targetUid)) {
    throw new Error('Invalid attendee UID.');
  }
  const path = `attendeePasses/${targetUid}`;
  try {
    await updateDoc(doc(firestore, 'attendeePasses', targetUid), {
      status: 'Confirmed',
      checkInMethod: 'none',
      checkedInBy: '',
      checkedInAt: '',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.UPDATE, path);
  }
}
