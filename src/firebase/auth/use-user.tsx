'use client';

import { useState, useEffect } from 'react';
import { Auth, User, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { useAuth } from '@/firebase/provider';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();
  const [state, setState] = useState<UserAuthResult>({
    user: auth.currentUser,
    isUserLoading: !auth.currentUser,
    userError: null,
  });

  useEffect(() => {
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
