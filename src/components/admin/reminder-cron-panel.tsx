'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  Play,
  Send,
  Server,
} from 'lucide-react';
import { useFirebase } from '@/firebase';
import {
  recordReminderDispatchResult,
  subscribeToAllDispatchLogs,
  subscribeToAllReminderSubscriptions,
  type ReminderDispatchLogRecord,
  type ReminderSubscriptionRecord,
} from '@/firebase/action-plan';
import {
  evaluateSubscriptionDueStatus,
  type DigestDeliveryMode,
  type DigestDispatchStatus,
} from '@/lib/reminder-cron';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface CronHealthStatus {
  cronSecretConfigured: boolean;
  serviceAccountConfigured: boolean;
  adminCredentialSource?: string;
  mailTransportConfigured: boolean;
  mailTransportMode: DigestDeliveryMode;
}

export function ReminderCronPanel({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const { firestore, auth, user } = useFirebase();
  const { toast } = useToast();

  const [subs, setSubs] = useState<ReminderSubscriptionRecord[]>([]);
  const [logs, setLogs] = useState<ReminderDispatchLogRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [cronHealth, setCronHealth] = useState<CronHealthStatus | null>(null);
  const [ignoreDayMatch, setIgnoreDayMatch] = useState(false);
  const [forceDispatchAll, setForceDispatchAll] = useState(false);
  const [isRunningBatch, setIsRunningBatch] = useState(false);
  const [sendingUid, setSendingUid] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const checkStatus = async () => {
      try {
        const headers: Record<string, string> = {};
        if (user) {
          const idToken = await user.getIdToken();
          headers.Authorization = `Bearer ${idToken}`;
        }
        const res = await fetch('/api/reminders/cron?status=1', { headers });
        if (!res.ok) return;
        const data = (await res.json()) as CronHealthStatus;
        if (!cancelled) setCronHealth(data);
      } catch {
        // Non-blocking status probe
      }
    };
    void checkStatus();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!firestore || !isSuperAdmin) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setStreamError(null);

    const unsubSubs = subscribeToAllReminderSubscriptions(
      firestore,
      auth,
      (records) => {
        setSubs(records);
        setIsLoading(false);
      },
      (err) => {
        setStreamError(err.message);
        setIsLoading(false);
      }
    );

    const unsubLogs = subscribeToAllDispatchLogs(
      firestore,
      auth,
      (records) => {
        setLogs(records);
      },
      (err) => {
        setStreamError((prev) => prev || err.message);
      }
    );

    return () => {
      unsubSubs();
      unsubLogs();
    };
  }, [firestore, auth, isSuperAdmin]);

  const evaluatedSubs = useMemo(() => {
    const now = new Date();
    return subs.map((sub) => ({
      sub,
      evaluation: evaluateSubscriptionDueStatus(sub, now, {
        force: forceDispatchAll,
        ignoreDayMatch,
      }),
    }));
  }, [subs, forceDispatchAll, ignoreDayMatch]);

  const metrics = useMemo(() => {
    let enabledEmailSubs = 0;
    let dueNow = 0;
    let totalOverdue = 0;
    for (const entry of evaluatedSubs) {
      if (
        entry.sub.enabled &&
        entry.sub.preferredChannel !== 'dashboard_banner'
      ) {
        enabledEmailSubs += 1;
      }
      if (entry.evaluation.isDue) dueNow += 1;
      totalOverdue += entry.sub.overdueCount;
    }
    return {
      totalSubs: subs.length,
      enabledEmailSubs,
      dueNow,
      totalOverdue,
      dispatchCount: logs.length,
    };
  }, [evaluatedSubs, subs.length, logs.length]);

  const dispatchSingleSubscriber = async (sub: ReminderSubscriptionRecord) => {
    if (!firestore || !user) return null;
    const idToken = await user.getIdToken();
    const res = await fetch('/api/reminders/send-digest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        uid: sub.uid,
        recipientEmail: sub.email,
        recipientName: sub.displayName,
        churchName: sub.churchName,
        defaultDepartment: sub.defaultDepartment,
        cadence: sub.cadence,
        reminderDay: sub.reminderDay,
        openCount: sub.openCount,
        completedCount: sub.completedCount,
        overdueCount: sub.overdueCount,
        dueSoonCount: sub.dueSoonCount,
        topOpenTitles: sub.topOpenTitles,
        triggerSource: 'admin_console',
      }),
    });

    const data = (await res.json()) as {
      error?: string;
      deliveryMode?: DigestDeliveryMode;
      status?: DigestDispatchStatus;
      subject?: string;
      sentAtIso?: string;
    };

    if (!res.ok) {
      await recordReminderDispatchResult(firestore, auth, {
        uid: sub.uid,
        recipientEmail: sub.email,
        recipientName: sub.displayName,
        churchName: sub.churchName,
        cadence: sub.cadence,
        reminderDay: sub.reminderDay,
        triggerSource: 'admin_console',
        deliveryMode: cronHealth?.mailTransportMode || 'preview',
        status: 'failed',
        openCount: sub.openCount,
        overdueCount: sub.overdueCount,
        dueSoonCount: sub.dueSoonCount,
        subject: `Summit Navigator Accountability Digest · ${sub.churchName}`,
        sentAtIso: new Date().toISOString(),
        errorMessage: data.error || 'Dispatch request failed',
        updateSubscriptionTimestamp: false,
      });
      throw new Error(data.error || 'Dispatch failed');
    }

    await recordReminderDispatchResult(firestore, auth, {
      uid: sub.uid,
      recipientEmail: sub.email,
      recipientName: sub.displayName,
      churchName: sub.churchName,
      cadence: sub.cadence,
      reminderDay: sub.reminderDay,
      triggerSource: 'admin_console',
      deliveryMode: data.deliveryMode || 'preview',
      status: data.status || 'preview',
      openCount: sub.openCount,
      overdueCount: sub.overdueCount,
      dueSoonCount: sub.dueSoonCount,
      subject:
        data.subject ||
        `Summit Navigator Accountability Digest · ${sub.churchName}`,
      sentAtIso: data.sentAtIso || new Date().toISOString(),
      updateSubscriptionTimestamp: true,
    });

    return data;
  };

  const handleRunDueBatch = async () => {
    if (!firestore || !user || !isSuperAdmin) return;
    setIsRunningBatch(true);
    try {
      // Attempt server-side Admin SDK cron route first if service account/ADC is active
      if (cronHealth?.serviceAccountConfigured) {
        const idToken = await user.getIdToken();
        const serverRes = await fetch('/api/reminders/cron', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            force: forceDispatchAll,
            ignoreDayMatch,
          }),
        });
        if (serverRes.ok) {
          const payload = (await serverRes.json()) as {
            sentCount?: number;
            previewCount?: number;
            skippedCount?: number;
          };
          toast({
            title: 'Server cron batch completed',
            description: `Sent: ${payload.sentCount ?? 0} · Preview: ${payload.previewCount ?? 0} · Skipped: ${payload.skippedCount ?? 0}`,
          });
          return;
        }
      }

      // Admin-verified fallback batch dispatch writing directly to Firestore audit logs
      const dueList = evaluatedSubs
        .filter((e) => e.evaluation.isDue && e.sub.email)
        .map((e) => e.sub);

      if (dueList.length === 0) {
        toast({
          title: 'No digest emails currently due',
          description:
            'Enable "Include off-schedule / force dispatch" to test sending immediately.',
        });
        return;
      }

      let delivered = 0;
      let failed = 0;
      for (const target of dueList) {
        try {
          await dispatchSingleSubscriber(target);
          delivered += 1;
        } catch {
          failed += 1;
        }
      }

      toast({
        title: `Dispatched ${delivered} accountability digest${delivered === 1 ? '' : 's'}`,
        description:
          failed > 0
            ? `${failed} failed — see audit log below.`
            : 'All due subscriptions updated with next scheduled due date.',
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Batch run failed',
        description:
          err instanceof Error ? err.message : 'Unable to execute cron batch.',
      });
    } finally {
      setIsRunningBatch(false);
    }
  };

  const handleSendOne = async (sub: ReminderSubscriptionRecord) => {
    setSendingUid(sub.uid);
    try {
      const result = await dispatchSingleSubscriber(sub);
      toast({
        title:
          result?.deliveryMode === 'preview'
            ? `Preview digest logged for ${sub.displayName}`
            : `Digest emailed to ${sub.email}`,
        description: result?.subject || sub.churchName,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Failed to send digest',
        description:
          err instanceof Error ? err.message : 'Unexpected delivery error.',
      });
    } finally {
      setSendingUid(null);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 space-y-2">
        <h3 className="text-base font-bold text-foreground">
          Primary Organizer Access Required
        </h3>
        <p className="text-sm text-muted-foreground">
          Cross-organization reminder subscriptions contain attendee emails and
          are restricted in Firestore security rules to the primary summit
          administrator (`stackvarsity@gmail.com`) or backend cron service
          account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Scheduler Readiness & Controls */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between border-b pb-4">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <span>Automated Outbound Reminder Email Cron</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Monitors offline attendees&apos; weekly, bi-weekly, and monthly
              digest schedules synced from their 30/60/90-day Action Plans.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleRunDueBatch}
              disabled={isRunningBatch || isLoading}
            >
              {isRunningBatch ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-1.5 h-4 w-4" />
              )}
              Run Due Digest Batch ({metrics.dueNow})
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">
              Synced Subscribers
            </p>
            <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">
              {isLoading ? '—' : metrics.totalSubs}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">
              Email Digest Enabled
            </p>
            <p className="mt-1 text-2xl font-bold text-primary tabular-nums">
              {isLoading ? '—' : metrics.enabledEmailSubs}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">
              Due for Dispatch Now
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-700 tabular-nums">
              {isLoading ? '—' : metrics.dueNow}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">
              Logged Dispatches
            </p>
            <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">
              {isLoading ? '—' : metrics.dispatchCount}
            </p>
          </div>
        </div>

        {/* Batch Scope Toggles & Server Endpoint Readiness */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-background p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Batch Dispatch Options
            </p>
            <label className="flex items-center gap-2.5 text-sm cursor-pointer">
              <Checkbox
                checked={ignoreDayMatch}
                onCheckedChange={(v) => setIgnoreDayMatch(Boolean(v))}
              />
              <span>
                Ignore preferred weekday filter (include subscribers whose
                cadence interval elapsed regardless of day)
              </span>
            </label>
            <label className="flex items-center gap-2.5 text-sm cursor-pointer">
              <Checkbox
                checked={forceDispatchAll}
                onCheckedChange={(v) => setForceDispatchAll(Boolean(v))}
              />
              <span>
                Force dispatch all enabled email subscribers (bypass cadence
                cooldown for testing)
              </span>
            </label>
          </div>

          <div className="rounded-lg border border-border bg-background p-4 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-semibold uppercase tracking-wide text-muted-foreground">
              <Server className="h-3.5 w-3.5 text-primary" />
              <span>Offline Cron &amp; Mail Transport Readiness</span>
            </div>
            <p className="text-muted-foreground">
              Scheduled endpoint:{' '}
              <code className="font-mono text-foreground">
                POST /api/reminders/cron
              </code>{' '}
              &amp; Cloud Function{' '}
              <code className="font-mono text-foreground">
                scheduledAccountabilityDigest
              </code>
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-foreground tabular-nums">
              <span>
                Mail Transport:{' '}
                <strong>
                  {cronHealth?.mailTransportConfigured
                    ? cronHealth.mailTransportMode.toUpperCase()
                    : 'Preview Mode (set RESEND_API_KEY or SMTP_*)'}
                </strong>
              </span>
              <span>·</span>
              <span>
                Cron Secret:{' '}
                <strong>
                  {cronHealth?.cronSecretConfigured ? 'Configured' : 'Optional / Unset'}
                </strong>
              </span>
              <span>·</span>
              <span>
                Admin Credentials:{' '}
                <strong>
                  {cronHealth?.serviceAccountConfigured
                    ? 'Service Account JSON'
                    : cronHealth?.adminCredentialSource || 'ADC'}
                </strong>
              </span>
            </div>
          </div>
        </div>

        {streamError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Subscription Stream Notice</AlertTitle>
            <AlertDescription>{streamError}</AlertDescription>
          </Alert>
        )}
      </section>

      {/* Subscriber Table */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-base font-bold text-foreground">
              Synced Action Plan Digest Subscribers
            </h4>
            <p className="text-xs text-muted-foreground">
              Automatically kept in sync as verified attendees update their
              milestones or reminder cadence.
            </p>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : evaluatedSubs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No attendees have synced an Action Plan reminder subscription yet.
            Visit <strong>/action-plan</strong> to initialize your plan and
            watch it appear here in real time.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Attendee &amp; Church</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Milestones</TableHead>
                  <TableHead>Cron Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evaluatedSubs.map(({ sub, evaluation }) => {
                  const busy = sendingUid === sub.uid;
                  return (
                    <TableRow key={sub.uid}>
                      <TableCell>
                        <p className="font-semibold text-foreground text-sm">
                          {sub.displayName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {sub.email} · {sub.churchName}
                        </p>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        <p className="font-medium text-foreground capitalize">
                          {sub.cadence} · {sub.reminderDay}s
                        </p>
                        <p>
                          Channel: {sub.preferredChannel} · Next:{' '}
                          {sub.nextDueAtIso}
                        </p>
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">
                        <p className="font-medium text-foreground">
                          {sub.openCount} open · {sub.completedCount} done
                        </p>
                        <p className="text-muted-foreground">
                          {sub.overdueCount} overdue · {sub.dueSoonCount} due
                          soon
                        </p>
                      </TableCell>
                      <TableCell className="text-xs">
                        <p
                          className={cn(
                            'font-semibold',
                            evaluation.isDue
                              ? 'text-emerald-700'
                              : 'text-muted-foreground'
                          )}
                        >
                          {evaluation.isDue ? 'Due Now' : 'Waiting'}
                        </p>
                        <p className="text-muted-foreground max-w-[240px]">
                          {evaluation.reason}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy || isRunningBatch}
                          onClick={() => handleSendOne(sub)}
                        >
                          {busy ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Send Now
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Immutable Audit Log */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <h4 className="text-base font-bold text-foreground">
            Outbound Digest Dispatch Audit Log
          </h4>
        </div>

        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No reminder digest dispatches logged yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Trigger &amp; Transport</TableHead>
                  <TableHead>Outcome</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.slice(0, 25).map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">
                      <p className="font-semibold text-foreground">
                        {log.recipientName}
                      </p>
                      <p className="text-muted-foreground">
                        {log.recipientEmail} · {log.churchName}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs">
                      <p className="font-medium text-foreground max-w-xs truncate">
                        {log.subject}
                      </p>
                      <p className="text-muted-foreground tabular-nums">
                        {log.openCount} open · {log.overdueCount} overdue ·{' '}
                        {log.dueSoonCount} due soon
                      </p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">
                        {log.triggerSource} · {log.deliveryMode}
                      </p>
                      <p className="tabular-nums">
                        {formatDistanceToNow(new Date(log.createdAtMs), {
                          addSuffix: true,
                        })}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs font-semibold">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1',
                          log.status === 'sent'
                            ? 'text-emerald-700'
                            : log.status === 'failed'
                              ? 'text-destructive'
                              : 'text-primary'
                        )}
                      >
                        {log.status === 'sent' ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : log.status === 'failed' ? (
                          <AlertCircle className="h-3.5 w-3.5" />
                        ) : (
                          <Clock className="h-3.5 w-3.5" />
                        )}
                        {log.status}
                      </span>
                      {log.errorMessage && (
                        <p className="font-normal text-destructive max-w-[200px] truncate">
                          {log.errorMessage}
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
