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
  updateDoc,
  where,
  writeBatch,
  type Firestore,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { type Auth } from 'firebase/auth';
import { handleFirestoreError, OperationType } from '@/firebase/user-profile';
import {
  computeDueDateIso,
  DEFAULT_SUMMIT_DATE_ISO,
  MINISTRY_DEPARTMENTS,
  SESSION_ACTION_TEMPLATES,
  type ActionHorizon,
  type ActionPlanTemplate,
  type ActionStatus,
  type ReminderCadence,
  type ReminderChannel,
  type ReminderDay,
} from '@/lib/action-plan-templates';
import {
  computeNextDueAtIso,
  type DigestDeliveryMode,
  type DigestDispatchStatus,
  type DispatchTriggerSource,
  type ReminderSubscriptionSnapshot,
} from '@/lib/reminder-cron';
import { agendaData } from '@/lib/data';

export interface ActionPlanItemRecord {
  id: string;
  uid: string;
  sessionId: string;
  sessionTitle: string;
  title: string;
  notes: string;
  horizonDays: ActionHorizon;
  churchName: string;
  department: string;
  assigneeLabel: string;
  status: ActionStatus;
  dueDateIso: string;
  completedAtIso: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface ActionReminderPreferenceRecord {
  uid: string;
  enabled: boolean;
  cadence: ReminderCadence;
  reminderDay: ReminderDay;
  preferredChannel: ReminderChannel;
  churchName: string;
  defaultDepartment: string;
  summitDateIso: string;
  lastCheckInIso: string;
  createdAtMs: number;
  updatedAtMs: number;
}

function toMs(ts: unknown): number {
  if (ts && typeof (ts as Timestamp).toMillis === 'function') {
    return (ts as Timestamp).toMillis();
  }
  return Date.now();
}

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120);
  return cleaned.length > 0 ? cleaned : `item-${Date.now()}`;
}

function mapActionItemDoc(
  docId: string,
  data: Record<string, unknown>
): ActionPlanItemRecord {
  const rawHorizon = Number(data.horizonDays);
  const horizonDays: ActionHorizon =
    rawHorizon === 60 ? 60 : rawHorizon === 90 ? 90 : 30;
  const rawStatus = String(data.status || 'pending');
  const status: ActionStatus =
    rawStatus === 'completed' || rawStatus === 'in_progress'
      ? rawStatus
      : 'pending';

  return {
    id: docId,
    uid: String(data.uid || ''),
    sessionId: String(data.sessionId || '1'),
    sessionTitle: String(data.sessionTitle || 'Summit Session'),
    title: String(data.title || ''),
    notes: String(data.notes || ''),
    horizonDays,
    churchName: String(data.churchName || 'Local Ministry'),
    department: String(data.department || MINISTRY_DEPARTMENTS[0]),
    assigneeLabel: String(data.assigneeLabel || 'Ministry Lead'),
    status,
    dueDateIso: String(data.dueDateIso || DEFAULT_SUMMIT_DATE_ISO),
    completedAtIso: String(data.completedAtIso || ''),
    createdAtMs: toMs(data.createdAt),
    updatedAtMs: toMs(data.updatedAt),
  };
}

function mapReminderPrefDoc(
  uid: string,
  data: Record<string, unknown>
): ActionReminderPreferenceRecord {
  const rawCadence = String(data.cadence || 'weekly');
  const cadence: ReminderCadence =
    rawCadence === 'biweekly' || rawCadence === 'monthly'
      ? rawCadence
      : 'weekly';

  const rawDay = String(data.reminderDay || 'Monday');
  const reminderDay: ReminderDay =
    rawDay === 'Wednesday' || rawDay === 'Friday' || rawDay === 'Saturday'
      ? rawDay
      : 'Monday';

  const rawChannel = String(data.preferredChannel || 'both');
  const preferredChannel: ReminderChannel =
    rawChannel === 'email_digest' || rawChannel === 'dashboard_banner'
      ? rawChannel
      : 'both';

  return {
    uid: String(data.uid || uid),
    enabled: data.enabled !== false,
    cadence,
    reminderDay,
    preferredChannel,
    churchName: String(data.churchName || 'Local Ministry'),
    defaultDepartment: String(
      data.defaultDepartment || MINISTRY_DEPARTMENTS[0]
    ),
    summitDateIso: String(data.summitDateIso || DEFAULT_SUMMIT_DATE_ISO),
    lastCheckInIso: String(data.lastCheckInIso || ''),
    createdAtMs: toMs(data.createdAt),
    updatedAtMs: toMs(data.updatedAt),
  };
}

function buildSnapshotError(
  error: unknown,
  auth: Auth | null,
  operationType: OperationType,
  path: string
): Error {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
    },
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return new Error(JSON.stringify(errInfo));
}

export function subscribeToUserActionItems(
  firestore: Firestore,
  auth: Auth | null,
  uid: string,
  onData: (items: ActionPlanItemRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/actionItems`;
  // Paired with `allow list: if isOwner(userId) && isEmailVerified() && isValidId(userId) && existing().uid == request.auth.uid;`
  const q = query(
    collection(firestore, 'users', uid, 'actionItems'),
    where('uid', '==', uid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const records = snapshot.docs.map((docSnap) =>
        mapActionItemDoc(docSnap.id, docSnap.data() as Record<string, unknown>)
      );
      records.sort((a, b) => {
        if (a.horizonDays !== b.horizonDays) {
          return a.horizonDays - b.horizonDays;
        }
        if (a.sessionId !== b.sessionId) {
          return Number(a.sessionId) - Number(b.sessionId);
        }
        return a.createdAtMs - b.createdAtMs;
      });
      onData(records);
    },
    (error) => {
      onError(buildSnapshotError(error, auth, OperationType.LIST, path));
    }
  );
}

export function subscribeToActionReminderPref(
  firestore: Firestore,
  auth: Auth | null,
  uid: string,
  onData: (pref: ActionReminderPreferenceRecord | null) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}/actionPreferences/reminders`;
  const ref = doc(firestore, 'users', uid, 'actionPreferences', 'reminders');

  return onSnapshot(
    ref,
    (docSnap) => {
      if (!docSnap.exists()) {
        onData(null);
        return;
      }
      onData(
        mapReminderPrefDoc(uid, docSnap.data() as Record<string, unknown>)
      );
    },
    (error) => {
      onError(buildSnapshotError(error, auth, OperationType.GET, path));
    }
  );
}

export interface SaveActionReminderPrefInput {
  uid: string;
  enabled: boolean;
  cadence: ReminderCadence;
  reminderDay: ReminderDay;
  preferredChannel: ReminderChannel;
  churchName: string;
  defaultDepartment: string;
  summitDateIso: string;
  lastCheckInIso?: string;
}

export async function saveActionReminderPref(
  firestore: Firestore,
  auth: Auth | null,
  input: SaveActionReminderPrefInput
): Promise<void> {
  const path = `users/${input.uid}/actionPreferences/reminders`;
  const ref = doc(firestore, 'users', input.uid, 'actionPreferences', 'reminders');

  const churchName = (input.churchName.trim() || 'Local Ministry').slice(0, 150);
  const defaultDepartment = (
    input.defaultDepartment.trim() || MINISTRY_DEPARTMENTS[0]
  ).slice(0, 80);
  const summitDateIso = /^\d{4}-\d{2}-\d{2}$/.test(input.summitDateIso.trim())
    ? input.summitDateIso.trim()
    : DEFAULT_SUMMIT_DATE_ISO;

  let existingSnap;
  try {
    existingSnap = await getDoc(ref);
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.GET, path);
  }

  try {
    if (existingSnap && existingSnap.exists()) {
      const existingData = existingSnap.data() as Record<string, unknown>;
      await updateDoc(ref, {
        enabled: input.enabled,
        cadence: input.cadence,
        reminderDay: input.reminderDay,
        preferredChannel: input.preferredChannel,
        churchName,
        defaultDepartment,
        summitDateIso,
        lastCheckInIso: (
          input.lastCheckInIso ?? String(existingData.lastCheckInIso || '')
        ).slice(0, 64),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        uid: input.uid,
        enabled: input.enabled,
        cadence: input.cadence,
        reminderDay: input.reminderDay,
        preferredChannel: input.preferredChannel,
        churchName,
        defaultDepartment,
        summitDateIso,
        lastCheckInIso: (input.lastCheckInIso || '').slice(0, 64),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.WRITE, path);
  }
}

export async function recordReminderCheckIn(
  firestore: Firestore,
  auth: Auth | null,
  params: {
    uid: string;
    churchName: string;
    defaultDepartment: string;
    summitDateIso?: string;
  }
): Promise<void> {
  const path = `users/${params.uid}/actionPreferences/reminders`;
  const ref = doc(firestore, 'users', params.uid, 'actionPreferences', 'reminders');
  const nowIso = new Date().toISOString();

  let existingSnap;
  try {
    existingSnap = await getDoc(ref);
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.GET, path);
  }

  try {
    if (existingSnap && existingSnap.exists()) {
      await updateDoc(ref, {
        lastCheckInIso: nowIso,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        uid: params.uid,
        enabled: true,
        cadence: 'weekly',
        reminderDay: 'Monday',
        preferredChannel: 'both',
        churchName: (params.churchName.trim() || 'Local Ministry').slice(0, 150),
        defaultDepartment: (
          params.defaultDepartment.trim() || MINISTRY_DEPARTMENTS[0]
        ).slice(0, 80),
        summitDateIso:
          params.summitDateIso && /^\d{4}-\d{2}-\d{2}$/.test(params.summitDateIso)
            ? params.summitDateIso
            : DEFAULT_SUMMIT_DATE_ISO,
        lastCheckInIso: nowIso,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.WRITE, path);
  }
}

export interface AddActionPlanItemInput {
  uid: string;
  sessionId: string;
  sessionTitle?: string;
  title: string;
  notes?: string;
  horizonDays: ActionHorizon;
  churchName: string;
  department: string;
  assigneeLabel: string;
  dueDateIso?: string;
  summitDateIso?: string;
  customId?: string;
}

export async function addActionPlanItem(
  firestore: Firestore,
  auth: Auth | null,
  input: AddActionPlanItemInput
): Promise<string> {
  const safeSessionId = ['1', '2', '3', '4', '5', '6'].includes(input.sessionId)
    ? input.sessionId
    : '1';
  const defaultSessionTitle =
    agendaData.find((s) => s.id.toString() === safeSessionId)?.title ||
    `Session ${safeSessionId}`;

  const colRef = collection(firestore, 'users', input.uid, 'actionItems');
  const itemRef = input.customId
    ? doc(colRef, sanitizeId(input.customId))
    : doc(colRef);
  const path = `users/${input.uid}/actionItems/${itemRef.id}`;

  const cleanTitle = input.title.trim();
  const title = (cleanTitle.length >= 3 ? cleanTitle : 'Ministry Action Step').slice(
    0,
    220
  );
  const notes = (input.notes || '').trim().slice(0, 600);
  const sessionTitle = (input.sessionTitle || defaultSessionTitle)
    .trim()
    .slice(0, 160);
  const churchName = (input.churchName.trim() || 'Local Ministry').slice(0, 150);
  const department = (input.department.trim() || MINISTRY_DEPARTMENTS[0]).slice(
    0,
    80
  );
  const assigneeLabel = (input.assigneeLabel.trim() || 'Ministry Lead').slice(
    0,
    120
  );
  const dueDateIso =
    input.dueDateIso && /^\d{4}-\d{2}-\d{2}$/.test(input.dueDateIso)
      ? input.dueDateIso
      : computeDueDateIso(
          input.summitDateIso || DEFAULT_SUMMIT_DATE_ISO,
          input.horizonDays
        );

  try {
    await setDoc(itemRef, {
      id: itemRef.id,
      uid: input.uid,
      sessionId: safeSessionId,
      sessionTitle,
      title,
      notes,
      horizonDays: input.horizonDays,
      churchName,
      department,
      assigneeLabel,
      status: 'pending',
      dueDateIso,
      completedAtIso: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return itemRef.id;
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.CREATE, path);
  }
}

export async function seedActionPlanTemplates(
  firestore: Firestore,
  auth: Auth | null,
  params: {
    uid: string;
    churchName: string;
    assigneeLabel: string;
    summitDateIso?: string;
    existingItemIds: Set<string>;
    templates?: ActionPlanTemplate[];
  }
): Promise<number> {
  const templatesToUse = params.templates || SESSION_ACTION_TEMPLATES;
  const missing = templatesToUse.filter(
    (tpl) => !params.existingItemIds.has(tpl.templateId)
  );

  if (missing.length === 0) {
    return 0;
  }

  const summitDateIso =
    params.summitDateIso && /^\d{4}-\d{2}-\d{2}$/.test(params.summitDateIso)
      ? params.summitDateIso
      : DEFAULT_SUMMIT_DATE_ISO;
  const churchName = (params.churchName.trim() || 'Local Ministry').slice(0, 150);
  const assigneeLabel = (params.assigneeLabel.trim() || 'Ministry Lead').slice(
    0,
    120
  );

  const batch = writeBatch(firestore);
  const colRef = collection(firestore, 'users', params.uid, 'actionItems');

  for (const tpl of missing) {
    const ref = doc(colRef, tpl.templateId);
    batch.set(ref, {
      id: tpl.templateId,
      uid: params.uid,
      sessionId: tpl.sessionId,
      sessionTitle: tpl.sessionTitle.slice(0, 160),
      title: tpl.title.slice(0, 220),
      notes: tpl.notes.slice(0, 600),
      horizonDays: tpl.horizonDays,
      churchName,
      department: tpl.suggestedDepartment.slice(0, 80),
      assigneeLabel,
      status: 'pending',
      dueDateIso: computeDueDateIso(summitDateIso, tpl.horizonDays),
      completedAtIso: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    return missing.length;
  } catch (error) {
    handleFirestoreError(
      error,
      auth,
      OperationType.WRITE,
      `users/${params.uid}/actionItems`
    );
  }
}

export interface UpdateActionPlanItemInput {
  uid: string;
  itemId: string;
  status?: ActionStatus;
  horizonDays?: ActionHorizon;
  churchName?: string;
  department?: string;
  assigneeLabel?: string;
  dueDateIso?: string;
  title?: string;
  notes?: string;
}

export async function updateActionPlanItem(
  firestore: Firestore,
  auth: Auth | null,
  input: UpdateActionPlanItemInput
): Promise<void> {
  const path = `users/${input.uid}/actionItems/${input.itemId}`;
  const ref = doc(firestore, 'users', input.uid, 'actionItems', input.itemId);

  const updates: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (input.status !== undefined) {
    updates.status = input.status;
    updates.completedAtIso =
      input.status === 'completed' ? new Date().toISOString() : '';
  }
  if (input.horizonDays !== undefined) {
    updates.horizonDays = input.horizonDays;
  }
  if (input.churchName !== undefined) {
    updates.churchName = (input.churchName.trim() || 'Local Ministry').slice(
      0,
      150
    );
  }
  if (input.department !== undefined) {
    updates.department = (
      input.department.trim() || MINISTRY_DEPARTMENTS[0]
    ).slice(0, 80);
  }
  if (input.assigneeLabel !== undefined) {
    updates.assigneeLabel = (
      input.assigneeLabel.trim() || 'Ministry Lead'
    ).slice(0, 120);
  }
  if (
    input.dueDateIso !== undefined &&
    /^\d{4}-\d{2}-\d{2}$/.test(input.dueDateIso.trim())
  ) {
    updates.dueDateIso = input.dueDateIso.trim();
  }
  if (input.title !== undefined && input.title.trim().length >= 3) {
    updates.title = input.title.trim().slice(0, 220);
  }
  if (input.notes !== undefined) {
    updates.notes = input.notes.trim().slice(0, 600);
  }

  try {
    await updateDoc(ref, updates);
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.UPDATE, path);
  }
}

export async function deleteActionPlanItem(
  firestore: Firestore,
  auth: Auth | null,
  uid: string,
  itemId: string
): Promise<void> {
  const path = `users/${uid}/actionItems/${itemId}`;
  const ref = doc(firestore, 'users', uid, 'actionItems', itemId);
  try {
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.DELETE, path);
  }
}

export interface ReminderSubscriptionRecord extends ReminderSubscriptionSnapshot {
  createdAtMs: number;
  updatedAtMs: number;
}

export interface ReminderDispatchLogRecord {
  id: string;
  uid: string;
  recipientEmail: string;
  recipientName: string;
  churchName: string;
  cadence: ReminderCadence;
  triggerSource: DispatchTriggerSource;
  deliveryMode: DigestDeliveryMode;
  status: DigestDispatchStatus;
  openCount: number;
  overdueCount: number;
  dueSoonCount: number;
  subject: string;
  sentAtIso: string;
  errorMessage: string;
  createdAtMs: number;
}

function mapReminderSubscriptionDoc(
  docId: string,
  data: Record<string, unknown>
): ReminderSubscriptionRecord {
  const rawCadence = String(data.cadence || 'weekly');
  const cadence: ReminderCadence =
    rawCadence === 'biweekly' || rawCadence === 'monthly'
      ? rawCadence
      : 'weekly';

  const rawDay = String(data.reminderDay || 'Monday');
  const reminderDay: ReminderDay =
    rawDay === 'Wednesday' || rawDay === 'Friday' || rawDay === 'Saturday'
      ? rawDay
      : 'Monday';

  const rawChannel = String(data.preferredChannel || 'both');
  const preferredChannel: ReminderChannel =
    rawChannel === 'email_digest' || rawChannel === 'dashboard_banner'
      ? rawChannel
      : 'both';

  const topOpenTitles = Array.isArray(data.topOpenTitles)
    ? data.topOpenTitles
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .slice(0, 5)
    : [];

  return {
    uid: String(data.uid || docId),
    email: String(data.email || ''),
    displayName: String(data.displayName || 'Ministry Lead'),
    enabled: data.enabled !== false,
    cadence,
    reminderDay,
    preferredChannel,
    churchName: String(data.churchName || 'Local Ministry'),
    defaultDepartment: String(
      data.defaultDepartment || MINISTRY_DEPARTMENTS[0]
    ),
    summitDateIso: String(data.summitDateIso || DEFAULT_SUMMIT_DATE_ISO),
    lastCheckInIso: String(data.lastCheckInIso || ''),
    lastEmailedAtIso: String(data.lastEmailedAtIso || ''),
    nextDueAtIso: String(data.nextDueAtIso || DEFAULT_SUMMIT_DATE_ISO),
    openCount: Math.max(0, Number(data.openCount) || 0),
    completedCount: Math.max(0, Number(data.completedCount) || 0),
    overdueCount: Math.max(0, Number(data.overdueCount) || 0),
    dueSoonCount: Math.max(0, Number(data.dueSoonCount) || 0),
    topOpenTitles,
    createdAtMs: toMs(data.createdAt),
    updatedAtMs: toMs(data.updatedAt),
  };
}

function mapDispatchLogDoc(
  docId: string,
  data: Record<string, unknown>
): ReminderDispatchLogRecord {
  const rawCadence = String(data.cadence || 'weekly');
  const cadence: ReminderCadence =
    rawCadence === 'biweekly' || rawCadence === 'monthly'
      ? rawCadence
      : 'weekly';

  const rawSource = String(data.triggerSource || 'user_test');
  const triggerSource: DispatchTriggerSource =
    rawSource === 'cron_scheduler' || rawSource === 'admin_console'
      ? rawSource
      : 'user_test';

  const rawMode = String(data.deliveryMode || 'preview');
  const deliveryMode: DigestDeliveryMode =
    rawMode === 'resend' || rawMode === 'smtp' ? rawMode : 'preview';

  const rawStatus = String(data.status || 'preview');
  const status: DigestDispatchStatus =
    rawStatus === 'sent' ||
    rawStatus === 'failed' ||
    rawStatus === 'skipped'
      ? rawStatus
      : 'preview';

  return {
    id: docId,
    uid: String(data.uid || ''),
    recipientEmail: String(data.recipientEmail || ''),
    recipientName: String(data.recipientName || 'Ministry Lead'),
    churchName: String(data.churchName || 'Local Ministry'),
    cadence,
    triggerSource,
    deliveryMode,
    status,
    openCount: Math.max(0, Number(data.openCount) || 0),
    overdueCount: Math.max(0, Number(data.overdueCount) || 0),
    dueSoonCount: Math.max(0, Number(data.dueSoonCount) || 0),
    subject: String(data.subject || 'Summit Navigator Accountability Digest'),
    sentAtIso: String(data.sentAtIso || ''),
    errorMessage: String(data.errorMessage || ''),
    createdAtMs: toMs(data.createdAt),
  };
}

export async function syncReminderSubscription(
  firestore: Firestore,
  auth: Auth | null,
  params: {
    uid: string;
    email: string;
    displayName: string;
    enabled: boolean;
    cadence: ReminderCadence;
    reminderDay: ReminderDay;
    preferredChannel: ReminderChannel;
    churchName: string;
    defaultDepartment: string;
    summitDateIso: string;
    lastCheckInIso: string;
    items: ActionPlanItemRecord[];
  }
): Promise<void> {
  const cleanEmail = params.email.trim().toLowerCase().slice(0, 254);
  if (!cleanEmail) return;

  const path = `reminderSubscriptions/${params.uid}`;
  const ref = doc(firestore, 'reminderSubscriptions', params.uid);

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const in14DaysIso = new Date(now.getTime() + 14 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  let openCount = 0;
  let completedCount = 0;
  let overdueCount = 0;
  let dueSoonCount = 0;
  const topOpenTitles: string[] = [];

  for (const item of params.items) {
    if (item.status === 'completed') {
      completedCount += 1;
    } else {
      openCount += 1;
      if (item.dueDateIso < todayIso) {
        overdueCount += 1;
      } else if (item.dueDateIso <= in14DaysIso) {
        dueSoonCount += 1;
      }
      if (topOpenTitles.length < 5) {
        const line = `${item.horizonDays}-Day · ${item.department}: ${item.title} (Due ${item.dueDateIso})`.slice(
          0,
          240
        );
        if (line.length >= 2) {
          topOpenTitles.push(line);
        }
      }
    }
  }

  const displayName = (
    params.displayName.trim().length >= 2
      ? params.displayName.trim()
      : 'Ministry Lead'
  ).slice(0, 120);
  const churchName = (params.churchName.trim() || 'Local Ministry').slice(
    0,
    150
  );
  const defaultDepartment = (
    params.defaultDepartment.trim() || MINISTRY_DEPARTMENTS[0]
  ).slice(0, 80);
  const summitDateIso = /^\d{4}-\d{2}-\d{2}$/.test(params.summitDateIso.trim())
    ? params.summitDateIso.trim()
    : DEFAULT_SUMMIT_DATE_ISO;
  const nextDueAtIso = computeNextDueAtIso(
    params.cadence,
    params.reminderDay,
    now
  );

  let existingSnap;
  try {
    existingSnap = await getDoc(ref);
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.GET, path);
  }

  try {
    if (existingSnap && existingSnap.exists()) {
      await updateDoc(ref, {
        displayName,
        enabled: params.enabled,
        cadence: params.cadence,
        reminderDay: params.reminderDay,
        preferredChannel: params.preferredChannel,
        churchName,
        defaultDepartment,
        summitDateIso,
        lastCheckInIso: params.lastCheckInIso.slice(0, 64),
        nextDueAtIso,
        openCount: Math.min(10000, openCount),
        completedCount: Math.min(10000, completedCount),
        overdueCount: Math.min(10000, overdueCount),
        dueSoonCount: Math.min(10000, dueSoonCount),
        topOpenTitles,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        uid: params.uid,
        email: cleanEmail,
        displayName,
        enabled: params.enabled,
        cadence: params.cadence,
        reminderDay: params.reminderDay,
        preferredChannel: params.preferredChannel,
        churchName,
        defaultDepartment,
        summitDateIso,
        lastCheckInIso: params.lastCheckInIso.slice(0, 64),
        lastEmailedAtIso: '',
        nextDueAtIso,
        openCount: Math.min(10000, openCount),
        completedCount: Math.min(10000, completedCount),
        overdueCount: Math.min(10000, overdueCount),
        dueSoonCount: Math.min(10000, dueSoonCount),
        topOpenTitles,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.WRITE, path);
  }
}

export function subscribeToUserDispatchLogs(
  firestore: Firestore,
  auth: Auth | null,
  uid: string,
  onData: (logs: ReminderDispatchLogRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `reminderDispatchLogs`;
  // Paired with `allow list: if isSignedIn() && isEmailVerified() && (isBootstrappedAdmin() || existing().uid == request.auth.uid);`
  const q = query(
    collection(firestore, 'reminderDispatchLogs'),
    where('uid', '==', uid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const logs = snapshot.docs.map((docSnap) =>
        mapDispatchLogDoc(docSnap.id, docSnap.data() as Record<string, unknown>)
      );
      logs.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(logs);
    },
    (error) => {
      onError(buildSnapshotError(error, auth, OperationType.LIST, path));
    }
  );
}

export function subscribeToAllReminderSubscriptions(
  firestore: Firestore,
  auth: Auth | null,
  onData: (subs: ReminderSubscriptionRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'reminderSubscriptions';
  // Paired with `allow list: if isBootstrappedAdmin() && existing().cadence in ['weekly', 'biweekly', 'monthly'];`
  const q = query(
    collection(firestore, 'reminderSubscriptions'),
    where('cadence', 'in', ['weekly', 'biweekly', 'monthly'])
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const subs = snapshot.docs.map((docSnap) =>
        mapReminderSubscriptionDoc(
          docSnap.id,
          docSnap.data() as Record<string, unknown>
        )
      );
      subs.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onData(subs);
    },
    (error) => {
      onError(buildSnapshotError(error, auth, OperationType.LIST, path));
    }
  );
}

export function subscribeToAllDispatchLogs(
  firestore: Firestore,
  auth: Auth | null,
  onData: (logs: ReminderDispatchLogRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'reminderDispatchLogs';
  const q = query(
    collection(firestore, 'reminderDispatchLogs'),
    where('status', 'in', ['sent', 'preview', 'failed', 'skipped'])
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const logs = snapshot.docs.map((docSnap) =>
        mapDispatchLogDoc(docSnap.id, docSnap.data() as Record<string, unknown>)
      );
      logs.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(logs);
    },
    (error) => {
      onError(buildSnapshotError(error, auth, OperationType.LIST, path));
    }
  );
}

export async function recordReminderDispatchResult(
  firestore: Firestore,
  auth: Auth | null,
  params: {
    uid: string;
    recipientEmail: string;
    recipientName: string;
    churchName: string;
    cadence: ReminderCadence;
    reminderDay: ReminderDay;
    triggerSource: DispatchTriggerSource;
    deliveryMode: DigestDeliveryMode;
    status: DigestDispatchStatus;
    openCount: number;
    overdueCount: number;
    dueSoonCount: number;
    subject: string;
    sentAtIso: string;
    errorMessage?: string;
    updateSubscriptionTimestamp?: boolean;
  }
): Promise<string> {
  const logId = sanitizeId(`log-${params.uid.slice(0, 16)}-${Date.now()}`);
  const logPath = `reminderDispatchLogs/${logId}`;
  const logRef = doc(firestore, 'reminderDispatchLogs', logId);

  const recipientName = (
    params.recipientName.trim().length >= 2
      ? params.recipientName.trim()
      : 'Ministry Lead'
  ).slice(0, 120);
  const churchName = (params.churchName.trim() || 'Local Ministry').slice(
    0,
    150
  );
  const subject = (
    params.subject.trim().length >= 3
      ? params.subject.trim()
      : 'Summit Navigator Accountability Digest'
  ).slice(0, 200);

  try {
    await setDoc(logRef, {
      id: logId,
      uid: params.uid,
      recipientEmail: params.recipientEmail.trim().toLowerCase().slice(0, 254),
      recipientName,
      churchName,
      cadence: params.cadence,
      triggerSource: params.triggerSource,
      deliveryMode: params.deliveryMode,
      status: params.status,
      openCount: Math.max(0, Math.min(10000, Math.round(params.openCount))),
      overdueCount: Math.max(
        0,
        Math.min(10000, Math.round(params.overdueCount))
      ),
      dueSoonCount: Math.max(
        0,
        Math.min(10000, Math.round(params.dueSoonCount))
      ),
      subject,
      sentAtIso: (params.sentAtIso || new Date().toISOString()).slice(0, 64),
      errorMessage: (params.errorMessage || '').slice(0, 300),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.CREATE, logPath);
  }

  if (
    params.updateSubscriptionTimestamp !== false &&
    (params.status === 'sent' || params.status === 'preview')
  ) {
    const subPath = `reminderSubscriptions/${params.uid}`;
    const subRef = doc(firestore, 'reminderSubscriptions', params.uid);
    try {
      const subSnap = await getDoc(subRef);
      if (subSnap.exists()) {
        const nextDueAtIso = computeNextDueAtIso(
          params.cadence,
          params.reminderDay,
          new Date()
        );
        await updateDoc(subRef, {
          lastEmailedAtIso: params.sentAtIso.slice(0, 64),
          nextDueAtIso,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, auth, OperationType.UPDATE, subPath);
    }
  }

  return logId;
}
