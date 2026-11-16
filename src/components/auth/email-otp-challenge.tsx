'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, MailCheck, RefreshCw, ShieldCheck, AlertCircle } from 'lucide-react';

interface EmailOtpChallengeProps {
  uid: string;
  email: string;
  displayName: string;
  submitLabel?: string;
  autoSendOnMount?: boolean;
  onVerified: (verifiedAt: string) => Promise<void> | void;
  onSwitchAccount: () => Promise<void> | void;
}

export function EmailOtpChallenge({
  uid,
  email,
  displayName,
  submitLabel = 'Verify & Continue',
  autoSendOnMount = true,
  onVerified,
  onSwitchAccount,
}: EmailOtpChallengeProps) {
  const [code, setCode] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deliveryMode, setDeliveryMode] = useState<'resend' | 'smtp' | 'preview' | null>(null);
  const [previewOtp, setPreviewOtp] = useState<string | null>(null);
  const [expiresInSeconds, setExpiresInSeconds] = useState<number>(0);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const hasAutoSentRef = useRef(false);

  const sendOtp = useCallback(async () => {
    if (!uid || !email) return;
    setIsSending(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          uid,
          email,
          displayName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (typeof data.retryAfterSeconds === 'number') {
          setResendCooldown(data.retryAfterSeconds);
        }
        throw new Error(data.error || 'Could not send verification code.');
      }

      setDeliveryMode(data.deliveryMode || 'smtp');
      setPreviewOtp(data.previewOtp || null);
      setExpiresInSeconds(Number(data.expiresInSeconds || 300));
      setResendCooldown(30);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to send verification code.'
      );
    } finally {
      setIsSending(false);
    }
  }, [uid, email, displayName]);

  useEffect(() => {
    if (autoSendOnMount && !hasAutoSentRef.current && uid && email) {
      hasAutoSentRef.current = true;
      sendOtp();
    }
  }, [autoSendOnMount, uid, email, sendOtp]);

  useEffect(() => {
    if (expiresInSeconds <= 0 && resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setExpiresInSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresInSeconds, resendCooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = code.replace(/\D/g, '');
    if (cleaned.length !== 6) {
      setError('Enter the 6-digit verification code sent to your email.');
      return;
    }

    setIsVerifying(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          uid,
          email,
          code: cleaned,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.verified) {
        throw new Error(data.error || 'Verification failed.');
      }
      await onVerified(data.verifiedAt || new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid verification code.');
    } finally {
      setIsVerifying(false);
    }
  };

  const minutes = Math.floor(expiresInSeconds / 60);
  const seconds = expiresInSeconds % 60;
  const formattedCountdown = `${String(minutes).padStart(2, '0')}:${String(
    seconds
  ).padStart(2, '0')}`;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-1">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <MailCheck className="h-4 w-4 text-primary shrink-0" />
          <span>Multi-Factor Authentication</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{displayName || email}</span>{' '}
          <span aria-hidden="true">·</span> {email}
        </p>
        {expiresInSeconds > 0 && (
          <p className="text-xs text-muted-foreground tabular-nums">
            Code expires in {formattedCountdown}
          </p>
        )}
      </div>

      {deliveryMode === 'preview' && previewOtp && (
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Email delivery not configured</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3 mt-1">
            <span className="text-xs">
              Configure SMTP or Resend in your environment to send emails. Preview OTP:{' '}
              <strong className="font-mono text-sm tracking-widest tabular-nums">
                {previewOtp}
              </strong>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCode(previewOtp)}
              className="whitespace-nowrap shrink-0"
            >
              Use Code
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Verification Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleVerify} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="mfa-otp-code">6-Digit Email Verification Code</Label>
          <Input
            id="mfa-otp-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            disabled={isVerifying}
            autoFocus
            className="text-center font-mono text-xl tracking-[0.45em] tabular-nums h-12"
          />
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isVerifying || isSending || code.length !== 6}
        >
          {isVerifying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </form>

      <div className="flex items-center justify-between gap-2 pt-1 text-xs">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={sendOtp}
          disabled={isSending || resendCooldown > 0}
          className="px-2 h-8 text-xs tabular-nums"
        >
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isSending ? 'animate-spin' : ''}`} />
          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
        </Button>

        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={onSwitchAccount}
          disabled={isVerifying}
          className="px-2 h-8 text-xs text-muted-foreground"
        >
          Switch Google account
        </Button>
      </div>
    </div>
  );
}
