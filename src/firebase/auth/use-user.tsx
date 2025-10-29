'use client';

import { useState, useEffect } from 'react';
import { Auth, User, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { useAuth } from '@/firebase/provider';

export interface UserAuthResult {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

/**
 * Hook for accessing the authenticated user's state and ensuring anonymous sign-in.
 */
export function useUser(): UserAuthResult {
  const auth = useAuth();
  const [state, setState] = useState<UserAuthResult>(() => {
    // Initialize state synchronously to avoid flash of unauthenticated content
    const user = auth?.currentUser;
    return {
      user: user || null,
      isUserLoading: !user,
      userError: null
    };
  });

  useEffect(() => {
    if (!auth) {
        setState({ user: null, isUserLoading: false, userError: new Error("Auth service not available.") });
        return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (user) {
          setState({ user, isUserLoading: false, userError: null });
        } else {
          // If no user, attempt anonymous sign-in
          try {
            const userCredential = await signInAnonymously(auth);
            setState({ user: userCredential.user, isUserLoading: false, userError: null });
          } catch (error) {
            console.error("Anonymous sign-in failed:", error);
            setState({ user: null, isUserLoading: false, userError: error as Error });
          }
        }
      },
      (error) => {
        console.error("Auth state change error:", error);
        setState({ user: null, isUserLoading: false, userError: error });
      }
    );

    return () => unsubscribe();
  }, [auth]);

  return state;
}
