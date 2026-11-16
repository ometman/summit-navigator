'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { format, parseISO } from 'date-fns';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  Loader2,
  LogIn,
  Printer,
  QrCode,
  RefreshCw,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirebase } from '@/firebase';
import { getVerifiedUserProfile } from '@/firebase/user-profile';
import { testFirestoreConnection } from '@/firebase/qa';
import {
  confirmSelfCheckIn,
  ensureAttendeePassDocument,
  subscribeToAttendeePass,
  type AttendeePassRecord,
} from '@/firebase/passes';
import {
  REGISTRATIONS_STORAGE_KEY,
  initialRegistrations,
  type RegistrationTrack,
  type UserRegistration,
} from '@/lib/registrations';
import type { SignedPassResponse, VerifyPassResponse } from '@/lib/pass-types';
import { useToast } from '@/hooks/use-toast';

function formatFriendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw) as { error?: string };
    if (parsed?.error) return parsed.error;
  } catch {
    // Plain error string
  }
  return raw || 'Unable to load digital attendee pass.';
}

async function syncRegistrationStatus(params: {
  email: string;
  fullName: string;
  organization: string;
  role: string;
  track: RegistrationTrack;
  status: 'Confirmed' | 'Checked In';
}) {
  try {
    await fetch('/api/registrations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch {
    // Non-blocking report sync
  }

  try {
    const raw = localStorage.getItem(REGISTRATIONS_STORAGE_KEY);
    const list = raw
      ? (JSON.parse(raw) as UserRegistration[])
      : [...initialRegistrations];
    const idx = list.findIndex(
      (r) => r.email.toLowerCase() === params.email.toLowerCase()
    );
    if (idx >= 0) {
      list[idx] = { ...list[idx], status: params.status };
    } else {
      list.unshift({
        id: `reg-${Date.now()}`,
        fullName: params.fullName,
        email: params.email,
        organization: params.organization,
        role: params.role,
        track: params.track,
        source: 'Web Registration',
        status: params.status,
        registeredAt: new Date().toISOString(),
      });
    }
    localStorage.setItem(REGISTRATIONS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage quota errors
  }
}

export function AttendeePassCard() {
  const { firestore, auth, user, isUserLoading, isMfaVerified, isMfaLoading } =
    useFirebase();
  const { toast } = useToast();

  const [signedPass, setSignedPass] = useState<SignedPassResponse | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [livePass, setLivePass] = useState<AttendeePassRecord | null>(null);

  const [isProvisioning, setIsProvisioning] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isFullyVerified = Boolean(
    user && !user.isAnonymous && user.emailVerified && isMfaVerified
  );

  // Test Firestore server connectivity on mount
  useEffect(() => {
    if (!firestore) return;
    void testFirestoreConnection(firestore);
  }, [firestore]);

  // Provision / sign QR credential and sync base pass document
  const provisionSignedPass = useCallback(async () => {
    if (!firestore || !user || !user.email || !isFullyVerified) return;

    setIsProvisioning(true);
    setErrorMsg(null);

    try {
      let fullName = user.displayName || user.email.split('@')[0] || 'Summit Attendee';
      let organization = 'Summit Attendee';
      let role = 'Ministry Lead';
      let track: RegistrationTrack = 'Morning & Afternoon';

      try {
        const profile = await getVerifiedUserProfile(firestore, auth, user.uid);
        if (profile) {
          fullName = profile.fullName || fullName;
          organization = profile.organization || organization;
          role = profile.role || role;
          track = profile.track || track;
        }
      } catch {
        // Fallback to auth displayName/defaults if profile not yet created
      }

      const signRes = await fetch('/api/passes/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          email: user.email,
          fullName,
          organization,
          role,
          track,
        }),
      });

      const signData = (await signRes.json()) as SignedPassResponse & {
        error?: string;
      };
      if (!signRes.ok || !signData.token) {
        throw new Error(signData.error || 'Failed to sign QR pass.');
      }

      const dataUrl = await QRCode.toDataURL(signData.token, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 320,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });

      setSignedPass(signData);
      setQrDataUrl(dataUrl);

      await ensureAttendeePassDocument(firestore, auth, {
        uid: user.uid,
        passCode: signData.passCode,
        email: user.email,
        fullName: signData.payload.fullName,
        organization: signData.payload.organization,
        role: signData.payload.role,
        track: signData.payload.track,
        mfaVerifiedAt: signData.payload.mfaVerifiedAt,
        qrSignatureDigest: signData.signatureDigest,
      });
    } catch (err) {
      setErrorMsg(formatFriendlyError(err));
    } finally {
      setIsProvisioning(false);
    }
  }, [firestore, auth, user, isFullyVerified]);

  useEffect(() => {
    if (!isUserLoading && !isMfaLoading && isFullyVerified) {
      void provisionSignedPass();
    }
  }, [isUserLoading, isMfaLoading, isFullyVerified, provisionSignedPass]);

  // Real-time Firestore listener on /attendeePasses/{uid}
  useEffect(() => {
    if (!firestore || !user || !isFullyVerified) {
      setLivePass(null);
      return;
    }

    const unsubscribe = subscribeToAttendeePass(
      firestore,
      auth,
      user.uid,
      (record) => {
        setLivePass(record);
      },
      (err) => {
        setErrorMsg(formatFriendlyError(err));
      }
    );

    return () => unsubscribe();
  }, [firestore, auth, user, isFullyVerified]);

  const handleSelfCheckIn = async () => {
    if (!firestore || !user || !signedPass || isCheckingIn) return;
    setIsCheckingIn(true);
    setErrorMsg(null);

    try {
      // Verify the cryptographic QR signature server-side before committing check-in
      const verifyRes = await fetch('/api/passes/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrPayload: signedPass.token }),
      });
      const verifyData = (await verifyRes.json()) as VerifyPassResponse;
      if (
        !verifyRes.ok ||
        !verifyData.valid ||
        verifyData.payload?.uid !== user.uid
      ) {
        throw new Error(
          verifyData.error || 'Pass signature verification failed.'
        );
      }

      await confirmSelfCheckIn(firestore, auth, user.uid);
      await syncRegistrationStatus({
        email: signedPass.payload.email,
        fullName: signedPass.payload.fullName,
        organization: signedPass.payload.organization,
        role: signedPass.payload.role,
        track: signedPass.payload.track,
        status: 'Checked In',
      });

      toast({
        title: 'Checked In on-site',
        description: `${signedPass.payload.fullName} is now marked Checked In.`,
      });
    } catch (err) {
      const msg = formatFriendlyError(err);
      setErrorMsg(msg);
      toast({
        variant: 'destructive',
        title: 'Self-check-in failed',
        description: msg,
      });
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleDownloadQrBadge = () => {
    if (!qrDataUrl || !signedPass) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `summit-pass-${signedPass.passCode.toLowerCase()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({
      title: 'QR badge downloaded',
      description: `Saved ${signedPass.passCode} QR code image.`,
    });
  };

  const handleCopyToken = async () => {
    if (!signedPass) return;
    try {
      await navigator.clipboard.writeText(signedPass.token);
      toast({
        title: 'Signed pass token copied',
        description: 'Ready to verify at the organizer check-in desk.',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Clipboard unavailable',
        description: 'Unable to copy pass token.',
      });
    }
  };

  if (isUserLoading || isMfaLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isFullyVerified) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 md:p-8 space-y-5">
        <div className="flex items-start gap-3.5">
          <div className="rounded-lg border border-border bg-muted/40 p-2.5 text-primary">
            <QrCode className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-foreground">
              MFA Verification Required for Digital Pass
            </h3>
            <p className="text-sm text-muted-foreground">
              {user && !isMfaVerified
                ? `Signed in as ${user.email}. Complete your 6-digit Email OTP verification to issue your cryptographically signed QR badge and enable instant check-in.`
                : 'Sign in with Google and verify your 6-digit Email OTP code to generate your signed Summit Navigator QR badge.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button asChild>
            <Link href="/login">
              <LogIn className="mr-2 h-4 w-4" />
              {user && !isMfaVerified
                ? 'Complete Email OTP Verification'
                : 'Sign In with Google'}
            </Link>
          </Button>
          {!user && (
            <Button asChild variant="outline">
              <Link href="/register">New Attendee Registration</Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  const displayStatus = livePass?.status ?? 'Confirmed';
  const isCheckedIn = displayStatus === 'Checked In';
  const passCode = livePass?.passCode ?? signedPass?.passCode ?? 'SMN-PENDING';
  const fullName =
    livePass?.fullName ?? signedPass?.payload.fullName ?? user?.displayName ?? 'Summit Attendee';
  const organization =
    livePass?.organization ?? signedPass?.payload.organization ?? 'Summit Attendee';
  const role = livePass?.role ?? signedPass?.payload.role ?? 'Ministry Lead';
  const track =
    livePass?.track ?? signedPass?.payload.track ?? 'Morning & Afternoon';
  const email = livePass?.email ?? signedPass?.payload.email ?? user?.email ?? '';

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Top Credential Header */}
      <div className="border-b border-border px-6 py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Summit Navigator · Signed Attendee Credential
          </p>
          <h3 className="text-xl font-bold tracking-tight text-foreground mt-0.5">
            {fullName}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{organization}</span>
            <span aria-hidden="true">·</span>
            <span>{role}</span>
            <span aria-hidden="true">·</span>
            <span>{track}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm font-semibold">
          {isCheckedIn ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Checked In
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-primary whitespace-nowrap">
              <UserCheck className="h-4 w-4 shrink-0" />
              Confirmed
            </span>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="px-6 pt-5">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Pass Error</AlertTitle>
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Main Split: QR Badge + Actions */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6 items-center">
        {/* High-contrast scannable QR surface */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-white p-4">
          {isProvisioning || !qrDataUrl ? (
            <Skeleton className="h-[220px] w-[220px] rounded-lg" />
          ) : (
            <img
              src={qrDataUrl}
              alt={`Signed QR pass for ${fullName}`}
              className="h-[220px] w-[220px] object-contain"
            />
          )}
          <div className="mt-3 text-center">
            <p className="font-mono text-sm font-bold tracking-wider text-slate-900 tabular-nums">
              {passCode}
            </p>
            {signedPass?.signatureDigest && (
              <p className="font-mono text-[11px] text-slate-500 tabular-nums mt-0.5">
                sig:{signedPass.signatureDigest}
              </p>
            )}
          </div>
        </div>

        {/* Details & Self-Check-In Controls */}
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Verified Account</p>
              <p className="font-medium text-foreground truncate">{email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">MFA Verification</p>
              <p className="font-medium text-foreground inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                Google + Email OTP
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Arrival Status</p>
              <p className="font-semibold text-foreground">{displayStatus}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Check-In Timestamp</p>
              <p className="font-mono text-xs text-foreground tabular-nums mt-0.5">
                {livePass?.checkedInAt
                  ? `${format(parseISO(livePass.checkedInAt), 'MMM d, yyyy · HH:mm:ss')} (${
                      livePass.checkInMethod === 'organizer_scan'
                        ? 'Organizer Scan'
                        : 'Self Check-In'
                    })`
                  : 'Awaiting arrival check-in'}
              </p>
            </div>
          </div>

          <div className="border-t border-border pt-4 flex flex-wrap items-center gap-2.5">
            {!isCheckedIn ? (
              <Button
                type="button"
                onClick={handleSelfCheckIn}
                disabled={isCheckingIn || isProvisioning || !signedPass}
                className="whitespace-nowrap shrink-0"
              >
                {isCheckingIn ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Confirming Arrival...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Confirm On-Site Check-In
                  </>
                )}
              </Button>
            ) : (
              <div className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400 pr-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                You are checked in for the summit
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadQrBadge}
              disabled={!qrDataUrl}
              className="whitespace-nowrap shrink-0"
            >
              <Download className="mr-1.5 h-4 w-4" />
              Download QR PNG
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyToken}
              disabled={!signedPass}
              className="whitespace-nowrap shrink-0"
            >
              <Copy className="mr-1.5 h-4 w-4" />
              Copy Signed Token
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void provisionSignedPass()}
              disabled={isProvisioning}
              className="whitespace-nowrap shrink-0 text-muted-foreground"
            >
              <RefreshCw className="mr-1.5 h-4 w-4" />
              Refresh
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => window.print()}
              className="whitespace-nowrap shrink-0 text-muted-foreground print:hidden"
            >
              <Printer className="mr-1.5 h-4 w-4" />
              Print
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
