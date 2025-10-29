'use client';
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { UserCredential } from 'firebase/auth';

/** Initiate email/password sign-up (non-blocking) and update profile. */
export function initiateEmailSignUp(authInstance: Auth, email: string, password: string, displayName: string): Promise<UserCredential> {
  const promise = createUserWithEmailAndPassword(authInstance, email, password)
    .then((userCredential) => {
      // Once the user is created, update their profile with the display name.
      if (userCredential.user) {
        return updateProfile(userCredential.user, { displayName })
          .then(() => userCredential); // Return the original credential after profile update.
      }
      return userCredential;
    });

  // The caller can choose to attach .then() or .catch() to this promise.
  return promise;
}


/** Initiate email/password sign-in (non-blocking). */
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string): Promise<UserCredential> {
    // CRITICAL: This returns a Promise that the caller can handle.
    return signInWithEmailAndPassword(authInstance, email, password);
}
