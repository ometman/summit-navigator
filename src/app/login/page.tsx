'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, AlertCircle, Loader2, LogIn, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { EmailOtpChallenge } from '@/components/auth/email-otp-challenge';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { signInWithGoogle, signOutFirebase } from '@/firebase/non-blocking-login';
import { saveVerifiedUserProfile } from '@/firebase/user-profile';
import {
  REGISTRATIONS_STORAGE_KEY,
  initialRegistrations,
  mergeRegistrations,
  type UserRegistration,
} from '@/lib/registrations';
import { useToast } from '@/hooks/use-toast';

function formatAuthError(error: any): string {
  const code = error?.code || '';
  if (code === 'auth/popup-closed-by-user') {
    return 'Google sign-in popup was closed before completing login.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Popups were blocked by your browser. Please allow popups and try again.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'This domain is not authorized for Firebase Google Sign-In.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Google Sign-In is not enabled in Firebase Authentication.';
  }
  return error?.message || 'Unable to sign in with Google. Please try again.';
}

export default function LoginPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading, isMfaVerified, isMfaLoading, setMfaVerified } =
    useUser();

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!isUserLoading && !isMfaLoading && user && !user.isAnonymous && isMfaVerified) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, isMfaLoading, isMfaVerified, router]);

  const handleGoogleSignIn = async () => {
    if (!auth) {
      setAuthError('Firebase authentication is not configured.');
      return;
    }
    setIsGoogleLoading(true);
    setAuthError(null);
    try {
      await signInWithGoogle(auth);
      // Auth state updates automatically via onAuthStateChanged, transitioning to Step 2 (Email OTP MFA)
    } catch (error: any) {
      setAuthError(formatAuthError(error));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSwitchAccount = async () => {
    try {
      await fetch('/api/auth/otp', { method: 'DELETE' });
    } catch {
      // Ignore cookie clear errors
    }
    if (auth) {
      await signOutFirebase(auth);
    }
    setMfaVerified(false);
    setAuthError(null);
  };

  const handleMfaVerified = async (verifiedAt: string) => {
    if (!user) return;
    const fullName = user.displayName || user.email?.split('@')[0] || 'Summit Attendee';
    const email = user.email || '';

    if (firestore && email) {
      try {
        await saveVerifiedUserProfile(firestore, auth, {
          uid: user.uid,
          fullName,
          email,
          organization: 'Summit Attendee',
          role: 'Ministry Lead',
          track: 'Morning & Afternoon',
          mfaVerifiedAt: verifiedAt,
        });
      } catch (err) {
        console.warn('Firestore profile sync skipped:', err);
      }
    }

    if (email) {
      try {
        const res = await fetch('/api/registrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName,
            email,
            organization: 'Google MFA Sign-In',
            role: 'Ministry Lead',
            track: 'Morning & Afternoon',
            source: 'Web Registration',
            status: 'Confirmed',
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const created = data.registration as UserRegistration;
          try {
            const raw = localStorage.getItem(REGISTRATIONS_STORAGE_KEY);
            const existing = raw
              ? (JSON.parse(raw) as UserRegistration[])
              : initialRegistrations;
            localStorage.setItem(
              REGISTRATIONS_STORAGE_KEY,
              JSON.stringify(mergeRegistrations([created], existing))
            );
          } catch {
            // Ignore storage quota errors
          }
        }
      } catch {
        // Non-blocking registration sync
      }
    }

    setMfaVerified(true);
    toast({
      title: 'Verification complete',
      description: `Welcome back, ${fullName}.`,
    });
    router.push('/dashboard');
  };

  const showMfaStep = Boolean(user && !user.isAnonymous && !isMfaVerified);

  return (
    <>
      <div className="mb-6">
        <Button variant="outline" asChild>
          <Link href="/">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-center py-6">
        <Card className="mx-auto max-w-md w-full border border-border">
          <CardHeader className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              {showMfaStep
                ? 'Step 2 of 2 · Email OTP Verification'
                : 'Step 1 of 2 · Google Authentication'}
            </p>
            <CardTitle className="text-2xl">
              {showMfaStep ? 'Verify Your Email' : 'Sign In to Summit Navigator'}
            </CardTitle>
            <CardDescription>
              {showMfaStep
                ? 'Enter the 6-digit one-time passcode sent to your Google email address.'
                : 'Sign in with your Google account, then verify a one-time code sent to your email.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {authError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Sign-In Failed</AlertTitle>
                <AlertDescription>{authError}</AlertDescription>
              </Alert>
            )}

            {isUserLoading || isMfaLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking authentication status...
              </div>
            ) : showMfaStep && user?.email ? (
              <EmailOtpChallenge
                uid={user.uid}
                email={user.email}
                displayName={user.displayName || user.email}
                submitLabel="Verify & Complete Login"
                autoSendOnMount={true}
                onVerified={handleMfaVerified}
                onSwitchAccount={handleSwitchAccount}
              />
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/30 p-3.5 text-xs text-muted-foreground flex items-start gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>
                    Multi-factor authentication is required. After signing in with Google, a 6-digit OTP will be sent to your email.
                  </span>
                </div>

                <Button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading}
                  className="w-full h-11"
                >
                  {isGoogleLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting to Google...
                    </>
                  ) : (
                    <>
                      <LogIn className="mr-2 h-4 w-4" />
                      Continue with Google
                    </>
                  )}
                </Button>
              </div>
            )}

            <div className="pt-2 text-center text-sm text-muted-foreground">
              New attendee?{' '}
              <Link href="/register" className="font-medium text-foreground underline">
                Register with Google
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
