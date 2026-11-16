'use client';

import {
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type UserCredential,
} from 'firebase/auth';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

/** Sign in with Google popup (sole enabled Firebase auth provider). */
export async function signInWithGoogle(authInstance: Auth): Promise<UserCredential> {
  return signInWithPopup(authInstance, googleProvider);
}

/** Sign out of Firebase Auth. */
export async function signOutFirebase(authInstance: Auth): Promise<void> {
  return signOut(authInstance);
}
