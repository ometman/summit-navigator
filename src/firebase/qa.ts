'use client';

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
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
import { type Auth, type User } from 'firebase/auth';
import { handleFirestoreError, OperationType } from '@/firebase/user-profile';

export const VALID_SESSION_IDS = ['1', '2', '3', '4', '5', '6'] as const;
export const QUESTION_MIN_LENGTH = 3;
export const QUESTION_MAX_LENGTH = 500;
export const AUTHOR_NAME_MIN_LENGTH = 2;
export const AUTHOR_NAME_MAX_LENGTH = 120;
export const ID_PATTERN = /^[a-zA-Z0-9_\-]+$/;
export const BOOTSTRAPPED_ADMIN_EMAIL = 'stackvarsity@gmail.com';

export interface SessionQuestion {
  id: string;
  sessionId: string;
  text: string;
  authorId: string;
  authorName: string;
  isAnonymous: boolean;
  upvotesCount: number;
  pinned: boolean;
  answered: boolean;
  archived: boolean;
  moderatedBy: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface ModeratorRecord {
  uid: string;
  displayName: string;
  role: 'speaker' | 'moderator' | 'admin';
  grantedBy: string;
  createdAtMs: number;
}

let connectionCheckPromise: Promise<void> | null = null;

export function testFirestoreConnection(firestore: Firestore): Promise<void> {
  if (connectionCheckPromise) return connectionCheckPromise;
  connectionCheckPromise = (async () => {
    try {
      await getDocFromServer(doc(firestore, 'test', 'connection'));
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('the client is offline')
      ) {
        console.error('Please check your Firebase configuration.');
      }
    }
  })();
  return connectionCheckPromise;
}

export function isValidSessionId(sessionId: string): boolean {
  return (VALID_SESSION_IDS as readonly string[]).includes(sessionId);
}

export function isBootstrappedAdminUser(user: User | null | undefined): boolean {
  if (!user || user.isAnonymous) return false;
  return (
    user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL &&
    user.emailVerified === true
  );
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

export async function checkUserModeratorAccess(
  firestore: Firestore,
  auth: Auth | null,
  user: User | null
): Promise<boolean> {
  if (!user || user.isAnonymous || !user.emailVerified) {
    return false;
  }
  if (isBootstrappedAdminUser(user)) {
    return true;
  }
  if (!ID_PATTERN.test(user.uid)) {
    return false;
  }

  const path = `moderators/${user.uid}`;
  try {
    const snap = await getDoc(doc(firestore, 'moderators', user.uid));
    return snap.exists();
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.GET, path);
  }
}

export function sortSessionQuestions(
  items: SessionQuestion[]
): SessionQuestion[] {
  return [...items].sort((a, b) => {
    // 1. Pinned active questions surface first (answered pinned questions stay below active pinned)
    const aPinnedActive = a.pinned && !a.answered;
    const bPinnedActive = b.pinned && !b.answered;
    if (aPinnedActive !== bPinnedActive) {
      return aPinnedActive ? -1 : 1;
    }
    // 2. Unanswered questions stay above answered questions
    if (a.answered !== b.answered) {
      return a.answered ? 1 : -1;
    }
    // 3. Pinned flag within answered group
    if (a.pinned !== b.pinned) {
      return a.pinned ? -1 : 1;
    }
    // 4. Higher upvotes first
    if (b.upvotesCount !== a.upvotesCount) {
      return b.upvotesCount - a.upvotesCount;
    }
    // 5. Most recently submitted first
    return b.createdAtMs - a.createdAtMs;
  });
}

export function subscribeToSessionQuestions(
  firestore: Firestore,
  auth: Auth | null,
  sessionId: string,
  includeArchived: boolean,
  onData: (questions: SessionQuestion[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  if (!isValidSessionId(sessionId)) {
    onData([]);
    return () => {};
  }

  const path = `sessions/${sessionId}/questions`;
  const colRef = collection(firestore, 'sessions', sessionId, 'questions');
  const targetQuery = includeArchived
    ? colRef
    : query(colRef, where('archived', '==', false));

  return onSnapshot(
    targetQuery,
    (snapshot) => {
      const items: SessionQuestion[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          sessionId: String(data.sessionId ?? sessionId),
          text: String(data.text ?? ''),
          authorId: String(data.authorId ?? ''),
          authorName: String(data.authorName ?? 'Attendee'),
          isAnonymous: Boolean(data.isAnonymous),
          upvotesCount:
            typeof data.upvotesCount === 'number' && data.upvotesCount >= 0
              ? data.upvotesCount
              : 0,
          pinned: Boolean(data.pinned),
          answered: Boolean(data.answered),
          archived: Boolean(data.archived),
          moderatedBy: String(data.moderatedBy ?? ''),
          createdAtMs: timestampToMs(data.createdAt),
          updatedAtMs: timestampToMs(data.updatedAt),
        };
      });
      onData(sortSessionQuestions(items));
    },
    (error) => {
      onError(buildContextualError(error, auth, OperationType.LIST, path));
    }
  );
}

export function subscribeToUserUpvotes(
  firestore: Firestore,
  auth: Auth | null,
  sessionId: string,
  uid: string,
  onData: (upvotedQuestionIds: Set<string>) => void,
  onError: (err: Error) => void
): Unsubscribe {
  if (!isValidSessionId(sessionId) || !uid || !ID_PATTERN.test(uid)) {
    onData(new Set());
    return () => {};
  }

  const path = `sessions/${sessionId}/upvotes`;
  const upvotesQuery = query(
    collection(firestore, 'sessions', sessionId, 'upvotes'),
    where('uid', '==', uid)
  );

  return onSnapshot(
    upvotesQuery,
    (snapshot) => {
      const ids = new Set<string>();
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (typeof data.questionId === 'string' && data.questionId.length > 0) {
          ids.add(data.questionId);
        }
      }
      onData(ids);
    },
    (error) => {
      onError(buildContextualError(error, auth, OperationType.LIST, path));
    }
  );
}

export interface SubmitQuestionInput {
  sessionId: string;
  text: string;
  authorId: string;
  authorDisplayName: string;
  isAnonymous: boolean;
}

export async function submitSessionQuestion(
  firestore: Firestore,
  auth: Auth | null,
  input: SubmitQuestionInput
): Promise<string> {
  if (!isValidSessionId(input.sessionId)) {
    throw new Error('Invalid session identifier.');
  }
  if (!ID_PATTERN.test(input.authorId)) {
    throw new Error('Invalid user identifier.');
  }

  const trimmedText = input.text.trim().slice(0, QUESTION_MAX_LENGTH);
  if (trimmedText.length < QUESTION_MIN_LENGTH) {
    throw new Error(
      `Questions must be at least ${QUESTION_MIN_LENGTH} characters.`
    );
  }

  let sanitizedAuthorName = 'Anonymous';
  if (!input.isAnonymous) {
    const cleanName = input.authorDisplayName.trim();
    const candidate =
      cleanName.length >= AUTHOR_NAME_MIN_LENGTH &&
      cleanName !== 'Anonymous'
        ? cleanName
        : 'Verified Attendee';
    sanitizedAuthorName = candidate.slice(0, AUTHOR_NAME_MAX_LENGTH);
  }

  const questionsCol = collection(
    firestore,
    'sessions',
    input.sessionId,
    'questions'
  );
  const questionRef = doc(questionsCol);
  const path = `sessions/${input.sessionId}/questions/${questionRef.id}`;

  try {
    await setDoc(questionRef, {
      id: questionRef.id,
      sessionId: input.sessionId,
      text: trimmedText,
      authorId: input.authorId,
      authorName: sanitizedAuthorName,
      isAnonymous: input.isAnonymous,
      upvotesCount: 0,
      pinned: false,
      answered: false,
      archived: false,
      moderatedBy: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return questionRef.id;
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.CREATE, path);
  }
}

export async function toggleQuestionUpvote(
  firestore: Firestore,
  auth: Auth | null,
  params: {
    sessionId: string;
    questionId: string;
    uid: string;
    currentlyUpvoted: boolean;
  }
): Promise<void> {
  const { sessionId, questionId, uid, currentlyUpvoted } = params;
  if (
    !isValidSessionId(sessionId) ||
    !ID_PATTERN.test(questionId) ||
    !ID_PATTERN.test(uid)
  ) {
    throw new Error('Invalid upvote target.');
  }

  const upvoteId = `${questionId}_${uid}`;
  const upvoteRef = doc(firestore, 'sessions', sessionId, 'upvotes', upvoteId);
  const questionRef = doc(
    firestore,
    'sessions',
    sessionId,
    'questions',
    questionId
  );
  const batchPath = `sessions/${sessionId}/questions/${questionId}`;

  const batch = writeBatch(firestore);
  if (currentlyUpvoted) {
    batch.delete(upvoteRef);
    batch.update(questionRef, {
      upvotesCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.set(upvoteRef, {
      uid,
      sessionId,
      questionId,
      createdAt: serverTimestamp(),
    });
    batch.update(questionRef, {
      upvotesCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.WRITE, batchPath);
  }
}

export async function moderateSessionQuestion(
  firestore: Firestore,
  auth: Auth | null,
  params: {
    sessionId: string;
    questionId: string;
    moderatorUid: string;
    patch: Partial<Pick<SessionQuestion, 'pinned' | 'answered' | 'archived'>>;
  }
): Promise<void> {
  const { sessionId, questionId, moderatorUid, patch } = params;
  if (
    !isValidSessionId(sessionId) ||
    !ID_PATTERN.test(questionId) ||
    !ID_PATTERN.test(moderatorUid)
  ) {
    throw new Error('Invalid moderation target.');
  }

  const sanitizedPatch: Record<string, boolean | string | unknown> = {
    moderatedBy: moderatorUid,
    updatedAt: serverTimestamp(),
  };

  if (typeof patch.pinned === 'boolean') {
    sanitizedPatch.pinned = patch.pinned;
  }
  if (typeof patch.answered === 'boolean') {
    sanitizedPatch.answered = patch.answered;
  }
  if (typeof patch.archived === 'boolean') {
    sanitizedPatch.archived = patch.archived;
  }

  const path = `sessions/${sessionId}/questions/${questionId}`;
  const questionRef = doc(
    firestore,
    'sessions',
    sessionId,
    'questions',
    questionId
  );

  try {
    await updateDoc(questionRef, sanitizedPatch);
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.UPDATE, path);
  }
}

export function subscribeToModerators(
  firestore: Firestore,
  auth: Auth | null,
  onData: (moderators: ModeratorRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'moderators';
  const moderatorsQuery = query(
    collection(firestore, 'moderators'),
    where('role', 'in', ['speaker', 'moderator', 'admin'])
  );
  return onSnapshot(
    moderatorsQuery,
    (snapshot) => {
      const list: ModeratorRecord[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          uid: docSnap.id,
          displayName: String(data.displayName ?? 'Speaker'),
          role:
            data.role === 'admin'
              ? 'admin'
              : data.role === 'speaker'
              ? 'speaker'
              : 'moderator',
          grantedBy: String(data.grantedBy ?? ''),
          createdAtMs: timestampToMs(data.createdAt),
        };
      });
      list.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(list);
    },
    (error) => {
      onError(buildContextualError(error, auth, OperationType.LIST, path));
    }
  );
}

export async function grantModeratorAccess(
  firestore: Firestore,
  auth: Auth | null,
  params: {
    targetUid: string;
    displayName: string;
    role: 'speaker' | 'moderator' | 'admin';
    adminUid: string;
  }
): Promise<void> {
  const targetUid = params.targetUid.trim();
  const displayName = params.displayName.trim().slice(0, 120);
  if (!ID_PATTERN.test(targetUid) || targetUid.length > 128) {
    throw new Error('Enter a valid Firebase User UID.');
  }
  if (displayName.length < 2) {
    throw new Error('Display name must be at least 2 characters.');
  }

  const path = `moderators/${targetUid}`;
  try {
    await setDoc(doc(firestore, 'moderators', targetUid), {
      uid: targetUid,
      displayName,
      role: params.role,
      grantedBy: params.adminUid,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.CREATE, path);
  }
}

export async function revokeModeratorAccess(
  firestore: Firestore,
  auth: Auth | null,
  targetUid: string
): Promise<void> {
  const cleanUid = targetUid.trim();
  if (!ID_PATTERN.test(cleanUid)) {
    throw new Error('Invalid moderator UID.');
  }
  const path = `moderators/${cleanUid}`;
  try {
    await deleteDoc(doc(firestore, 'moderators', cleanUid));
  } catch (error) {
    handleFirestoreError(error, auth, OperationType.DELETE, path);
  }
}
