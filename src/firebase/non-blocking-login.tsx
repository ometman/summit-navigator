'use client';
import {
  Auth,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';

/** Initiate anonymous sign-in (non-blocking). */
export function initiateAnonymousSignIn(authInstance: Auth): void {
  signInAnonymously(authInstance);
}

/** Initiate email/password sign-up (non-blocking). */
export function initiateEmailSignUp(authInstance: Auth, email: string, password: string, fullName: string): void {
  createUserWithEmailAndPassword(authInstance, email, password)
    .then(userCredential => {
      // After creating the user, update their profile with the full name.
      if (authInstance.currentUser) {
        return updateProfile(authInstance.currentUser, {
          displayName: fullName,
        });
      }
    })
    .catch(error => {
      // The useUser hook's onAuthStateChanged will handle the error state,
      // but we can log it here for debugging if needed.
      console.error("Sign up error:", error);
    });
}

/** Initiate email/password sign-in (non-blocking). */
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string): void {
  signInWithEmailAndPassword(authInstance, email, password);
}
