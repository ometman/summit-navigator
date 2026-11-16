'use client';

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { type Auth, type User } from 'firebase/auth';
import {
  ID_PATTERN,
  VALID_SESSION_IDS,
  isBootstrappedAdminUser,
  isValidSessionId,
} from '@/firebase/qa';
import { handleFirestoreError, OperationType } from '@/firebase/user-profile';
import { speakerData } from '@/lib/data';
import type { PresentationSlide } from '@/lib/presentation-data';
import type {
  RegistrationSource,
  RegistrationStatus,
  RegistrationTrack,
  UserRegistration,
} from '@/lib/registrations';

export type UserAdminRole =
  | 'super_admin'
  | 'admin'
  | 'moderator'
  | 'speaker'
  | 'attendee';

export interface SessionOverrideRecord {
  sessionId: string;
  time: string;
  title: string;
  speaker: string;
  content: number;
  qa: number;
  prayer: number;
  summary: string;
  studyPacketTitle: string;
  studyPacketNotes: string;
  slides: PresentationSlide[];
  updatedBy: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface SpeakerOverrideRecord {
  speakerKey: string;
  name: string;
  role: string;
  bio: string;
  updatedBy: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface FirestoreRegistrationRecord extends UserRegistration {
  updatedBy: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export const SPEAKER_KEY_PATTERN = /^[a-z0-9\-]+$/;

export function speakerNameToKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 128);
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

export async function getUserAdminRole(
  firestore: Firestore,
  auth: Auth | null,
  user: User | null
): Promise<UserAdminRole> {
  if (!user || user.isAnonymous || !user.emailVerified) {
    return 'attendee';
  }
  if (isBootstrappedAdminUser(user)) {
    return 'super_admin';
  }
  if (!ID_PATTERN.test(user.uid)) {
    return 'attendee';
  }

  const path = `moderators/${user.uid}`;
  try {
    const snap = await getDoc(doc(firestore, 'moderators', user.uid));
    if (!snap.exists()) return 'attendee';
    const role = snap.data()?.role;
    if (role === 'admin') return 'admin';
    if (role === 'moderator') return 'moderator';
    if (role === 'speaker') return 'speaker';
    return 'attendee';
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.GET, path);
  }
}

function sanitizeSlide(slide: PresentationSlide): PresentationSlide {
  const bullets = (Array.isArray(slide.bullets) ? slide.bullets : [])
    .map((b) => String(b).trim().slice(0, 240))
    .filter((b) => b.length >= 2)
    .slice(0, 6);

  const hex = /^#[0-9A-Fa-f]{6}$/.test(slide.accentHex)
    ? slide.accentHex
    : '#375EAB';

  return {
    heading: slide.heading.trim().slice(0, 160) || 'Session Highlight',
    subheading: slide.subheading.trim().slice(0, 160) || 'Summit Navigator',
    bullets: bullets.length > 0 ? bullets : ['Key ministry takeaway'],
    caption: slide.caption.trim().slice(0, 300) || 'Key session highlight.',
    accentHex: hex,
  };
}

export function subscribeToSessionOverrides(
  firestore: Firestore,
  auth: Auth | null,
  onData: (overrides: Record<number, SessionOverrideRecord>) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const currentMap: Record<number, SessionOverrideRecord> = {};
  const loadedIds = new Set<string>();
  const unsubscribes: Unsubscribe[] = [];

  for (const sid of VALID_SESSION_IDS) {
    const numericId = parseInt(sid, 10);
    const path = `sessionOverrides/${sid}`;
    const docRef = doc(firestore, 'sessionOverrides', sid);

    const unsub = onSnapshot(
      docRef,
      (docSnap) => {
        loadedIds.add(sid);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const rawSlides = Array.isArray(data.slides) ? data.slides : [];
          const slides: PresentationSlide[] = rawSlides
            .slice(0, 8)
            .map((s) => ({
              heading: String(s?.heading ?? ''),
              subheading: String(s?.subheading ?? ''),
              bullets: Array.isArray(s?.bullets)
                ? s.bullets.map((b: unknown) => String(b ?? ''))
                : [],
              caption: String(s?.caption ?? ''),
              accentHex: String(s?.accentHex ?? '#375EAB'),
            }))
            .filter((s) => s.heading.length >= 2);

          currentMap[numericId] = {
            sessionId: sid,
            time: String(data.time ?? ''),
            title: String(data.title ?? ''),
            speaker: String(data.speaker ?? ''),
            content: typeof data.content === 'number' ? data.content : 40,
            qa: typeof data.qa === 'number' ? data.qa : 15,
            prayer: typeof data.prayer === 'number' ? data.prayer : 5,
            summary: String(data.summary ?? ''),
            studyPacketTitle: String(data.studyPacketTitle ?? ''),
            studyPacketNotes: String(data.studyPacketNotes ?? ''),
            slides,
            updatedBy: String(data.updatedBy ?? ''),
            createdAtMs: timestampToMs(data.createdAt),
            updatedAtMs: timestampToMs(data.updatedAt),
          };
        } else {
          delete currentMap[numericId];
        }

        if (loadedIds.size === VALID_SESSION_IDS.length) {
          onData({ ...currentMap });
        }
      },
      (error) => {
        onError(buildContextualError(error, auth, OperationType.GET, path));
      }
    );

    unsubscribes.push(unsub);
  }

  return () => {
    for (const unsub of unsubscribes) {
      unsub();
    }
  };
}

export function subscribeToSpeakerOverrides(
  firestore: Firestore,
  auth: Auth | null,
  onData: (overrides: Record<string, SpeakerOverrideRecord>) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const speakerKeys = speakerData
    .map((sp) => speakerNameToKey(sp.name))
    .filter((key) => SPEAKER_KEY_PATTERN.test(key));

  if (speakerKeys.length === 0) {
    onData({});
    return () => {};
  }

  const currentMap: Record<string, SpeakerOverrideRecord> = {};
  const loadedKeys = new Set<string>();
  const unsubscribes: Unsubscribe[] = [];

  for (const key of speakerKeys) {
    const path = `speakerOverrides/${key}`;
    const docRef = doc(firestore, 'speakerOverrides', key);

    const unsub = onSnapshot(
      docRef,
      (docSnap) => {
        loadedKeys.add(key);
        if (docSnap.exists()) {
          const data = docSnap.data();
          currentMap[key] = {
            speakerKey: key,
            name: String(data.name ?? ''),
            role: String(data.role ?? ''),
            bio: String(data.bio ?? ''),
            updatedBy: String(data.updatedBy ?? ''),
            createdAtMs: timestampToMs(data.createdAt),
            updatedAtMs: timestampToMs(data.updatedAt),
          };
        } else {
          delete currentMap[key];
        }

        if (loadedKeys.size === speakerKeys.length) {
          onData({ ...currentMap });
        }
      },
      (error) => {
        onError(buildContextualError(error, auth, OperationType.GET, path));
      }
    );

    unsubscribes.push(unsub);
  }

  return () => {
    for (const unsub of unsubscribes) {
      unsub();
    }
  };
}

export async function saveSessionOverride(
  firestore: Firestore,
  auth: Auth | null,
  params: {
    sessionId: string;
    time: string;
    title: string;
    speaker: string;
    content: number;
    qa: number;
    prayer: number;
    summary: string;
    studyPacketTitle: string;
    studyPacketNotes: string;
    slides: PresentationSlide[];
    updatedBy: string;
  }
): Promise<void> {
  if (!isValidSessionId(params.sessionId)) {
    throw new Error('Invalid session identifier.');
  }
  if (!ID_PATTERN.test(params.updatedBy)) {
    throw new Error('Invalid editor UID.');
  }

  const time = params.time.trim().slice(0, 80);
  const title = params.title.trim().slice(0, 160);
  const speaker = params.speaker.trim().slice(0, 120);
  const summary = params.summary.trim().slice(0, 2000);
  const studyPacketTitle = params.studyPacketTitle.trim().slice(0, 160);
  const studyPacketNotes = params.studyPacketNotes.trim().slice(0, 4000);
  const content = Math.min(180, Math.max(1, Math.round(params.content)));
  const qa = Math.min(120, Math.max(0, Math.round(params.qa)));
  const prayer = Math.min(60, Math.max(0, Math.round(params.prayer)));
  const slides = params.slides.slice(0, 8).map(sanitizeSlide);

  if (time.length < 3) throw new Error('Session time must be at least 3 characters.');
  if (title.length < 3) throw new Error('Session title must be at least 3 characters.');
  if (speaker.length < 2) throw new Error('Speaker name must be at least 2 characters.');
  if (summary.length < 10) throw new Error('Session summary must be at least 10 characters.');
  if (studyPacketTitle.length < 2) throw new Error('Study packet title must be at least 2 characters.');
  if (slides.length < 1) throw new Error('At least one slide is required.');

  const docRef = doc(firestore, 'sessionOverrides', params.sessionId);
  const path = `sessionOverrides/${params.sessionId}`;

  try {
    const existing = await getDoc(docRef);
    const payload = {
      sessionId: params.sessionId,
      time,
      title,
      speaker,
      content,
      qa,
      prayer,
      summary,
      studyPacketTitle,
      studyPacketNotes,
      slides,
      updatedBy: params.updatedBy,
      updatedAt: serverTimestamp(),
    };

    if (existing.exists()) {
      await updateDoc(docRef, payload);
    } else {
      await setDoc(docRef, {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.WRITE, path);
  }
}

export async function resetSessionOverride(
  firestore: Firestore,
  auth: Auth | null,
  sessionId: string
): Promise<void> {
  if (!isValidSessionId(sessionId)) {
    throw new Error('Invalid session identifier.');
  }
  const path = `sessionOverrides/${sessionId}`;
  try {
    await deleteDoc(doc(firestore, 'sessionOverrides', sessionId));
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.DELETE, path);
  }
}

export async function saveSpeakerOverride(
  firestore: Firestore,
  auth: Auth | null,
  params: {
    name: string;
    role: string;
    bio: string;
    updatedBy: string;
  }
): Promise<void> {
  const speakerKey = speakerNameToKey(params.name);
  if (!SPEAKER_KEY_PATTERN.test(speakerKey) || speakerKey.length < 1) {
    throw new Error('Invalid speaker key.');
  }
  if (!ID_PATTERN.test(params.updatedBy)) {
    throw new Error('Invalid editor UID.');
  }

  const name = params.name.trim().slice(0, 120);
  const role = params.role.trim().slice(0, 120);
  const bio = params.bio.trim().slice(0, 2000);

  if (name.length < 2) throw new Error('Speaker name must be at least 2 characters.');
  if (role.length < 2) throw new Error('Speaker title must be at least 2 characters.');
  if (bio.length < 10) throw new Error('Speaker bio must be at least 10 characters.');

  const docRef = doc(firestore, 'speakerOverrides', speakerKey);
  const path = `speakerOverrides/${speakerKey}`;

  try {
    const existing = await getDoc(docRef);
    const payload = {
      speakerKey,
      name,
      role,
      bio,
      updatedBy: params.updatedBy,
      updatedAt: serverTimestamp(),
    };

    if (existing.exists()) {
      await updateDoc(docRef, payload);
    } else {
      await setDoc(docRef, {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.WRITE, path);
  }
}

export async function resetSpeakerOverride(
  firestore: Firestore,
  auth: Auth | null,
  speakerName: string
): Promise<void> {
  const speakerKey = speakerNameToKey(speakerName);
  if (!SPEAKER_KEY_PATTERN.test(speakerKey)) {
    throw new Error('Invalid speaker key.');
  }
  const path = `speakerOverrides/${speakerKey}`;
  try {
    await deleteDoc(doc(firestore, 'speakerOverrides', speakerKey));
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.DELETE, path);
  }
}

export function subscribeToFirestoreRegistrations(
  firestore: Firestore,
  auth: Auth | null,
  onData: (records: FirestoreRegistrationRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'registrations';
  const regsQuery = query(
    collection(firestore, 'registrations'),
    where('status', 'in', ['Confirmed', 'Pending Verification', 'Checked In'])
  );
  return onSnapshot(
    regsQuery,
    (snapshot) => {
      const records: FirestoreRegistrationRecord[] = snapshot.docs.map(
        (docSnap) => {
          const data = docSnap.data();
          const status: RegistrationStatus =
            data.status === 'Checked In' ||
            data.status === 'Pending Verification'
              ? data.status
              : 'Confirmed';
          const track: RegistrationTrack =
            data.track === 'Morning Track' ||
            data.track === 'Afternoon Track'
              ? data.track
              : 'Morning & Afternoon';
          const source: RegistrationSource =
            data.source === 'Direct Invite' ||
            data.source === 'Ministry Partner'
              ? data.source
              : 'Web Registration';

          return {
            id: String(data.id ?? docSnap.id),
            fullName: String(data.fullName ?? ''),
            email: String(data.email ?? ''),
            organization: String(data.organization ?? 'Summit Attendee'),
            role: String(data.role ?? 'Ministry Lead'),
            track,
            source,
            status,
            registeredAt: String(
              data.registeredAt ?? new Date().toISOString()
            ),
            updatedBy: String(data.updatedBy ?? ''),
            createdAtMs: timestampToMs(data.createdAt),
            updatedAtMs: timestampToMs(data.updatedAt),
          };
        }
      );

      records.sort(
        (a, b) =>
          new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime()
      );
      onData(records);
    },
    (error) => {
      onError(buildContextualError(error, auth, OperationType.LIST, path));
    }
  );
}

const VALID_ROLES = new Set([
  'Senior Pastor',
  'Ministry Lead',
  'Operations & Strategy',
  'Youth & Outreach',
  'Volunteer Coordinator',
]);

function normalizeRole(role: string): string {
  return VALID_ROLES.has(role) ? role : 'Ministry Lead';
}

export async function upsertRegistrationRecord(
  firestore: Firestore,
  auth: Auth | null,
  record: UserRegistration,
  updatedBy: string
): Promise<void> {
  const cleanId = record.id.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128);
  if (!ID_PATTERN.test(cleanId)) {
    throw new Error('Invalid registration ID.');
  }

  const docRef = doc(firestore, 'registrations', cleanId);
  const path = `registrations/${cleanId}`;

  try {
    const existing = await getDoc(docRef);
    if (existing.exists()) {
      await updateDoc(docRef, {
        status: record.status,
        track: record.track,
        role: normalizeRole(record.role),
        organization: record.organization.trim().slice(0, 150) || 'Summit Attendee',
        updatedBy,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(docRef, {
        id: cleanId,
        fullName: record.fullName.trim().slice(0, 120),
        email: record.email.trim().toLowerCase().slice(0, 254),
        organization: record.organization.trim().slice(0, 150) || 'Summit Attendee',
        role: normalizeRole(record.role),
        track: record.track,
        source: record.source,
        status: record.status,
        registeredAt: record.registeredAt,
        updatedBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.WRITE, path);
  }
}

export async function seedRegistrationsToFirestore(
  firestore: Firestore,
  auth: Auth | null,
  records: UserRegistration[],
  existingIds: Set<string>,
  adminUid: string
): Promise<number> {
  const missing = records.filter((r) => {
    const cleanId = r.id.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128);
    return ID_PATTERN.test(cleanId) && !existingIds.has(cleanId);
  });

  if (missing.length === 0) return 0;

  let written = 0;
  try {
    for (let i = 0; i < missing.length; i += 400) {
      const chunk = missing.slice(i, i + 400);
      const batch = writeBatch(firestore);
      for (const item of chunk) {
        const cleanId = item.id.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128);
        const docRef = doc(firestore, 'registrations', cleanId);
        batch.set(docRef, {
          id: cleanId,
          fullName: item.fullName.trim().slice(0, 120),
          email: item.email.trim().toLowerCase().slice(0, 254),
          organization: item.organization.trim().slice(0, 150) || 'Summit Attendee',
          role: normalizeRole(item.role),
          track: item.track,
          source: item.source,
          status: item.status,
          registeredAt: item.registeredAt,
          updatedBy: adminUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        written += 1;
      }
      await batch.commit();
    }
    return written;
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.WRITE, 'registrations');
  }
}

export async function bulkUpdateRegistrationStatus(
  firestore: Firestore,
  auth: Auth | null,
  params: {
    records: UserRegistration[];
    existingFirestoreIds: Set<string>;
    targetStatus: RegistrationStatus;
    adminUid: string;
  }
): Promise<number> {
  const { records, existingFirestoreIds, targetStatus, adminUid } = params;
  if (!ID_PATTERN.test(adminUid)) {
    throw new Error('Invalid administrator UID.');
  }
  if (records.length === 0) return 0;

  let processed = 0;
  try {
    for (let i = 0; i < records.length; i += 400) {
      const chunk = records.slice(i, i + 400);
      const batch = writeBatch(firestore);

      for (const item of chunk) {
        const cleanId = item.id.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128);
        if (!ID_PATTERN.test(cleanId)) continue;
        const docRef = doc(firestore, 'registrations', cleanId);

        if (existingFirestoreIds.has(cleanId)) {
          batch.update(docRef, {
            status: targetStatus,
            updatedBy: adminUid,
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.set(docRef, {
            id: cleanId,
            fullName: item.fullName.trim().slice(0, 120),
            email: item.email.trim().toLowerCase().slice(0, 254),
            organization:
              item.organization.trim().slice(0, 150) || 'Summit Attendee',
            role: normalizeRole(item.role),
            track: item.track,
            source: item.source,
            status: targetStatus,
            registeredAt: item.registeredAt,
            updatedBy: adminUid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        processed += 1;
      }

      await batch.commit();
    }
    return processed;
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.WRITE, 'registrations');
  }
}
