'use client';

import {
  collection,
  doc,
  increment,
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
import { type Auth } from 'firebase/auth';
import { handleFirestoreError, OperationType } from '@/firebase/user-profile';
import {
  ID_PATTERN,
  isValidSessionId,
  VALID_SESSION_IDS,
} from '@/firebase/qa';

export const POLL_QUESTION_MIN_LENGTH = 3;
export const POLL_QUESTION_MAX_LENGTH = 240;
export const POLL_OPTION_MIN_LENGTH = 1;
export const POLL_OPTION_MAX_LENGTH = 100;
export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 5;

export type PollType = 'multiple_choice' | 'commitment';
export type PollStatus = 'open' | 'closed';

export interface SessionPoll {
  id: string;
  sessionId: string;
  pollType: PollType;
  question: string;
  options: string[];
  optionCount: number;
  counts: number[];
  totalVotes: number;
  status: PollStatus;
  archived: boolean;
  createdBy: string;
  createdByName: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface PollPreset {
  id: string;
  label: string;
  pollType: PollType;
  question: string;
  options: string[];
}

export const POLL_PRESETS: PollPreset[] = [
  {
    id: 'commit-action',
    label: 'Ministry Commitment Check',
    pollType: 'commitment',
    question: 'How will you act on the core principle from this session?',
    options: [
      'Commit to implementing this week',
      'Share & align with our church team',
      'Need deeper practical follow-up',
    ],
  },
  {
    id: 'sentiment-pulse',
    label: '1-Tap Clarity & Confidence',
    pollType: 'commitment',
    question: 'How clear and actionable is this framework for your ministry?',
    options: [
      'Crystal clear — ready to execute',
      'Helpful — reviewing notes carefully',
      'Need more examples in Q&A',
    ],
  },
  {
    id: 'priority-focus',
    label: 'Leadership Priority Poll',
    pollType: 'multiple_choice',
    question: 'Which area needs the strongest focus in your ministry next quarter?',
    options: [
      'Vision & Leadership Alignment',
      'Governance & Operations Policy',
      'Financial & Ethical Stewardship',
      'Member Care & Discipleship',
    ],
  },
];

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

function parsePollDoc(
  docId: string,
  fallbackSessionId: string,
  data: Record<string, unknown>
): SessionPoll {
  const rawOptions = Array.isArray(data.options)
    ? data.options.map((opt) => String(opt ?? '').trim()).filter(Boolean)
    : [];
  const optionCount =
    typeof data.optionCount === 'number' &&
    data.optionCount >= POLL_MIN_OPTIONS &&
    data.optionCount <= POLL_MAX_OPTIONS
      ? data.optionCount
      : Math.max(POLL_MIN_OPTIONS, Math.min(POLL_MAX_OPTIONS, rawOptions.length));

  const rawCounts = [
    typeof data.count0 === 'number' && data.count0 >= 0 ? data.count0 : 0,
    typeof data.count1 === 'number' && data.count1 >= 0 ? data.count1 : 0,
    typeof data.count2 === 'number' && data.count2 >= 0 ? data.count2 : 0,
    typeof data.count3 === 'number' && data.count3 >= 0 ? data.count3 : 0,
    typeof data.count4 === 'number' && data.count4 >= 0 ? data.count4 : 0,
  ];
  const counts = rawCounts.slice(0, optionCount);
  const computedTotal = counts.reduce((sum, c) => sum + c, 0);
  const totalVotes =
    typeof data.totalVotes === 'number' && data.totalVotes >= 0
      ? data.totalVotes
      : computedTotal;

  return {
    id: docId,
    sessionId: String(data.sessionId ?? fallbackSessionId),
    pollType: data.pollType === 'commitment' ? 'commitment' : 'multiple_choice',
    question: String(data.question ?? ''),
    options: rawOptions.slice(0, optionCount),
    optionCount,
    counts,
    totalVotes,
    status: data.status === 'closed' ? 'closed' : 'open',
    archived: Boolean(data.archived),
    createdBy: String(data.createdBy ?? ''),
    createdByName: String(data.createdByName ?? 'Speaker'),
    createdAtMs: timestampToMs(data.createdAt),
    updatedAtMs: timestampToMs(data.updatedAt),
  };
}

export function sortSessionPolls(polls: SessionPoll[]): SessionPoll[] {
  return [...polls].sort((a, b) => {
    if (a.archived !== b.archived) {
      return a.archived ? 1 : -1;
    }
    if (a.status !== b.status) {
      return a.status === 'open' ? -1 : 1;
    }
    return b.createdAtMs - a.createdAtMs;
  });
}

export function subscribeToSessionPolls(
  firestore: Firestore,
  auth: Auth | null,
  sessionId: string,
  includeArchived: boolean,
  onData: (polls: SessionPoll[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  if (!isValidSessionId(sessionId)) {
    onData([]);
    return () => {};
  }

  const path = `sessions/${sessionId}/polls`;
  const colRef = collection(firestore, 'sessions', sessionId, 'polls');
  const targetQuery = includeArchived
    ? colRef
    : query(colRef, where('archived', '==', false));

  return onSnapshot(
    targetQuery,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) =>
        parsePollDoc(
          docSnap.id,
          sessionId,
          docSnap.data() as Record<string, unknown>
        )
      );
      onData(sortSessionPolls(items));
    },
    (error) => {
      onError(buildContextualError(error, auth, OperationType.LIST, path));
    }
  );
}

export function subscribeToAllSessionPolls(
  firestore: Firestore,
  auth: Auth | null,
  onData: (polls: SessionPoll[], allSessionsLoaded: boolean) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const bySession = new Map<string, SessionPoll[]>();
  const loadedSessions = new Set<string>();
  const unsubscribes: Unsubscribe[] = [];

  for (const sessionId of VALID_SESSION_IDS) {
    const path = `sessions/${sessionId}/polls`;
    const pollsQuery = query(
      collection(firestore, 'sessions', sessionId, 'polls'),
      where('archived', '==', false)
    );

    const unsub = onSnapshot(
      pollsQuery,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) =>
          parsePollDoc(
            docSnap.id,
            sessionId,
            docSnap.data() as Record<string, unknown>
          )
        );
        bySession.set(sessionId, items);
        loadedSessions.add(sessionId);

        const merged = Array.from(bySession.values()).flat();
        onData(
          sortSessionPolls(merged),
          loadedSessions.size === VALID_SESSION_IDS.length
        );
      },
      (error) => {
        onError(buildContextualError(error, auth, OperationType.LIST, path));
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

export function subscribeToUserPollVotes(
  firestore: Firestore,
  auth: Auth | null,
  sessionId: string,
  uid: string,
  onData: (votesByPollId: Map<string, number>) => void,
  onError: (err: Error) => void
): Unsubscribe {
  if (!isValidSessionId(sessionId) || !uid || !ID_PATTERN.test(uid)) {
    onData(new Map());
    return () => {};
  }

  const path = `sessions/${sessionId}/pollVotes`;
  const votesQuery = query(
    collection(firestore, 'sessions', sessionId, 'pollVotes'),
    where('uid', '==', uid)
  );

  return onSnapshot(
    votesQuery,
    (snapshot) => {
      const map = new Map<string, number>();
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (
          typeof data.pollId === 'string' &&
          data.pollId.length > 0 &&
          typeof data.optionIndex === 'number'
        ) {
          map.set(data.pollId, data.optionIndex);
        }
      }
      onData(map);
    },
    (error) => {
      onError(buildContextualError(error, auth, OperationType.LIST, path));
    }
  );
}

export interface LaunchPollInput {
  sessionId: string;
  pollType: PollType;
  question: string;
  options: string[];
  creatorUid: string;
  creatorName: string;
}

export async function launchSessionPoll(
  firestore: Firestore,
  auth: Auth | null,
  input: LaunchPollInput
): Promise<string> {
  if (!isValidSessionId(input.sessionId)) {
    throw new Error('Invalid session identifier.');
  }
  if (!ID_PATTERN.test(input.creatorUid)) {
    throw new Error('Invalid speaker UID.');
  }

  const cleanQuestion = input.question.trim().slice(0, POLL_QUESTION_MAX_LENGTH);
  if (cleanQuestion.length < POLL_QUESTION_MIN_LENGTH) {
    throw new Error(
      `Poll prompt must be at least ${POLL_QUESTION_MIN_LENGTH} characters.`
    );
  }

  const cleanOptions = input.options
    .map((opt) => opt.trim().slice(0, POLL_OPTION_MAX_LENGTH))
    .filter((opt) => opt.length >= POLL_OPTION_MIN_LENGTH)
    .slice(0, POLL_MAX_OPTIONS);

  if (cleanOptions.length < POLL_MIN_OPTIONS) {
    throw new Error(`Provide at least ${POLL_MIN_OPTIONS} response options.`);
  }

  const rawCreatorName = input.creatorName.trim();
  const cleanCreatorName = (
    rawCreatorName.length >= 2 ? rawCreatorName : 'Speaker'
  ).slice(0, 120);

  const pollsCol = collection(firestore, 'sessions', input.sessionId, 'polls');
  const pollRef = doc(pollsCol);
  const path = `sessions/${input.sessionId}/polls/${pollRef.id}`;

  try {
    await setDoc(pollRef, {
      id: pollRef.id,
      sessionId: input.sessionId,
      pollType: input.pollType,
      question: cleanQuestion,
      options: cleanOptions,
      optionCount: cleanOptions.length,
      count0: 0,
      count1: 0,
      count2: 0,
      count3: 0,
      count4: 0,
      totalVotes: 0,
      status: 'open',
      archived: false,
      createdBy: input.creatorUid,
      createdByName: cleanCreatorName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return pollRef.id;
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.CREATE, path);
  }
}

export async function castPollVote(
  firestore: Firestore,
  auth: Auth | null,
  params: {
    sessionId: string;
    pollId: string;
    uid: string;
    optionIndex: number;
  }
): Promise<void> {
  const { sessionId, pollId, uid, optionIndex } = params;
  if (
    !isValidSessionId(sessionId) ||
    !ID_PATTERN.test(pollId) ||
    !ID_PATTERN.test(uid)
  ) {
    throw new Error('Invalid poll target.');
  }
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 4) {
    throw new Error('Invalid poll option.');
  }

  const voteId = `${pollId}_${uid}`;
  const voteRef = doc(firestore, 'sessions', sessionId, 'pollVotes', voteId);
  const pollRef = doc(firestore, 'sessions', sessionId, 'polls', pollId);
  const countField = `count${optionIndex}` as const;

  const batch = writeBatch(firestore);
  batch.set(voteRef, {
    uid,
    sessionId,
    pollId,
    optionIndex,
    createdAt: serverTimestamp(),
  });
  batch.update(pollRef, {
    [countField]: increment(1),
    totalVotes: increment(1),
    updatedAt: serverTimestamp(),
  });

  const path = `sessions/${sessionId}/polls/${pollId}`;
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.WRITE, path);
  }
}

export async function updateSessionPollState(
  firestore: Firestore,
  auth: Auth | null,
  params: {
    sessionId: string;
    pollId: string;
    patch: Partial<Pick<SessionPoll, 'status' | 'archived'>>;
  }
): Promise<void> {
  const { sessionId, pollId, patch } = params;
  if (!isValidSessionId(sessionId) || !ID_PATTERN.test(pollId)) {
    throw new Error('Invalid poll target.');
  }

  const sanitizedPatch: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (patch.status === 'open' || patch.status === 'closed') {
    sanitizedPatch.status = patch.status;
  }
  if (typeof patch.archived === 'boolean') {
    sanitizedPatch.archived = patch.archived;
  }

  const path = `sessions/${sessionId}/polls/${pollId}`;
  const pollRef = doc(firestore, 'sessions', sessionId, 'polls', pollId);
  try {
    await updateDoc(pollRef, sanitizedPatch);
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.UPDATE, path);
  }
}
