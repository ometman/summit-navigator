'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  Circle,
  ListChecks,
  Loader2,
  LogIn,
  Plus,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirebase } from '@/firebase';
import {
  getVerifiedUserProfile,
  type VerifiedUserProfile,
} from '@/firebase/user-profile';
import {
  saveActionReminderPref,
  seedActionPlanTemplates,
  subscribeToActionReminderPref,
  subscribeToUserActionItems,
  updateActionPlanItem,
  type ActionPlanItemRecord,
  type ActionReminderPreferenceRecord,
} from '@/firebase/action-plan';
import {
  DEFAULT_SUMMIT_DATE_ISO,
  getDefaultDepartmentForRole,
  getTemplatesForSession,
  type ActionPlanTemplate,
} from '@/lib/action-plan-templates';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function SessionActionChecklist({
  sessionId,
}: {
  sessionId: string;
}) {
  const { firestore, auth, user, isUserLoading, isMfaVerified, isMfaLoading } =
    useFirebase();
  const { toast } = useToast();

  const [profile, setProfile] = useState<VerifiedUserProfile | null>(null);
  const [allItems, setAllItems] = useState<ActionPlanItemRecord[]>([]);
  const [reminderPref, setReminderPref] =
    useState<ActionReminderPreferenceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const templates = useMemo(
    () => getTemplatesForSession(sessionId),
    [sessionId]
  );

  const hasGoogleUser = Boolean(user && !user.isAnonymous);
  const canWrite = Boolean(
    hasGoogleUser && user?.emailVerified && isMfaVerified
  );
  const isCheckingAuth = isUserLoading || (hasGoogleUser && isMfaLoading);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!firestore || !user || !canWrite) {
        if (!cancelled) setProfile(null);
        return;
      }
      try {
        const fetched = await getVerifiedUserProfile(firestore, auth, user.uid);
        if (!cancelled) setProfile(fetched);
      } catch {
        // Fallback gracefully
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [firestore, auth, user, canWrite]);

  useEffect(() => {
    if (!firestore || !user || !canWrite) {
      setAllItems([]);
      setReminderPref(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubItems = subscribeToUserActionItems(
      firestore,
      auth,
      user.uid,
      (records) => {
        setAllItems(records);
        setIsLoading(false);
      },
      () => {
        setIsLoading(false);
      }
    );

    const unsubPref = subscribeToActionReminderPref(
      firestore,
      auth,
      user.uid,
      (pref) => setReminderPref(pref),
      () => {}
    );

    return () => {
      unsubItems();
      unsubPref();
    };
  }, [firestore, auth, user, canWrite]);

  const existingIds = useMemo(
    () => new Set(allItems.map((i) => i.id)),
    [allItems]
  );

  const sessionItems = useMemo(
    () => allItems.filter((i) => i.sessionId === sessionId),
    [allItems, sessionId]
  );

  const missingSessionTemplates = useMemo(
    () => templates.filter((t) => !existingIds.has(t.templateId)),
    [templates, existingIds]
  );

  const syncedChurch =
    reminderPref?.churchName || profile?.organization || 'Local Ministry';
  const syncedDept =
    reminderPref?.defaultDepartment ||
    getDefaultDepartmentForRole(profile?.role);
  const syncedAssignee =
    profile?.fullName || user?.displayName || 'Ministry Lead';
  const summitDateIso =
    reminderPref?.summitDateIso || DEFAULT_SUMMIT_DATE_ISO;

  const ensureReminderPrefExists = async () => {
    if (!firestore || !user || reminderPref) return;
    await saveActionReminderPref(firestore, auth, {
      uid: user.uid,
      enabled: true,
      cadence: 'weekly',
      reminderDay: 'Monday',
      preferredChannel: 'both',
      churchName: syncedChurch,
      defaultDepartment: syncedDept,
      summitDateIso,
    });
  };

  const handleImportTemplates = async (
    targetTemplates: ActionPlanTemplate[]
  ) => {
    if (!firestore || !user || !canWrite) return;
    setIsSeeding(true);
    try {
      const added = await seedActionPlanTemplates(firestore, auth, {
        uid: user.uid,
        churchName: syncedChurch,
        assigneeLabel: syncedAssignee,
        summitDateIso,
        existingItemIds: existingIds,
        templates: targetTemplates,
      });
      await ensureReminderPrefExists();
      toast({
        title:
          added > 0
            ? `Added ${added} takeaway${added === 1 ? '' : 's'} to your Action Plan`
            : 'Takeaways already in your Action Plan',
        description: `Assigned under ${syncedChurch} with profile-synced reminders.`,
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Unable to add action items',
        description: 'Please verify your sign-in session and try again.',
      });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleToggleItem = async (item: ActionPlanItemRecord) => {
    if (!firestore || !user || !canWrite) return;
    setPendingId(item.id);
    try {
      await updateActionPlanItem(firestore, auth, {
        uid: user.uid,
        itemId: item.id,
        status: item.status === 'completed' ? 'pending' : 'completed',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: 'Could not update milestone status.',
      });
    } finally {
      setPendingId(null);
    }
  };

  const completedSessionCount = sessionItems.filter(
    (i) => i.status === 'completed'
  ).length;

  return (
    <section className="my-8 rounded-xl border border-border bg-muted/15 p-5 md:p-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border/70 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground tabular-nums">
            <ListChecks className="h-4 w-4 text-primary" />
            <span>Post-Summit 30 / 60 / 90-Day Accountability Checklist</span>
            {canWrite && sessionItems.length > 0 && (
              <>
                <span>·</span>
                <span className="font-semibold text-foreground">
                  {completedSessionCount}/{sessionItems.length} completed
                </span>
              </>
            )}
          </div>
          <h3 className="text-lg font-bold text-foreground">
            Turn Session {sessionId} Takeaways into Ministry Action
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canWrite && missingSessionTemplates.length > 0 && (
            <Button
              type="button"
              size="sm"
              onClick={() => handleImportTemplates(missingSessionTemplates)}
              disabled={isSeeding || isLoading}
            >
              {isSeeding ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              )}
              Add {missingSessionTemplates.length} Takeaways to Plan
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href="/action-plan">
              Full Action Plan
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      {isCheckingAuth || isLoading ? (
        <div className="space-y-2.5">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : !canWrite ? (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            {templates.map((tpl) => (
              <div
                key={tpl.templateId}
                className="rounded-lg border border-border bg-background p-3.5 space-y-1.5"
              >
                <p className="text-xs font-semibold text-primary tabular-nums">
                  {tpl.horizonDays}-Day · {tpl.suggestedDepartment}
                </p>
                <p className="text-sm font-semibold leading-snug text-foreground">
                  {tpl.title}
                </p>
                <p className="text-xs text-muted-foreground">{tpl.notes}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Sign in with Google &amp; Email OTP to assign these takeaways to
              your church and sync 30-day reminders to your profile.
            </p>
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link href="/login">
                <LogIn className="mr-1.5 h-3.5 w-3.5" />
                Sign In to Track
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {templates.map((tpl) => {
            const saved = allItems.find((i) => i.id === tpl.templateId);
            if (!saved) {
              return (
                <div
                  key={tpl.templateId}
                  className="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-background p-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground tabular-nums">
                      <span className="font-semibold text-primary">
                        {tpl.horizonDays}-Day
                      </span>{' '}
                      · Suggested Dept: {tpl.suggestedDepartment}
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {tpl.title}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isSeeding}
                    onClick={() => handleImportTemplates([tpl])}
                    className="shrink-0 self-start sm:self-center"
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add to Plan
                  </Button>
                </div>
              );
            }

            const isDone = saved.status === 'completed';
            const busy = pendingId === saved.id;

            return (
              <div
                key={saved.id}
                className={cn(
                  'flex items-start justify-between gap-3 rounded-lg border p-3.5 transition-colors',
                  isDone
                    ? 'border-border/70 bg-muted/30'
                    : 'border-border bg-background'
                )}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => handleToggleItem(saved)}
                    disabled={busy}
                    aria-label={
                      isDone ? 'Mark incomplete' : 'Mark action complete'
                    }
                    className="mt-0.5 shrink-0 text-primary"
                  >
                    {busy ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : isDone ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground hover:text-primary" />
                    )}
                  </button>
                  <div className="min-w-0 space-y-1">
                    <p
                      className={cn(
                        'text-sm font-semibold text-foreground',
                        isDone && 'line-through text-muted-foreground'
                      )}
                    >
                      {saved.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground tabular-nums">
                      <span className="font-semibold text-primary">
                        {saved.horizonDays}-Day
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {saved.churchName}
                      </span>
                      <span>·</span>
                      <span>{saved.department}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Due {saved.dueDateIso}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {sessionItems
            .filter(
              (item) =>
                !templates.some((tpl) => tpl.templateId === item.id)
            )
            .map((customItem) => {
              const isDone = customItem.status === 'completed';
              const busy = pendingId === customItem.id;
              return (
                <div
                  key={customItem.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-background p-3.5"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleItem(customItem)}
                    disabled={busy}
                    className="mt-0.5 shrink-0 text-primary"
                  >
                    {busy ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : isDone ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground hover:text-primary" />
                    )}
                  </button>
                  <div className="min-w-0 space-y-1">
                    <p
                      className={cn(
                        'text-sm font-semibold text-foreground',
                        isDone && 'line-through text-muted-foreground'
                      )}
                    >
                      {customItem.title}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {customItem.horizonDays}-Day · {customItem.department} ·
                      Due {customItem.dueDateIso}
                    </p>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </section>
  );
}
