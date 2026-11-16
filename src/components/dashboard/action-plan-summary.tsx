'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  Building2,
  CheckSquare,
  ListChecks,
  Loader2,
  LogIn,
  Sparkles,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirebase } from '@/firebase';
import {
  getVerifiedUserProfile,
  type VerifiedUserProfile,
} from '@/firebase/user-profile';
import {
  recordReminderCheckIn,
  saveActionReminderPref,
  seedActionPlanTemplates,
  subscribeToActionReminderPref,
  subscribeToUserActionItems,
  type ActionPlanItemRecord,
  type ActionReminderPreferenceRecord,
} from '@/firebase/action-plan';
import {
  ACTION_HORIZONS,
  computeReminderStatus,
  DEFAULT_SUMMIT_DATE_ISO,
  getDefaultDepartmentForRole,
} from '@/lib/action-plan-templates';
import { useToast } from '@/hooks/use-toast';

export function ActionPlanSummary() {
  const { firestore, auth, user, isUserLoading, isMfaVerified, isMfaLoading } =
    useFirebase();
  const { toast } = useToast();

  const [profile, setProfile] = useState<VerifiedUserProfile | null>(null);
  const [items, setItems] = useState<ActionPlanItemRecord[]>([]);
  const [reminderPref, setReminderPref] =
    useState<ActionReminderPreferenceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  const hasGoogleUser = Boolean(user && !user.isAnonymous);
  const canAccess = Boolean(
    hasGoogleUser && user?.emailVerified && isMfaVerified
  );
  const isCheckingAuth = isUserLoading || (hasGoogleUser && isMfaLoading);

  useEffect(() => {
    let cancelled = false;
    const loadProfile = async () => {
      if (!firestore || !user || !canAccess) {
        if (!cancelled) setProfile(null);
        return;
      }
      try {
        const fetched = await getVerifiedUserProfile(firestore, auth, user.uid);
        if (!cancelled) setProfile(fetched);
      } catch {
        // Fallback safely
      }
    };
    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [firestore, auth, user, canAccess]);

  useEffect(() => {
    if (!firestore || !user || !canAccess) {
      setItems([]);
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
        setItems(records);
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
  }, [firestore, auth, user, canAccess]);

  const syncedChurch =
    reminderPref?.churchName || profile?.organization || 'Local Ministry';
  const syncedDept =
    reminderPref?.defaultDepartment ||
    getDefaultDepartmentForRole(profile?.role);
  const syncedAssignee =
    profile?.fullName || user?.displayName || 'Ministry Lead';

  const reminderStatus = useMemo(() => {
    return computeReminderStatus(
      {
        enabled: reminderPref ? reminderPref.enabled : true,
        cadence: reminderPref?.cadence || 'weekly',
        reminderDay: reminderPref?.reminderDay || 'Monday',
        preferredChannel: reminderPref?.preferredChannel || 'both',
        lastCheckInIso: reminderPref?.lastCheckInIso || '',
      },
      items
    );
  }, [reminderPref, items]);

  const handleQuickSeed = async () => {
    if (!firestore || !user || !canAccess) return;
    setIsSeeding(true);
    try {
      const added = await seedActionPlanTemplates(firestore, auth, {
        uid: user.uid,
        churchName: syncedChurch,
        assigneeLabel: syncedAssignee,
        summitDateIso:
          reminderPref?.summitDateIso || DEFAULT_SUMMIT_DATE_ISO,
        existingItemIds: new Set(items.map((i) => i.id)),
      });
      if (!reminderPref) {
        await saveActionReminderPref(firestore, auth, {
          uid: user.uid,
          enabled: true,
          cadence: 'weekly',
          reminderDay: 'Monday',
          preferredChannel: 'both',
          churchName: syncedChurch,
          defaultDepartment: syncedDept,
          summitDateIso: DEFAULT_SUMMIT_DATE_ISO,
        });
      }
      toast({
        title: `Loaded ${added} post-summit milestones`,
        description: `Assigned to ${syncedChurch} with weekly accountability reminders.`,
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Import failed',
        description: 'Could not import the 30/60/90-day checklist.',
      });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleCheckIn = async () => {
    if (!firestore || !user || !canAccess) return;
    setIsCheckingIn(true);
    try {
      await recordReminderCheckIn(firestore, auth, {
        uid: user.uid,
        churchName: syncedChurch,
        defaultDepartment: syncedDept,
        summitDateIso:
          reminderPref?.summitDateIso || DEFAULT_SUMMIT_DATE_ISO,
      });
      toast({
        title: 'Check-in logged',
        description: 'Profile accountability reminder updated for this cycle.',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Check-in failed',
        description: 'Unable to update reminder check-in right now.',
      });
    } finally {
      setIsCheckingIn(false);
    }
  };

  const completedTotal = items.filter((i) => i.status === 'completed').length;
  const overallPct =
    items.length > 0 ? Math.round((completedTotal / items.length) * 100) : 0;

  return (
    <section className="mt-8">
      <Card className="shadow-xl">
        <CardHeader className="border-b border-border/70 pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2.5 text-2xl font-bold text-foreground">
                <ListChecks className="h-6 w-6 text-primary" />
                <span>
                  Post-Summit Action Plan &amp; 30-Day Accountability
                </span>
              </CardTitle>
              <CardDescription className="mt-1">
                Convert session insights into 30, 60, and 90-day church
                department checklists with progress reminders synced to your
                leader profile.
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm" className="self-start">
              <Link href="/action-plan">
                Open Action Tracker
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {isCheckingAuth || isLoading ? (
            <div className="grid gap-3 md:grid-cols-4">
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
            </div>
          ) : !canAccess ? (
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted/20 p-5 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  18 Ready-to-Assign 30 / 60 / 90-Day Ministry Milestones
                </p>
                <p className="text-xs text-muted-foreground">
                  Preview the full post-summit action roadmap or sign in with
                  Google &amp; Email OTP to assign tasks to your church
                  departments and enable synced weekly check-in reminders.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button asChild variant="outline" size="sm">
                  <Link href="/action-plan">Preview Blueprint</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/login">
                    <LogIn className="mr-1.5 h-4 w-4" />
                    Sign In to Sync
                  </Link>
                </Button>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col gap-4 rounded-xl border border-dashed border-border p-5 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Ready to launch {syncedChurch}&apos;s 30 / 60 / 90-day plan
                </p>
                <p className="text-xs text-muted-foreground">
                  Import all 18 takeaways from Sessions 1–6 and activate weekly
                  accountability reminders synced to {syncedAssignee}.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleQuickSeed}
                  disabled={isSeeding}
                >
                  {isSeeding ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1.5 h-4 w-4" />
                  )}
                  Import 18 Takeaways
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Overall Progress
                  </p>
                  <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">
                    {overallPct}%{' '}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({completedTotal}/{items.length})
                    </span>
                  </p>
                </div>

                {ACTION_HORIZONS.map((h) => {
                  const group = items.filter((i) => i.horizonDays === h);
                  const done = group.filter(
                    (i) => i.status === 'completed'
                  ).length;
                  return (
                    <div
                      key={h}
                      className="rounded-lg border border-border bg-muted/20 px-4 py-3"
                    >
                      <p className="text-xs font-medium text-muted-foreground tabular-nums">
                        {h}-Day Milestones
                      </p>
                      <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">
                        {done}/{group.length}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/15 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2.5">
                  <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-foreground">
                      {reminderStatus.headline}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {syncedChurch}
                      </span>{' '}
                      · {reminderStatus.subline}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant={reminderStatus.isCheckInDue ? 'default' : 'outline'}
                    onClick={handleCheckIn}
                    disabled={isCheckingIn}
                  >
                    {isCheckingIn ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckSquare className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Log Check-In
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
