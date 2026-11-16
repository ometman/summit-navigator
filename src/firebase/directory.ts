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
import type { RegistrationTrack } from '@/lib/registrations';

export const DIRECTORY_ROLES = [
  'Senior Pastor',
  'Ministry Lead',
  'Operations & Strategy',
  'Youth & Outreach',
  'Volunteer Coordinator',
] as const;

export const DIRECTORY_TRACKS: RegistrationTrack[] = [
  'Morning & Afternoon',
  'Morning Track',
  'Afternoon Track',
];

export const DIRECTORY_BIO_MAX_LENGTH = 280;
export const DIRECTORY_TOPIC_MAX_LENGTH = 40;
export const DIRECTORY_MAX_TOPICS = 5;
export const CONNECTION_MESSAGE_MIN_LENGTH = 3;
export const CONNECTION_MESSAGE_MAX_LENGTH = 300;

export type DirectoryMemberType = 'attendee' | 'speaker';
export type ConnectionStatus = 'pending' | 'accepted' | 'declined';

export interface DirectoryProfileRecord {
  uid: string;
  fullName: string;
  organization: string;
  role: string;
  track: RegistrationTrack;
  memberType: DirectoryMemberType;
  bio: string;
  focusTopics: string[];
  optedIn: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface DirectoryConnectionRecord {
  id: string;
  senderUid: string;
  senderName: string;
  senderOrg: string;
  senderRole: string;
  recipientUid: string;
  recipientName: string;
  recipientOrg: string;
  recipientRole: string;
  message: string;
  replyNote: string;
  status: ConnectionStatus;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface UserConnectionsState {
  sent: DirectoryConnectionRecord[];
  received: DirectoryConnectionRecord[];
  byPeerUid: Map<string, DirectoryConnectionRecord>;
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

function buildContextualError(
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

function sanitizeRole(role: string): string {
  return (DIRECTORY_ROLES as readonly string[]).includes(role)
    ? role
    : 'Ministry Lead';
}

function sanitizeTrack(track: string): RegistrationTrack {
  return DIRECTORY_TRACKS.includes(track as RegistrationTrack)
    ? (track as RegistrationTrack)
    : 'Morning & Afternoon';
}

export function parseFocusTopicsInput(raw: string): string[] {
  const unique = new Set<string>();
  for (const part of raw.split(',')) {
    const clean = part.trim().slice(0, DIRECTORY_TOPIC_MAX_LENGTH);
    if (clean.length >= 1) {
      unique.add(clean);
    }
    if (unique.size >= DIRECTORY_MAX_TOPICS) break;
  }
  return Array.from(unique);
}

function parseDirectoryProfile(
  docId: string,
  data: Record<string, unknown>
): DirectoryProfileRecord {
  const rawTopics = Array.isArray(data.focusTopics)
    ? data.focusTopics
        .map((item) => String(item ?? '').trim().slice(0, DIRECTORY_TOPIC_MAX_LENGTH))
        .filter((item) => item.length >= 1)
        .slice(0, DIRECTORY_MAX_TOPICS)
    : [];

  return {
    uid: String(data.uid ?? docId),
    fullName: String(data.fullName ?? 'Summit Leader'),
    organization: String(data.organization ?? 'Summit Participant'),
    role: sanitizeRole(String(data.role ?? 'Ministry Lead')),
    track: sanitizeTrack(String(data.track ?? 'Morning & Afternoon')),
    memberType: data.memberType === 'speaker' ? 'speaker' : 'attendee',
    bio: String(data.bio ?? '').slice(0, DIRECTORY_BIO_MAX_LENGTH),
    focusTopics: rawTopics,
    optedIn: Boolean(data.optedIn),
    createdAtMs: timestampToMs(data.createdAt),
    updatedAtMs: timestampToMs(data.updatedAt),
  };
}

function parseDirectoryConnection(
  docId: string,
  data: Record<string, unknown>
): DirectoryConnectionRecord {
  const status: ConnectionStatus =
    data.status === 'accepted'
      ? 'accepted'
      : data.status === 'declined'
        ? 'declined'
        : 'pending';

  return {
    id: String(data.id ?? docId),
    senderUid: String(data.senderUid ?? ''),
    senderName: String(data.senderName ?? 'Summit Leader'),
    senderOrg: String(data.senderOrg ?? 'Summit Participant'),
    senderRole: sanitizeRole(String(data.senderRole ?? 'Ministry Lead')),
    recipientUid: String(data.recipientUid ?? ''),
    recipientName: String(data.recipientName ?? 'Summit Leader'),
    recipientOrg: String(data.recipientOrg ?? 'Summit Participant'),
    recipientRole: sanitizeRole(String(data.recipientRole ?? 'Ministry Lead')),
    message: String(data.message ?? ''),
    replyNote: String(data.replyNote ?? ''),
    status,
    createdAtMs: timestampToMs(data.createdAt),
    updatedAtMs: timestampToMs(data.updatedAt),
  };
}

export function subscribeToOptedInDirectory(
  firestore: Firestore,
  auth: Auth | null,
  onData: (profiles: DirectoryProfileRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'directoryProfiles';
  const dirQuery = query(
    collection(firestore, 'directoryProfiles'),
    where('optedIn', '==', true)
  );

  return onSnapshot(
    dirQuery,
    (snapshot) => {
      const profiles = snapshot.docs.map((docSnap) =>
        parseDirectoryProfile(
          docSnap.id,
          docSnap.data() as Record<string, unknown>
        )
      );
      profiles.sort((a, b) => {
        if (a.memberType !== b.memberType) {
          return a.memberType === 'speaker' ? -1 : 1;
        }
        return b.updatedAtMs - a.updatedAtMs;
      });
      onData(profiles);
    },
    (error) => {
      onError(buildContextualError(error, auth, OperationType.LIST, path));
    }
  );
}

export function subscribeToOwnDirectoryProfile(
  firestore: Firestore,
  auth: Auth | null,
  uid: string,
  onData: (profile: DirectoryProfileRecord | null) => void,
  onError: (err: Error) => void
): Unsubscribe {
  if (!uid || !ID_PATTERN.test(uid)) {
    onData(null);
    return () => {};
  }

  const path = `directoryProfiles/${uid}`;
  return onSnapshot(
    doc(firestore, 'directoryProfiles', uid),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }
      onData(
        parseDirectoryProfile(
          snapshot.id,
          snapshot.data() as Record<string, unknown>
        )
      );
    },
    (error) => {
      onError(buildContextualError(error, auth, OperationType.GET, path));
    }
  );
}

export interface UpsertDirectoryProfileInput {
  uid: string;
  fullName: string;
  organization: string;
  role: string;
  track: RegistrationTrack;
  memberType: DirectoryMemberType;
  bio: string;
  focusTopics: string[];
  optedIn: boolean;
}

export async function upsertDirectoryProfile(
  firestore: Firestore,
  auth: Auth | null,
  input: UpsertDirectoryProfileInput
): Promise<void> {
  if (!ID_PATTERN.test(input.uid)) {
    throw new Error('Invalid user UID.');
  }

  const trimmedName = input.fullName.trim();
  const fullName = (
    trimmedName.length >= 2 ? trimmedName : 'Summit Leader'
  ).slice(0, 120);
  const organization = (input.organization.trim() || 'Summit Attendee').slice(
    0,
    150
  );
  const role = sanitizeRole(input.role);
  const track = sanitizeTrack(input.track);
  const memberType: DirectoryMemberType =
    input.memberType === 'speaker' ? 'speaker' : 'attendee';
  const bio = input.bio.trim().slice(0, DIRECTORY_BIO_MAX_LENGTH);
  const focusTopics = input.focusTopics
    .map((topic) => topic.trim().slice(0, DIRECTORY_TOPIC_MAX_LENGTH))
    .filter((topic) => topic.length >= 1)
    .slice(0, DIRECTORY_MAX_TOPICS);

  const path = `directoryProfiles/${input.uid}`;
  const ref = doc(firestore, 'directoryProfiles', input.uid);

  let existingSnap;
  try {
    existingSnap = await getDoc(ref);
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.GET, path);
  }

  try {
    if (existingSnap && existingSnap.exists()) {
      await updateDoc(ref, {
        fullName,
        organization,
        role,
        track,
        memberType,
        bio,
        focusTopics,
        optedIn: input.optedIn,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        uid: input.uid,
        fullName,
        organization,
        role,
        track,
        memberType,
        bio,
        focusTopics,
        optedIn: input.optedIn,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.WRITE, path);
  }
}

export function subscribeToUserConnections(
  firestore: Firestore,
  auth: Auth | null,
  uid: string,
  onData: (state: UserConnectionsState) => void,
  onError: (err: Error) => void
): Unsubscribe {
  if (!uid || !ID_PATTERN.test(uid)) {
    onData({ sent: [], received: [], byPeerUid: new Map() });
    return () => {};
  }

  let sentList: DirectoryConnectionRecord[] = [];
  let receivedList: DirectoryConnectionRecord[] = [];

  const emit = () => {
    const byPeerUid = new Map<string, DirectoryConnectionRecord>();
    const all = [...receivedList, ...sentList].sort(
      (a, b) => b.updatedAtMs - a.updatedAtMs
    );

    for (const item of all) {
      const peerUid =
        item.senderUid === uid ? item.recipientUid : item.senderUid;
      const existing = byPeerUid.get(peerUid);
      if (!existing || existing.status === 'declined') {
        byPeerUid.set(peerUid, item);
      } else if (item.status === 'accepted') {
        byPeerUid.set(peerUid, item);
      }
    }

    onData({
      sent: [...sentList].sort((a, b) => b.updatedAtMs - a.updatedAtMs),
      received: [...receivedList].sort((a, b) => b.updatedAtMs - a.updatedAtMs),
      byPeerUid,
    });
  };

  const path = 'directoryConnections';
  const sentQuery = query(
    collection(firestore, 'directoryConnections'),
    where('senderUid', '==', uid)
  );
  const receivedQuery = query(
    collection(firestore, 'directoryConnections'),
    where('recipientUid', '==', uid)
  );

  const unsubSent = onSnapshot(
    sentQuery,
    (snapshot) => {
      sentList = snapshot.docs.map((docSnap) =>
        parseDirectoryConnection(
          docSnap.id,
          docSnap.data() as Record<string, unknown>
        )
      );
      emit();
    },
    (error) => {
      onError(buildContextualError(error, auth, OperationType.LIST, path));
    }
  );

  const unsubReceived = onSnapshot(
    receivedQuery,
    (snapshot) => {
      receivedList = snapshot.docs.map((docSnap) =>
        parseDirectoryConnection(
          docSnap.id,
          docSnap.data() as Record<string, unknown>
        )
      );
      emit();
    },
    (error) => {
      onError(buildContextualError(error, auth, OperationType.LIST, path));
    }
  );

  return () => {
    unsubSent();
    unsubReceived();
  };
}

export async function sendDirectoryConnection(
  firestore: Firestore,
  auth: Auth | null,
  params: {
    sender: DirectoryProfileRecord;
    recipient: DirectoryProfileRecord;
    message: string;
  }
): Promise<string> {
  const { sender, recipient, message } = params;
  if (!ID_PATTERN.test(sender.uid) || !ID_PATTERN.test(recipient.uid)) {
    throw new Error('Invalid user identifiers for connection.');
  }
  if (sender.uid === recipient.uid) {
    throw new Error('You cannot connect with your own profile.');
  }

  const cleanMessage = message.trim().slice(0, CONNECTION_MESSAGE_MAX_LENGTH);
  if (cleanMessage.length < CONNECTION_MESSAGE_MIN_LENGTH) {
    throw new Error(
      `Introduction message must be at least ${CONNECTION_MESSAGE_MIN_LENGTH} characters.`
    );
  }

  const connectionId = `${sender.uid}_${recipient.uid}`;
  const path = `directoryConnections/${connectionId}`;

  try {
    await setDoc(doc(firestore, 'directoryConnections', connectionId), {
      id: connectionId,
      senderUid: sender.uid,
      senderName: sender.fullName.trim().slice(0, 120) || 'Summit Leader',
      senderOrg: sender.organization.trim().slice(0, 150) || 'Summit Attendee',
      senderRole: sanitizeRole(sender.role),
      recipientUid: recipient.uid,
      recipientName:
        recipient.fullName.trim().slice(0, 120) || 'Summit Leader',
      recipientOrg:
        recipient.organization.trim().slice(0, 150) || 'Summit Attendee',
      recipientRole: sanitizeRole(recipient.role),
      message: cleanMessage,
      replyNote: '',
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return connectionId;
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.CREATE, path);
  }
}

export async function respondToDirectoryConnection(
  firestore: Firestore,
  auth: Auth | null,
  params: {
    connectionId: string;
    status: 'accepted' | 'declined';
    replyNote?: string;
  }
): Promise<void> {
  const { connectionId, status, replyNote } = params;
  if (!connectionId || !ID_PATTERN.test(connectionId)) {
    throw new Error('Invalid connection identifier.');
  }

  const cleanReply = (replyNote ?? '')
    .trim()
    .slice(0, CONNECTION_MESSAGE_MAX_LENGTH);
  const path = `directoryConnections/${connectionId}`;

  try {
    await updateDoc(doc(firestore, 'directoryConnections', connectionId), {
      status,
      replyNote: cleanReply,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.UPDATE, path);
  }
}
