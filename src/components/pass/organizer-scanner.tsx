'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { format, parseISO } from 'date-fns';
import {
  AlertCircle,
  Camera,
  CameraOff,
  CheckCircle2,
  Loader2,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Upload,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useFirebase } from '@/firebase';
import { isBootstrappedAdminUser } from '@/firebase/qa';
import {
  checkInPassByOrganizer,
  revertPassCheckInByOrganizer,
  subscribeToAllAttendeePasses,
  type AttendeePassRecord,
} from '@/firebase/passes';
import {
  REGISTRATIONS_STORAGE_KEY,
  initialRegistrations,
  type RegistrationTrack,
  type UserRegistration,
} from '@/lib/registrations';
import type { VerifyPassResponse } from '@/lib/pass-types';
import { useToast } from '@/hooks/use-toast';

function formatFriendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw) as { error?: string };
    if (parsed?.error) return parsed.error;
  } catch {
    // Plain message
  }
  return raw || 'Unable to process check-in.';
}

async function syncRegistrationStore(params: {
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
    // Non-blocking sync
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
    // Ignore quota errors
  }
}

interface ScanOutcome {
  alreadyCheckedIn: boolean;
  record: AttendeePassRecord;
}

export function OrganizerScanner() {
  const { firestore, auth, user, isMfaVerified } = useFirebase();
  const { toast } = useToast();

  const [manualToken, setManualToken] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastOutcome, setLastOutcome] = useState<ScanOutcome | null>(null);

  // Camera scanner state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastDecodedRef = useRef<{ token: string; ts: number }>({
    token: '',
    ts: 0,
  });

  // Live check-in roster (available to bootstrapped admin)
  const isAdmin = isBootstrappedAdminUser(user);
  const [allPasses, setAllPasses] = useState<AttendeePassRecord[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraStarting(false);
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    if (!firestore || !isAdmin || !isMfaVerified) {
      setAllPasses([]);
      return;
    }

    setLoadingRoster(true);
    const unsubscribe = subscribeToAllAttendeePasses(
      firestore,
      auth,
      (items) => {
        setAllPasses(items);
        setLoadingRoster(false);
      },
      () => {
        setLoadingRoster(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, auth, isAdmin, isMfaVerified]);

  const verifyAndCheckInToken = useCallback(
    async (rawQrPayload: string) => {
      if (!firestore || !user || !isMfaVerified || isProcessing) return;

      const trimmed = rawQrPayload.trim();
      if (!trimmed) {
        setScanError('Enter or scan a valid signed QR pass token.');
        return;
      }

      setIsProcessing(true);
      setScanError(null);

      try {
        const verifyRes = await fetch('/api/passes/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ qrPayload: trimmed }),
        });
        const verifyData = (await verifyRes.json()) as VerifyPassResponse;

        if (!verifyRes.ok || !verifyData.valid || !verifyData.payload) {
          throw new Error(
            verifyData.error || 'QR pass signature verification failed.'
          );
        }

        const outcome = await checkInPassByOrganizer(firestore, auth, {
          payload: verifyData.payload,
          signatureDigest: verifyData.signatureDigest || 'verified00',
          organizerUid: user.uid,
        });

        setLastOutcome(outcome);
        setManualToken('');

        await syncRegistrationStore({
          email: outcome.record.email,
          fullName: outcome.record.fullName,
          organization: outcome.record.organization,
          role: outcome.record.role,
          track: outcome.record.track,
          status: 'Checked In',
        });

        toast({
          title: outcome.alreadyCheckedIn
            ? 'Already checked in'
            : 'Attendee checked in',
          description: `${outcome.record.fullName} (${outcome.record.passCode}) — ${outcome.record.status}.`,
        });
      } catch (err) {
        const msg = formatFriendlyError(err);
        setScanError(msg);
        toast({
          variant: 'destructive',
          title: 'Verification failed',
          description: msg,
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [firestore, auth, user, isMfaVerified, isProcessing, toast]
  );

  const startCamera = async () => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setScanError(
        'Camera access is unavailable in this browser. Upload a QR badge image or paste the signed token instead.'
      );
      return;
    }

    setCameraStarting(true);
    setScanError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const scanFrame = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || !streamRef.current) return;

        if (
          video.readyState === video.HAVE_ENOUGH_DATA &&
          video.videoWidth > 0 &&
          video.videoHeight > 0
        ) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(
              0,
              0,
              canvas.width,
              canvas.height
            );
            const decoded = jsQR(
              imageData.data,
              imageData.width,
              imageData.height,
              { inversionAttempts: 'dontInvert' }
            );
            if (decoded?.data) {
              const now = Date.now();
              if (
                decoded.data !== lastDecodedRef.current.token ||
                now - lastDecodedRef.current.ts > 4000
              ) {
                lastDecodedRef.current = { token: decoded.data, ts: now };
                stopCamera();
                void verifyAndCheckInToken(decoded.data);
                return;
              }
            }
          }
        }
        rafRef.current = requestAnimationFrame(scanFrame);
      };

      rafRef.current = requestAnimationFrame(scanFrame);
    } catch {
      stopCamera();
      setScanError(
        'Camera permission was denied or no camera was detected. Use Upload QR Image or paste the signed token below.'
      );
    } finally {
      setCameraStarting(false);
    }
  };

  const handleImageFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setScanError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setScanError('Unable to decode uploaded image.');
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(
          imageData.data,
          imageData.width,
          imageData.height,
          { inversionAttempts: 'attemptBoth' }
        );
        if (!code?.data) {
          setScanError(
            'No valid QR code found in the selected image. Ensure the QR badge is clear and uncropped.'
          );
          return;
        }
        void verifyAndCheckInToken(code.data);
      };
      img.onerror = () => {
        setScanError('Could not read the selected image file.');
      };
      if (typeof reader.result === 'string') {
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRevertCheckIn = async (record: AttendeePassRecord) => {
    if (!firestore) return;
    setIsProcessing(true);
    try {
      await revertPassCheckInByOrganizer(firestore, auth, record.uid);
      await syncRegistrationStore({
        email: record.email,
        fullName: record.fullName,
        organization: record.organization,
        role: record.role,
        track: record.track,
        status: 'Confirmed',
      });
      if (lastOutcome?.record.uid === record.uid) {
        setLastOutcome({
          alreadyCheckedIn: false,
          record: { ...record, status: 'Confirmed', checkInMethod: 'none', checkedInAt: '' },
        });
      }
      toast({
        title: 'Status reverted',
        description: `${record.fullName} returned to Confirmed.`,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Revert failed',
        description: formatFriendlyError(err),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const rosterMetrics = useMemo(() => {
    const checkedIn = allPasses.filter((p) => p.status === 'Checked In').length;
    const confirmed = allPasses.filter((p) => p.status === 'Confirmed').length;
    return {
      total: allPasses.length,
      checkedIn,
      confirmed,
    };
  }, [allPasses]);

  return (
    <div className="space-y-6">
      {/* Scanner Card */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
          <div>
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-primary" />
              Organizer QR Check-In Desk
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Scan an attendee&apos;s signed QR badge via camera, upload a badge image, or paste a signed pass token to flip status to Checked In.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!cameraActive ? (
              <Button
                type="button"
                size="sm"
                onClick={startCamera}
                disabled={cameraStarting || isProcessing}
                className="whitespace-nowrap shrink-0"
              >
                {cameraStarting ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="mr-1.5 h-4 w-4" />
                )}
                Start Camera Scan
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={stopCamera}
                className="whitespace-nowrap shrink-0"
              >
                <CameraOff className="mr-1.5 h-4 w-4" />
                Stop Camera
              </Button>
            )}

            <Label
              htmlFor="qr-upload-input"
              className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent hover:text-accent-foreground whitespace-nowrap shrink-0"
            >
              <Upload className="mr-1.5 h-4 w-4" />
              Scan Image File
              <input
                id="qr-upload-input"
                type="file"
                accept="image/*"
                onChange={handleImageFileUpload}
                className="sr-only"
              />
            </Label>
          </div>
        </div>

        {/* Live Camera Viewport */}
        {cameraActive && (
          <div className="relative mx-auto max-w-md overflow-hidden rounded-xl border border-border bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full aspect-[4/3] object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-44 w-44 rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
          </div>
        )}

        {/* Manual / Hardware Barcode Scanner Token Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verifyAndCheckInToken(manualToken);
          }}
          className="flex flex-col sm:flex-row gap-2.5"
        >
          <Input
            type="text"
            placeholder="Paste signed pass token (SMNP1:...) or scan with USB/Bluetooth QR reader"
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            disabled={isProcessing}
            className="font-mono text-xs"
          />
          <Button
            type="submit"
            disabled={isProcessing || !manualToken.trim()}
            className="whitespace-nowrap shrink-0"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Verify &amp; Check In
              </>
            )}
          </Button>
        </form>

        {scanError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Check-In Rejected</AlertTitle>
            <AlertDescription>{scanError}</AlertDescription>
          </Alert>
        )}

        {/* Last Scanned Result */}
        {lastOutcome && (
          <div className="rounded-lg border border-border bg-muted/20 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                {lastOutcome.record.status === 'Checked In' ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    {lastOutcome.alreadyCheckedIn
                      ? 'Already Checked In'
                      : 'Checked In'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-primary">
                    <UserCheck className="h-4 w-4 shrink-0" />
                    Confirmed
                  </span>
                )}
                <span aria-hidden="true" className="text-muted-foreground">
                  ·
                </span>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {lastOutcome.record.passCode}
                </span>
              </div>
              <p className="text-base font-bold text-foreground">
                {lastOutcome.record.fullName}
              </p>
              <p className="text-xs text-muted-foreground">
                {lastOutcome.record.organization} · {lastOutcome.record.role} ·{' '}
                {lastOutcome.record.track}
              </p>
            </div>

            {lastOutcome.record.status === 'Checked In' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isProcessing}
                onClick={() => handleRevertCheckIn(lastOutcome.record)}
                className="whitespace-nowrap shrink-0 self-start sm:self-center"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Revert to Confirmed
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Live Firestore Check-In Roster (Bootstrapped Admin) */}
      {isAdmin && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground">
                Live Attendee Pass Roster
              </h3>
              <p className="text-xs text-muted-foreground">
                Real-time Firestore sync across all digital passes.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {rosterMetrics.checkedIn} Checked In
              </span>
              <span aria-hidden="true">·</span>
              <span>{rosterMetrics.confirmed} Confirmed</span>
              <span aria-hidden="true">·</span>
              <span>{rosterMetrics.total} Total</span>
            </div>
          </div>

          {loadingRoster ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : allPasses.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-8 px-4 text-center text-xs text-muted-foreground">
              No digital attendee passes provisioned yet. Verified attendees appear here automatically when they open their pass.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pass ID</TableHead>
                  <TableHead>Attendee</TableHead>
                  <TableHead>Track</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Check-In Time</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allPasses.map((pass) => (
                  <TableRow key={pass.uid}>
                    <TableCell className="font-mono text-xs tabular-nums whitespace-nowrap">
                      {pass.passCode}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium text-foreground">
                        {pass.fullName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {pass.organization}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-foreground">
                      {pass.track}
                    </TableCell>
                    <TableCell>
                      {pass.status === 'Checked In' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          Checked In
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary whitespace-nowrap">
                          <UserCheck className="h-3.5 w-3.5 shrink-0" />
                          Confirmed
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {pass.checkedInAt
                        ? format(parseISO(pass.checkedInAt), 'MMM d · HH:mm:ss')
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {pass.status === 'Confirmed' ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isProcessing}
                          onClick={async () => {
                            if (!firestore || !user) return;
                            setIsProcessing(true);
                            try {
                              await checkInPassByOrganizer(firestore, auth, {
                                payload: {
                                  v: 1,
                                  type: 'summit_pass',
                                  uid: pass.uid,
                                  passCode: pass.passCode,
                                  email: pass.email,
                                  fullName: pass.fullName,
                                  organization: pass.organization,
                                  role: pass.role,
                                  track: pass.track,
                                  mfaVerifiedAt: pass.mfaVerifiedAt,
                                  issuedAt: pass.createdAtMs,
                                  exp: Date.now() + 86400000,
                                },
                                signatureDigest: pass.qrSignatureDigest,
                                organizerUid: user.uid,
                              });
                              await syncRegistrationStore({
                                email: pass.email,
                                fullName: pass.fullName,
                                organization: pass.organization,
                                role: pass.role,
                                track: pass.track,
                                status: 'Checked In',
                              });
                              toast({
                                title: 'Attendee checked in',
                                description: `${pass.fullName} marked Checked In.`,
                              });
                            } catch (err) {
                              toast({
                                variant: 'destructive',
                                title: 'Check-in failed',
                                description: formatFriendlyError(err),
                              });
                            } finally {
                              setIsProcessing(false);
                            }
                          }}
                          className="h-7 px-2.5 text-xs whitespace-nowrap"
                        >
                          Check In
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isProcessing}
                          onClick={() => handleRevertCheckIn(pass)}
                          className="h-7 px-2.5 text-xs text-muted-foreground whitespace-nowrap"
                        >
                          Undo
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}
