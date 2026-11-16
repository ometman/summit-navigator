'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, AlertCircle, Loader2, LogIn, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { EmailOtpChallenge } from '@/components/auth/email-otp-challenge';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { signInWithGoogle, signOutFirebase } from '@/firebase/non-blocking-login';
import { saveVerifiedUserProfile } from '@/firebase/user-profile';
import { upsertRegistrationRecord } from '@/firebase/admin-content';
import { useToast } from '@/hooks/use-toast';
import {
  REGISTRATIONS_STORAGE_KEY,
  initialRegistrations,
  mergeRegistrations,
  type RegistrationTrack,
  type UserRegistration,
} from '@/lib/registrations';

const registerSchema = z.object({
  fullName: z.string().min(2, { message: 'Full name must be at least 2 characters.' }).max(120),
  organization: z.string().min(2, { message: 'Organization is required.' }).max(150),
  role: z.enum([
    'Senior Pastor',
    'Ministry Lead',
    'Operations & Strategy',
    'Youth & Outreach',
    'Volunteer Coordinator',
  ]),
  track: z.enum(['Morning & Afternoon', 'Morning Track', 'Afternoon Track']),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

function formatGoogleError(error: any): string {
  const code = error?.code || '';
  if (code === 'auth/popup-closed-by-user') {
    return 'Google sign-in popup was closed before finishing.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Popups were blocked by your browser. Please allow popups and try again.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Google Sign-In is not enabled in Firebase Authentication.';
  }
  return error?.message || 'Unable to connect your Google account.';
}

export default function RegisterPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading, isMfaVerified, isMfaLoading, setMfaVerified } =
    useUser();

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [pendingProfile, setPendingProfile] = useState<RegisterFormValues | null>(
    null
  );

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      organization: '',
      role: 'Ministry Lead',
      track: 'Morning & Afternoon',
    },
  });

  useEffect(() => {
    if (user?.displayName && !form.getValues('fullName')) {
      form.setValue('fullName', user.displayName);
    }
  }, [user?.displayName, form]);

  useEffect(() => {
    if (!isUserLoading && !isMfaLoading && user && !user.isAnonymous && isMfaVerified) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, isMfaLoading, isMfaVerified, router]);

  const handleGoogleConnect = async () => {
    if (!auth) {
      setAuthError('Firebase authentication is not configured.');
      return;
    }
    setIsGoogleLoading(true);
    setAuthError(null);
    try {
      const cred = await signInWithGoogle(auth);
      if (cred.user.displayName) {
        form.setValue('fullName', cred.user.displayName);
      }
    } catch (error: any) {
      setAuthError(formatGoogleError(error));
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
    setPendingProfile(null);
    setAuthError(null);
  };

  const handleProfileSubmit = (values: RegisterFormValues) => {
    setPendingProfile(values);
  };

  const handleOtpVerified = async (verifiedAt: string) => {
    if (!user || !pendingProfile) return;
    const email = user.email || '';

    if (firestore && email) {
      try {
        await saveVerifiedUserProfile(firestore, auth, {
          uid: user.uid,
          fullName: pendingProfile.fullName,
          email,
          organization: pendingProfile.organization,
          role: pendingProfile.role,
          track: pendingProfile.track as RegistrationTrack,
          mfaVerifiedAt: verifiedAt,
        });
      } catch (err) {
        console.warn('Firestore profile write failed:', err);
      }
    }

    try {
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: pendingProfile.fullName,
          email,
          organization: pendingProfile.organization,
          role: pendingProfile.role,
          track: pendingProfile.track,
          source: 'Web Registration',
          status: 'Confirmed',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const created = data.registration as UserRegistration;
        if (firestore && email) {
          try {
            await upsertRegistrationRecord(firestore, auth, created, '');
          } catch (syncErr) {
            console.warn('Firestore registration record sync failed:', syncErr);
          }
        }
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
      // Non-blocking report logging
    }

    setMfaVerified(true);
    toast({
      title: 'Registration complete',
      description: `${pendingProfile.fullName} is verified and added to the registration report.`,
    });
    router.push('/dashboard/registrations');
  };

  const step = !user || user.isAnonymous ? 1 : !pendingProfile ? 2 : 3;

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
              {step === 1
                ? 'Step 1 of 3 · Google Identity'
                : step === 2
                ? 'Step 2 of 3 · Attendee Details'
                : 'Step 3 of 3 · Email OTP Verification'}
            </p>
            <CardTitle className="text-2xl">
              {step === 1
                ? 'Register for Summit Navigator'
                : step === 2
                ? 'Complete Your Attendee Profile'
                : 'Verify Your Email'}
            </CardTitle>
            <CardDescription>
              {step === 1
                ? 'Connect your Google account to start summit registration.'
                : step === 2
                ? 'Confirm your ministry details before verifying your email via OTP.'
                : 'Enter the 6-digit verification code sent to your email to activate your registration.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {authError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Registration Error</AlertTitle>
                <AlertDescription>{authError}</AlertDescription>
              </Alert>
            )}

            {isUserLoading || isMfaLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading account state...
              </div>
            ) : step === 1 ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/30 p-3.5 text-xs text-muted-foreground flex items-start gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>
                    Registration uses Google Sign-In paired with a 6-digit Email OTP verification code.
                  </span>
                </div>
                <Button
                  type="button"
                  onClick={handleGoogleConnect}
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
            ) : step === 2 && user ? (
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleProfileSubmit)}
                  className="space-y-4"
                >
                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    Google email: <span className="font-medium text-foreground">{user.email}</span>
                  </div>

                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="organization"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Organization / Ministry</FormLabel>
                        <FormControl>
                          <Input placeholder="Grace Community Church" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ministry Role</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Senior Pastor">Senior Pastor</SelectItem>
                              <SelectItem value="Ministry Lead">Ministry Lead</SelectItem>
                              <SelectItem value="Operations & Strategy">
                                Operations &amp; Strategy
                              </SelectItem>
                              <SelectItem value="Youth & Outreach">
                                Youth &amp; Outreach
                              </SelectItem>
                              <SelectItem value="Volunteer Coordinator">
                                Volunteer Coordinator
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="track"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Session Track</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Morning & Afternoon">
                                Morning &amp; Afternoon
                              </SelectItem>
                              <SelectItem value="Morning Track">Morning Track</SelectItem>
                              <SelectItem value="Afternoon Track">
                                Afternoon Track
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleSwitchAccount}
                      className="text-xs text-muted-foreground"
                    >
                      Switch account
                    </Button>
                    <Button type="submit">Send Email OTP</Button>
                  </div>
                </form>
              </Form>
            ) : user?.email ? (
              <EmailOtpChallenge
                uid={user.uid}
                email={user.email}
                displayName={pendingProfile?.fullName || user.displayName || user.email}
                submitLabel="Verify Code & Complete Registration"
                autoSendOnMount={true}
                onVerified={handleOtpVerified}
                onSwitchAccount={handleSwitchAccount}
              />
            ) : null}

            <div className="pt-2 text-center text-sm text-muted-foreground">
              Already registered?{' '}
              <Link href="/login" className="font-medium text-foreground underline">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
