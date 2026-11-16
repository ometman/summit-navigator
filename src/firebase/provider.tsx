'use client';

import React, {
  DependencyList,
  createContext,
  useCallback,
  useContext,
  ReactNode,
  useMemo,
  useState,
  useEffect,
} from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged, signOut } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
}

interface UserAuthState {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export interface FirebaseContextState {
  areServicesAvailable: boolean;
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
  isMfaVerified: boolean;
  isMfaLoading: boolean;
  setMfaVerified: (verified: boolean) => void;
  refreshMfaStatus: (uid?: string) => Promise<boolean>;
}

export interface FirebaseServicesAndUser {
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
  isMfaVerified: boolean;
  isMfaLoading: boolean;
  setMfaVerified: (verified: boolean) => void;
  refreshMfaStatus: (uid?: string) => Promise<boolean>;
}

export interface UserHookResult {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
  isMfaVerified: boolean;
  isMfaLoading: boolean;
  setMfaVerified: (verified: boolean) => void;
  refreshMfaStatus: (uid?: string) => Promise<boolean>;
}

export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
}) => {
  const [userAuthState, setUserAuthState] = useState<UserAuthState>({
    user: null,
    isUserLoading: true,
    userError: null,
  });
  const [isMfaVerified, setIsMfaVerified] = useState<boolean>(false);
  const [isMfaLoading, setIsMfaLoading] = useState<boolean>(false);

  const latestUidRef = React.useRef<string | undefined>(undefined);
  latestUidRef.current = userAuthState.user?.uid;

  const refreshMfaStatus = useCallback(
    async (explicitUid?: string): Promise<boolean> => {
      const targetUid = explicitUid || latestUidRef.current;
      if (!targetUid) {
        setIsMfaVerified(false);
        setIsMfaLoading(false);
        return false;
      }

      setIsMfaLoading(true);
      try {
        const res = await fetch(
          `/api/auth/otp?uid=${encodeURIComponent(targetUid)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) {
          setIsMfaVerified(false);
          return false;
        }
        const data = await res.json();
        const verified = Boolean(data.verified);
        setIsMfaVerified(verified);
        return verified;
      } catch {
        setIsMfaVerified(false);
        return false;
      } finally {
        setIsMfaLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!auth) {
      setUserAuthState({
        user: null,
        isUserLoading: false,
        userError: new Error('Auth service not provided.'),
      });
      setIsMfaVerified(false);
      setIsMfaLoading(false);
      return;
    }

    setUserAuthState({ user: null, isUserLoading: true, userError: null });

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        if (firebaseUser?.isAnonymous) {
          // Anonymous authentication is disabled; clear any legacy anonymous session.
          try {
            await signOut(auth);
          } catch {
            // Ignore signOut error
          }
          setUserAuthState({ user: null, isUserLoading: false, userError: null });
          setIsMfaVerified(false);
          setIsMfaLoading(false);
          return;
        }

        setUserAuthState({
          user: firebaseUser,
          isUserLoading: false,
          userError: null,
        });

        if (firebaseUser) {
          await refreshMfaStatus(firebaseUser.uid);
        } else {
          setIsMfaVerified(false);
          setIsMfaLoading(false);
        }
      },
      (error) => {
        console.error('FirebaseProvider: onAuthStateChanged error:', error);
        setUserAuthState({ user: null, isUserLoading: false, userError: error });
        setIsMfaVerified(false);
        setIsMfaLoading(false);
      }
    );
    return () => unsubscribe();
  }, [auth, refreshMfaStatus]);

  const contextValue = useMemo((): FirebaseContextState => {
    const servicesAvailable = !!(firebaseApp && firestore && auth);
    return {
      areServicesAvailable: servicesAvailable,
      firebaseApp: servicesAvailable ? firebaseApp : null,
      firestore: servicesAvailable ? firestore : null,
      auth: servicesAvailable ? auth : null,
      user: userAuthState.user,
      isUserLoading: userAuthState.isUserLoading,
      userError: userAuthState.userError,
      isMfaVerified,
      isMfaLoading,
      setMfaVerified: setIsMfaVerified,
      refreshMfaStatus,
    };
  }, [
    firebaseApp,
    firestore,
    auth,
    userAuthState,
    isMfaVerified,
    isMfaLoading,
    refreshMfaStatus,
  ]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = (): FirebaseServicesAndUser => {
  const context = useContext(FirebaseContext);

  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }

  return {
    firebaseApp: context.firebaseApp,
    firestore: context.firestore,
    auth: context.auth,
    user: context.user,
    isUserLoading: context.isUserLoading,
    userError: context.userError,
    isMfaVerified: context.isMfaVerified,
    isMfaLoading: context.isMfaLoading,
    setMfaVerified: context.setMfaVerified,
    refreshMfaStatus: context.refreshMfaStatus,
  };
};

export const useAuth = (): Auth | null => {
  const { auth } = useFirebase();
  return auth;
};

export const useFirestore = (): Firestore | null => {
  const { firestore } = useFirebase();
  return firestore;
};

export const useFirebaseApp = (): FirebaseApp | null => {
  const { firebaseApp } = useFirebase();
  return firebaseApp;
};

type MemoFirebase<T> = T & { __memo?: boolean };

export function useMemoFirebase<T>(
  factory: () => T,
  deps: DependencyList
): T | MemoFirebase<T> {
  const memoized = useMemo(factory, deps);

  if (typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;

  return memoized;
}

export const useUser = (): UserHookResult => {
  const {
    user,
    isUserLoading,
    userError,
    isMfaVerified,
    isMfaLoading,
    setMfaVerified,
    refreshMfaStatus,
  } = useFirebase();
  return {
    user,
    isUserLoading,
    userError,
    isMfaVerified,
    isMfaLoading,
    setMfaVerified,
    refreshMfaStatus,
  };
};