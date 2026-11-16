'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Bell,
  BellOff,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Circle,
  Download,
  Edit3,
  Layers,
  ListChecks,
  Loader2,
  LogIn,
  Mail,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirebase } from '@/firebase';
import {
  getVerifiedUserProfile,
  type VerifiedUserProfile,
} from '@/firebase/user-profile';
import {
  addActionPlanItem,
  deleteActionPlanItem,
  recordReminderCheckIn,
  recordReminderDispatchResult,
  saveActionReminderPref,
  seedActionPlanTemplates,
  subscribeToActionReminderPref,
  subscribeToUserActionItems,
  subscribeToUserDispatchLogs,
  syncReminderSubscription,
  updateActionPlanItem,
  type ActionPlanItemRecord,
  type ActionReminderPreferenceRecord,
  type ReminderDispatchLogRecord,
} from '@/firebase/action-plan';
import type {
  DigestDeliveryMode,
  DigestDispatchStatus,
} from '@/lib/reminder-cron';
import {
  ACTION_HORIZONS,
  buildActionPlanCsv,
  buildActionPlanMarkdown,
  computeDueDateIso,
  computeReminderStatus,
  DEFAULT_SUMMIT_DATE_ISO,
  getDefaultDepartmentForRole,
  MINISTRY_DEPARTMENTS,
  REMINDER_CADENCE_OPTIONS,
  REMINDER_CHANNEL_OPTIONS,
  REMINDER_DAY_OPTIONS,
  SESSION_ACTION_TEMPLATES,
  type ActionHorizon,
  type ActionStatus,
  type ReminderCadence,
  type ReminderChannel,
  type ReminderDay,
} from '@/lib/action-plan-templates';
import { agendaData } from '@/lib/data';
import { triggerFileDownload } from '@/lib/presentation-data';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type HorizonFilter = 'all' | ActionHorizon;
type StatusFilter = 'all' | ActionStatus;

function extractFriendlyErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  let detail = raw;
  try {
    const parsed = JSON.parse(raw) as { error?: string };
    if (parsed && typeof parsed.error === 'string') {
      detail = parsed.error;
    }
  } catch {
    // Plain error string
  }
  if (detail.includes('Quota exceeded')) {
    return 'Daily Firestore quota exceeded. Updates will resume once quota resets.';
  }
  if (
    detail.toLowerCase().includes('permission') ||
    detail.toLowerCase().includes('insufficient')
  ) {
    return 'Permission denied. Please confirm Google Sign-In and Email OTP verification are active.';
  }
  return detail || 'Unable to sync your action plan right now.';
}

const STATUS_LABELS: Record<ActionStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
};

export function ActionPlanTracker() {
  const { firestore, auth, user, isUserLoading, isMfaVerified, isMfaLoading } =
    useFirebase();
  const { toast } = useToast();

  const [profile, setProfile] = useState<VerifiedUserProfile | null>(null);
  const [items, setItems] = useState<ActionPlanItemRecord[]>([]);
  const [reminderPref, setReminderPref] =
    useState<ActionReminderPreferenceRecord | null>(null);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);

  // Filters
  const [horizonFilter, setHorizonFilter] = useState<HorizonFilter>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [sessionFilter, setSessionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Reminder preference form state
  const [showReminderSettings, setShowReminderSettings] = useState(false);
  const [prefEnabled, setPrefEnabled] = useState(true);
  const [prefCadence, setPrefCadence] = useState<ReminderCadence>('weekly');
  const [prefDay, setPrefDay] = useState<ReminderDay>('Monday');
  const [prefChannel, setPrefChannel] = useState<ReminderChannel>('both');
  const [prefChurch, setPrefChurch] = useState('');
  const [prefDepartment, setPrefDepartment] = useState<string>(
    MINISTRY_DEPARTMENTS[0]
  );
  const [prefSummitDate, setPrefSummitDate] = useState(DEFAULT_SUMMIT_DATE_ISO);
  const [isSavingPref, setIsSavingPref] = useState(false);
  const [isRecordingCheckIn, setIsRecordingCheckIn] = useState(false);
  const [dispatchLogs, setDispatchLogs] = useState<ReminderDispatchLogRecord[]>([]);
  const [isSendingDigest, setIsSendingDigest] = useState(false);
  const [digestPreview, setDigestPreview] = useState<{
    subject: string;
    text: string;
    deliveryMode: DigestDeliveryMode;
  } | null>(null);
  const lastSyncedSigRef = useRef<string>('');

  // Add custom item composer
  const [showComposer, setShowComposer] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newSessionId, setNewSessionId] = useState('1');
  const [newHorizon, setNewHorizon] = useState<ActionHorizon>(30);
  const [newDepartment, setNewDepartment] = useState<string>(
    MINISTRY_DEPARTMENTS[0]
  );
  const [newChurchName, setNewChurchName] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [newDueDate, setNewDueDate] = useState(() =>
    computeDueDateIso(DEFAULT_SUMMIT_DATE_ISO, 30)
  );
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isSeedingTemplates, setIsSeedingTemplates] = useState(false);

  // Inline editing state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editChurch, setEditChurch] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [editHorizon, setEditHorizon] = useState<ActionHorizon>(30);
  const [editDueDate, setEditDueDate] = useState('');
  const [pendingItemIds, setPendingItemIds] = useState<Set<string>>(new Set());

  const hasGoogleUser = Boolean(user && !user.isAnonymous);
  const canAccessPlan = Boolean(
    hasGoogleUser && user?.emailVerified && isMfaVerified
  );
  const isCheckingAuth =
    isUserLoading || (hasGoogleUser && isMfaLoading);

  // Load verified user profile for church/department sync
  useEffect(() => {
    let cancelled = false;
    const loadProfile = async () => {
      if (!firestore || !user || !canAccessPlan) {
        if (!cancelled) setProfile(null);
        return;
      }
      try {
        const fetched = await getVerifiedUserProfile(firestore, auth, user.uid);
        if (!cancelled) {
          setProfile(fetched);
        }
      } catch {
        // Non-blocking: fallback to auth display info
      }
    };
    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [firestore, auth, user, canAccessPlan]);

  // Subscribe to action items and synced reminder preferences
  useEffect(() => {
    if (!firestore || !user || !canAccessPlan) {
      setItems([]);
      setReminderPref(null);
      setIsLoadingItems(false);
      return;
    }

    setIsLoadingItems(true);
    setStreamError(null);

    const unsubItems = subscribeToUserActionItems(
      firestore,
      auth,
      user.uid,
      (records) => {
        setItems(records);
        setIsLoadingItems(false);
        setStreamError(null);
      },
      (err) => {
        setStreamError(extractFriendlyErrorMessage(err));
        setIsLoadingItems(false);
      }
    );

    const unsubPref = subscribeToActionReminderPref(
      firestore,
      auth,
      user.uid,
      (pref) => {
        setReminderPref(pref);
      },
      (err) => {
        setStreamError((prev) => prev || extractFriendlyErrorMessage(err));
      }
    );

    const unsubLogs = subscribeToUserDispatchLogs(
      firestore,
      auth,
      user.uid,
      (logs) => {
        setDispatchLogs(logs);
      },
      () => {}
    );

    return () => {
      unsubItems();
      unsubPref();
      unsubLogs();
    };
  }, [firestore, auth, user, canAccessPlan]);

  // Sync local form defaults from Firestore preference or verified user profile
  const syncedChurchDefault = useMemo(() => {
    return (
      reminderPref?.churchName ||
      profile?.organization ||
      'Local Ministry'
    );
  }, [reminderPref?.churchName, profile?.organization]);

  const syncedDeptDefault = useMemo(() => {
    return (
      reminderPref?.defaultDepartment ||
      getDefaultDepartmentForRole(profile?.role)
    );
  }, [reminderPref?.defaultDepartment, profile?.role]);

  const syncedAssigneeDefault = useMemo(() => {
    return profile?.fullName || user?.displayName || 'Ministry Lead';
  }, [profile?.fullName, user?.displayName]);

  useEffect(() => {
    setPrefEnabled(reminderPref ? reminderPref.enabled : true);
    setPrefCadence(reminderPref?.cadence || 'weekly');
    setPrefDay(reminderPref?.reminderDay || 'Monday');
    setPrefChannel(reminderPref?.preferredChannel || 'both');
    setPrefChurch(syncedChurchDefault);
    setPrefDepartment(syncedDeptDefault);
    setPrefSummitDate(
      reminderPref?.summitDateIso || DEFAULT_SUMMIT_DATE_ISO
    );
  }, [reminderPref, syncedChurchDefault, syncedDeptDefault]);

  useEffect(() => {
    setNewChurchName(syncedChurchDefault);
    setNewDepartment(syncedDeptDefault);
    setNewAssignee(syncedAssigneeDefault);
  }, [syncedChurchDefault, syncedDeptDefault, syncedAssigneeDefault]);

  useEffect(() => {
    setNewDueDate(computeDueDateIso(prefSummitDate, newHorizon));
  }, [prefSummitDate, newHorizon]);

  // Synchronize user's action items + reminder cadence to /reminderSubscriptions/{uid} for automated offline cron
  const effectiveEnabled = reminderPref ? reminderPref.enabled : true;
  const effectiveCadence = reminderPref?.cadence || 'weekly';
  const effectiveDay = reminderPref?.reminderDay || 'Monday';
  const effectiveChannel = reminderPref?.preferredChannel || 'both';
  const effectiveSummitDate =
    reminderPref?.summitDateIso || DEFAULT_SUMMIT_DATE_ISO;
  const effectiveLastCheckIn = reminderPref?.lastCheckInIso || '';

  const itemSummaryKey = useMemo(
    () =>
      items
        .map(
          (i) =>
            `${i.id}:${i.status}:${i.dueDateIso}:${i.department}:${i.horizonDays}`
        )
        .join('|'),
    [items]
  );

  useEffect(() => {
    if (
      !firestore ||
      !user ||
      !canAccessPlan ||
      isLoadingItems ||
      !user.email
    ) {
      return;
    }

    const sig = JSON.stringify({
      uid: user.uid,
      email: user.email,
      displayName: syncedAssigneeDefault,
      enabled: effectiveEnabled,
      cadence: effectiveCadence,
      reminderDay: effectiveDay,
      preferredChannel: effectiveChannel,
      churchName: syncedChurchDefault,
      defaultDepartment: syncedDeptDefault,
      summitDateIso: effectiveSummitDate,
      lastCheckInIso: effectiveLastCheckIn,
      itemSummaryKey,
    });

    if (sig === lastSyncedSigRef.current) return;
    lastSyncedSigRef.current = sig;

    void syncReminderSubscription(firestore, auth, {
      uid: user.uid,
      email: user.email,
      displayName: syncedAssigneeDefault,
      enabled: effectiveEnabled,
      cadence: effectiveCadence,
      reminderDay: effectiveDay,
      preferredChannel: effectiveChannel,
      churchName: syncedChurchDefault,
      defaultDepartment: syncedDeptDefault,
      summitDateIso: effectiveSummitDate,
      lastCheckInIso: effectiveLastCheckIn,
      items,
    }).catch(() => {
      lastSyncedSigRef.current = '';
    });
  }, [
    firestore,
    auth,
    user,
    canAccessPlan,
    isLoadingItems,
    syncedAssigneeDefault,
    effectiveEnabled,
    effectiveCadence,
    effectiveDay,
    effectiveChannel,
    syncedChurchDefault,
    syncedDeptDefault,
    effectiveSummitDate,
    effectiveLastCheckIn,
    itemSummaryKey,
    items,
  ]);

  const existingItemIds = useMemo(
    () => new Set(items.map((item) => item.id)),
    [items]
  );

  const missingTemplateCount = useMemo(() => {
    return SESSION_ACTION_TEMPLATES.filter(
      (tpl) => !existingItemIds.has(tpl.templateId)
    ).length;
  }, [existingItemIds]);

  const stats = useMemo(() => {
    const total = items.length;
    const completed = items.filter((i) => i.status === 'completed').length;
    const inProgress = items.filter((i) => i.status === 'in_progress').length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    const byHorizon = {
      30: {
        total: items.filter((i) => i.horizonDays === 30).length,
        completed: items.filter(
          (i) => i.horizonDays === 30 && i.status === 'completed'
        ).length,
      },
      60: {
        total: items.filter((i) => i.horizonDays === 60).length,
        completed: items.filter(
          (i) => i.horizonDays === 60 && i.status === 'completed'
        ).length,
      },
      90: {
        total: items.filter((i) => i.horizonDays === 90).length,
        completed: items.filter(
          (i) => i.horizonDays === 90 && i.status === 'completed'
        ).length,
      },
    };

    return { total, completed, inProgress, percent, byHorizon };
  }, [items]);

  const reminderStatus = useMemo(() => {
    return computeReminderStatus(
      {
        enabled: prefEnabled,
        cadence: prefCadence,
        reminderDay: prefDay,
        preferredChannel: prefChannel,
        lastCheckInIso: reminderPref?.lastCheckInIso || '',
      },
      items
    );
  }, [
    prefEnabled,
    prefCadence,
    prefDay,
    prefChannel,
    reminderPref?.lastCheckInIso,
    items,
  ]);

  const availableDepartments = useMemo(() => {
    const set = new Set<string>(MINISTRY_DEPARTMENTS);
    items.forEach((item) => {
      if (item.department) set.add(item.department);
    });
    return Array.from(set);
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (horizonFilter !== 'all' && item.horizonDays !== horizonFilter) {
        return false;
      }
      if (departmentFilter !== 'all' && item.department !== departmentFilter) {
        return false;
      }
      if (sessionFilter !== 'all' && item.sessionId !== sessionFilter) {
        return false;
      }
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }
      if (q) {
        const haystack = `${item.title} ${item.notes} ${item.department} ${item.churchName} ${item.assigneeLabel} ${item.sessionTitle}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [
    items,
    horizonFilter,
    departmentFilter,
    sessionFilter,
    statusFilter,
    searchQuery,
  ]);

  const setItemPending = (itemId: string, pending: boolean) => {
    setPendingItemIds((prev) => {
      const next = new Set(prev);
      if (pending) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  };

  const handleSeedAllTemplates = async () => {
    if (!firestore || !user || !canAccessPlan) return;
    setIsSeedingTemplates(true);
    try {
      const createdCount = await seedActionPlanTemplates(firestore, auth, {
        uid: user.uid,
        churchName: syncedChurchDefault,
        assigneeLabel: syncedAssigneeDefault,
        summitDateIso: prefSummitDate,
        existingItemIds,
      });

      // Ensure synced reminder preferences exist for the user's profile
      if (!reminderPref) {
        await saveActionReminderPref(firestore, auth, {
          uid: user.uid,
          enabled: true,
          cadence: 'weekly',
          reminderDay: 'Monday',
          preferredChannel: 'both',
          churchName: syncedChurchDefault,
          defaultDepartment: syncedDeptDefault,
          summitDateIso: prefSummitDate,
        });
      }

      toast({
        title:
          createdCount > 0
            ? `Added ${createdCount} summit takeaway milestone${createdCount === 1 ? '' : 's'}`
            : 'All 18 summit takeaways already imported',
        description: `Assigned to ${syncedChurchDefault} across 30, 60, and 90-day horizons.`,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Unable to load summit templates',
        description: extractFriendlyErrorMessage(err),
      });
    } finally {
      setIsSeedingTemplates(false);
    }
  };

  const handleSaveReminderPref = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user || !canAccessPlan) return;
    setIsSavingPref(true);
    try {
      await saveActionReminderPref(firestore, auth, {
        uid: user.uid,
        enabled: prefEnabled,
        cadence: prefCadence,
        reminderDay: prefDay,
        preferredChannel: prefChannel,
        churchName: prefChurch,
        defaultDepartment: prefDepartment,
        summitDateIso: prefSummitDate,
        lastCheckInIso: reminderPref?.lastCheckInIso || '',
      });
      toast({
        title: 'Accountability reminders synced',
        description: `Saved ${prefCadence} ${prefDay} reminders for ${prefChurch || syncedChurchDefault}.`,
      });
      setShowReminderSettings(false);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Unable to save reminder settings',
        description: extractFriendlyErrorMessage(err),
      });
    } finally {
      setIsSavingPref(false);
    }
  };

  const handleRecordCheckIn = async () => {
    if (!firestore || !user || !canAccessPlan) return;
    setIsRecordingCheckIn(true);
    try {
      await recordReminderCheckIn(firestore, auth, {
        uid: user.uid,
        churchName: prefChurch || syncedChurchDefault,
        defaultDepartment: prefDepartment || syncedDeptDefault,
        summitDateIso: prefSummitDate,
      });
      toast({
        title: 'Accountability check-in logged',
        description:
          'Your profile reminder cadence has been updated for this week.',
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Check-in failed',
        description: extractFriendlyErrorMessage(err),
      });
    } finally {
      setIsRecordingCheckIn(false);
    }
  };

  const handleSendTestDigest = async () => {
    if (!firestore || !user || !canAccessPlan || !user.email) return;
    setIsSendingDigest(true);
    try {
      const openItems = items.filter((i) => i.status !== 'completed');
      const completedCount = items.length - openItems.length;
      const topOpenTitles = openItems
        .slice(0, 5)
        .map(
          (i) =>
            `${i.horizonDays}-Day · ${i.department}: ${i.title} (Due ${i.dueDateIso})`
        );

      const idToken = await user.getIdToken();
      const res = await fetch('/api/reminders/send-digest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          uid: user.uid,
          recipientEmail: user.email,
          recipientName: syncedAssigneeDefault,
          churchName: prefChurch || syncedChurchDefault,
          defaultDepartment: prefDepartment || syncedDeptDefault,
          cadence: prefCadence,
          reminderDay: prefDay,
          openCount: openItems.length,
          completedCount,
          overdueCount: reminderStatus.overdueCount,
          dueSoonCount: reminderStatus.dueSoonCount,
          topOpenTitles,
          triggerSource: 'user_test',
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        deliveryMode?: DigestDeliveryMode;
        status?: DigestDispatchStatus;
        subject?: string;
        text?: string;
        sentAtIso?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || 'Unable to dispatch digest email.');
      }

      await recordReminderDispatchResult(firestore, auth, {
        uid: user.uid,
        recipientEmail: user.email,
        recipientName: syncedAssigneeDefault,
        churchName: prefChurch || syncedChurchDefault,
        cadence: prefCadence,
        reminderDay: prefDay,
        triggerSource: 'user_test',
        deliveryMode: data.deliveryMode || 'preview',
        status: data.status || 'preview',
        openCount: openItems.length,
        overdueCount: reminderStatus.overdueCount,
        dueSoonCount: reminderStatus.dueSoonCount,
        subject:
          data.subject ||
          `Summit Navigator Accountability Digest · ${prefChurch || syncedChurchDefault}`,
        sentAtIso: data.sentAtIso || new Date().toISOString(),
        updateSubscriptionTimestamp: true,
      });

      if (data.deliveryMode === 'preview' && data.text) {
        setDigestPreview({
          subject: data.subject || 'Accountability Digest Preview',
          text: data.text,
          deliveryMode: 'preview',
        });
      }

      toast({
        title:
          data.deliveryMode === 'preview'
            ? 'Accountability digest preview generated'
            : `Accountability digest emailed to ${user.email}`,
        description:
          data.deliveryMode === 'preview'
            ? 'Preview rendered below (add RESEND_API_KEY or SMTP_* for live external mail).'
            : `Delivered via ${(data.deliveryMode || 'email').toUpperCase()}.`,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Digest dispatch failed',
        description: extractFriendlyErrorMessage(err),
      });
    } finally {
      setIsSendingDigest(false);
    }
  };

  const handleAddCustomItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user || !canAccessPlan) return;
    if (newTitle.trim().length < 3) {
      toast({
        variant: 'destructive',
        title: 'Action title too short',
        description: 'Enter at least 3 characters for your ministry action.',
      });
      return;
    }

    setIsAddingItem(true);
    try {
      await addActionPlanItem(firestore, auth, {
        uid: user.uid,
        sessionId: newSessionId,
        title: newTitle,
        notes: newNotes,
        horizonDays: newHorizon,
        churchName: newChurchName || syncedChurchDefault,
        department: newDepartment || syncedDeptDefault,
        assigneeLabel: newAssignee || syncedAssigneeDefault,
        dueDateIso: newDueDate,
        summitDateIso: prefSummitDate,
      });
      setNewTitle('');
      setNewNotes('');
      setShowComposer(false);
      toast({
        title: 'Action milestone added',
        description: `Assigned to ${newDepartment} (${newHorizon}-Day horizon).`,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Could not create action item',
        description: extractFriendlyErrorMessage(err),
      });
    } finally {
      setIsAddingItem(false);
    }
  };

  const handleToggleComplete = async (item: ActionPlanItemRecord) => {
    if (!firestore || !user || !canAccessPlan) return;
    const nextStatus: ActionStatus =
      item.status === 'completed' ? 'pending' : 'completed';
    setItemPending(item.id, true);
    try {
      await updateActionPlanItem(firestore, auth, {
        uid: user.uid,
        itemId: item.id,
        status: nextStatus,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: extractFriendlyErrorMessage(err),
      });
    } finally {
      setItemPending(item.id, false);
    }
  };

  const handleStatusChange = async (
    item: ActionPlanItemRecord,
    status: ActionStatus
  ) => {
    if (!firestore || !user || !canAccessPlan || item.status === status) return;
    setItemPending(item.id, true);
    try {
      await updateActionPlanItem(firestore, auth, {
        uid: user.uid,
        itemId: item.id,
        status,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Status change failed',
        description: extractFriendlyErrorMessage(err),
      });
    } finally {
      setItemPending(item.id, false);
    }
  };

  const startEditingItem = (item: ActionPlanItemRecord) => {
    setEditingItemId(item.id);
    setEditTitle(item.title);
    setEditNotes(item.notes);
    setEditDepartment(item.department);
    setEditChurch(item.churchName);
    setEditAssignee(item.assigneeLabel);
    setEditHorizon(item.horizonDays);
    setEditDueDate(item.dueDateIso);
  };

  const handleSaveEdit = async (itemId: string) => {
    if (!firestore || !user || !canAccessPlan) return;
    if (editTitle.trim().length < 3) {
      toast({
        variant: 'destructive',
        title: 'Action title required',
        description: 'Please provide at least 3 characters.',
      });
      return;
    }

    setItemPending(itemId, true);
    try {
      await updateActionPlanItem(firestore, auth, {
        uid: user.uid,
        itemId,
        title: editTitle,
        notes: editNotes,
        department: editDepartment,
        churchName: editChurch,
        assigneeLabel: editAssignee,
        horizonDays: editHorizon,
        dueDateIso: editDueDate,
      });
      setEditingItemId(null);
      toast({
        title: 'Milestone updated',
        description: `Assigned to ${editDepartment} (${editHorizon}-Day).`,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Could not save changes',
        description: extractFriendlyErrorMessage(err),
      });
    } finally {
      setItemPending(itemId, false);
    }
  };

  const handleDeleteItem = async (item: ActionPlanItemRecord) => {
    if (!firestore || !user || !canAccessPlan) return;
    setItemPending(item.id, true);
    try {
      await deleteActionPlanItem(firestore, auth, user.uid, item.id);
      if (editingItemId === item.id) setEditingItemId(null);
      toast({
        title: 'Milestone removed',
        description: item.title,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: extractFriendlyErrorMessage(err),
      });
    } finally {
      setItemPending(item.id, false);
    }
  };

  const handleExport = (format: 'md' | 'csv') => {
    if (items.length === 0) return;
    if (format === 'csv') {
      const csv = buildActionPlanCsv(items);
      triggerFileDownload(csv.filename, csv.content, csv.mimeType);
      toast({
        title: 'Action plan exported',
        description: `Downloaded ${csv.filename}`,
      });
      return;
    }
    const cadenceLabel =
      REMINDER_CADENCE_OPTIONS.find((c) => c.value === prefCadence)?.label ||
      'Weekly Check-In';
    const md = buildActionPlanMarkdown(
      items,
      syncedChurchDefault,
      `${cadenceLabel} (${prefDay}s)`
    );
    triggerFileDownload(md.filename, md.content, md.mimeType);
    toast({
      title: 'Action plan exported',
      description: `Downloaded ${md.filename}`,
    });
  };

  if (isCheckingAuth) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (!canAccessPlan) {
    return (
      <div className="space-y-8">
        <Card className="shadow-xl">
          <CardHeader className="border-b border-border/70 pb-5">
            <CardTitle className="flex items-center gap-2.5 text-2xl font-bold text-foreground">
              <ListChecks className="h-6 w-6 text-primary" />
              <span>
                Post-Summit Action Plan &amp; 30/60/90-Day Accountability Tracker
              </span>
            </CardTitle>
            <CardDescription>
              Turn every summit session&apos;s key takeaways into structured
              30, 60, and 90-day implementation checklists assigned to your
              church and ministry departments—with accountability reminders
              synced to your profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted/25 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {hasGoogleUser
                    ? 'Complete Email OTP verification to sync your personal ministry plan'
                    : 'Sign in with Google & Email OTP to activate your ministry tracker'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Your action checklist, church/department assignments, and
                  weekly accountability cadence sync privately to your verified
                  profile across devices.
                </p>
              </div>
              <Button asChild className="shrink-0">
                <Link href="/login">
                  <LogIn className="mr-2 h-4 w-4" />
                  {hasGoogleUser ? 'Verify Email OTP' : 'Sign In & Sync Plan'}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Public Read-Only Preview of 30/60/90-Day Session Takeaways */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-foreground">
              30 / 60 / 90-Day Summit Implementation Blueprint (18 Milestones)
            </CardTitle>
            <CardDescription>
              Preview the recommended post-summit action roadmap across all six
              leadership sessions.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {ACTION_HORIZONS.map((horizon) => {
              const group = SESSION_ACTION_TEMPLATES.filter(
                (t) => t.horizonDays === horizon
              );
              return (
                <div
                  key={horizon}
                  className="rounded-xl border border-border bg-background p-4 space-y-3"
                >
                  <div className="border-b border-border/70 pb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary tabular-nums">
                      {horizon}-Day Horizon
                    </p>
                    <h3 className="text-base font-bold text-foreground">
                      {horizon === 30
                        ? 'Launch & Quick Wins'
                        : horizon === 60
                          ? 'Team Momentum & Alignment'
                          : 'Sustained Ministry Integration'}
                    </h3>
                  </div>
                  <ul className="space-y-3">
                    {group.map((tpl) => (
                      <li
                        key={tpl.templateId}
                        className="rounded-lg border border-border/70 bg-muted/15 p-3 space-y-1"
                      >
                        <p className="text-xs font-medium text-muted-foreground">
                          Session {tpl.sessionId} · {tpl.suggestedDepartment}
                        </p>
                        <p className="text-sm font-semibold leading-snug text-foreground">
                          {tpl.title}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Accountability Overview & Completion Metrics */}
      <Card className="shadow-xl">
        <CardHeader className="border-b border-border/70 pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1 text-primary font-semibold">
                  <Building2 className="h-3.5 w-3.5" />
                  {syncedChurchDefault}
                </span>
                <span>·</span>
                <span>{syncedDeptDefault}</span>
                <span>·</span>
                <span>Synced with {syncedAssigneeDefault}</span>
              </div>
              <CardTitle className="flex items-center gap-2.5 text-2xl font-bold text-foreground">
                <ListChecks className="h-6 w-6 text-primary" />
                <span>Post-Summit Ministry Action Plan</span>
              </CardTitle>
              <CardDescription>
                Assign session takeaways to departments across 30, 60, and
                90-day milestones and stay accountable with profile-synced
                reminders.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {missingTemplateCount > 0 && (
                <Button
                  type="button"
                  onClick={handleSeedAllTemplates}
                  disabled={isSeedingTemplates || isLoadingItems}
                  size="sm"
                >
                  {isSeedingTemplates ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1.5 h-4 w-4" />
                  )}
                  {items.length === 0
                    ? 'Import All 18 Summit Takeaways'
                    : `Import Remaining ${missingTemplateCount} Takeaways`}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowComposer((prev) => !prev)}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Custom Action
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleExport('md')}
                disabled={items.length === 0}
              >
                <Download className="mr-1.5 h-4 w-4" />
                Export (.md)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleExport('csv')}
                disabled={items.length === 0}
              >
                <Download className="mr-1.5 h-4 w-4" />
                CSV
              </Button>
            </div>
          </div>

          {/* 30 / 60 / 90-Day KPI Metrics */}
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">
                Overall Completion
              </p>
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <p className="text-2xl font-bold text-foreground tabular-nums">
                  {isLoadingItems ? '—' : `${stats.percent}%`}
                </p>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {stats.completed}/{stats.total} done
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${stats.percent}%` }}
                />
              </div>
            </div>

            {ACTION_HORIZONS.map((h) => {
              const bucket = stats.byHorizon[h];
              const pct =
                bucket.total > 0
                  ? Math.round((bucket.completed / bucket.total) * 100)
                  : 0;
              return (
                <div
                  key={h}
                  className="rounded-lg border border-border bg-muted/20 px-4 py-3"
                >
                  <p className="text-xs font-medium text-muted-foreground tabular-nums">
                    {h}-Day Horizon
                  </p>
                  <div className="mt-1 flex items-baseline justify-between gap-2">
                    <p className="text-2xl font-bold text-foreground tabular-nums">
                      {isLoadingItems
                        ? '—'
                        : `${bucket.completed}/${bucket.total}`}
                    </p>
                    <span className="text-xs font-semibold text-primary tabular-nums">
                      {pct}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardHeader>

        {/* Profile-Synced Accountability Reminder Banner */}
        <CardContent className="pt-5 space-y-4">
          {streamError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Sync Error</AlertTitle>
              <AlertDescription>{streamError}</AlertDescription>
            </Alert>
          )}

          <div
            className={cn(
              'rounded-xl border p-4 transition-colors',
              reminderStatus.overdueCount > 0
                ? 'border-amber-300 bg-amber-50/70'
                : reminderStatus.isCheckInDue
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border bg-muted/20'
            )}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg border border-border bg-background p-2">
                  {prefEnabled ? (
                    <Bell className="h-4 w-4 text-primary" />
                  ) : (
                    <BellOff className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    {reminderStatus.headline}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {reminderStatus.subline} ·{' '}
                    {REMINDER_CHANNEL_OPTIONS.find(
                      (c) => c.value === prefChannel
                    )?.label || 'Synced to profile'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant={reminderStatus.isCheckInDue ? 'default' : 'outline'}
                  size="sm"
                  onClick={handleRecordCheckIn}
                  disabled={isRecordingCheckIn}
                >
                  {isRecordingCheckIn ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckSquare className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Log Check-In
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSendTestDigest}
                  disabled={isSendingDigest || prefChannel === 'dashboard_banner'}
                >
                  {isSendingDigest ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Send Digest Email
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReminderSettings((prev) => !prev)}
                >
                  {showReminderSettings ? (
                    <>
                      Hide Settings
                      <ChevronUp className="ml-1 h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Reminder Settings
                      <ChevronDown className="ml-1 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>

            {digestPreview && (
              <div className="mt-4 rounded-lg border border-border bg-background p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    <span>{digestPreview.subject}</span>
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDigestPreview(null)}
                    className="h-7 px-2 text-xs"
                  >
                    Dismiss
                  </Button>
                </div>
                <pre className="whitespace-pre-wrap text-xs font-sans text-muted-foreground leading-relaxed">
                  {digestPreview.text}
                </pre>
              </div>
            )}

            {dispatchLogs.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground tabular-nums">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-primary" />
                  Latest digest: <strong className="text-foreground">{dispatchLogs[0].status}</strong> via {dispatchLogs[0].deliveryMode} ({dispatchLogs[0].sentAtIso.slice(0, 10)})
                </span>
                <span>
                  {dispatchLogs.length} outbound {dispatchLogs.length === 1 ? 'log' : 'logs'} synced for automated cron
                </span>
              </div>
            )}

            {showReminderSettings && (
              <form
                onSubmit={handleSaveReminderPref}
                className="mt-4 border-t border-border/80 pt-4 space-y-4"
              >
                <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background px-4 py-3">
                  <div>
                    <Label
                      htmlFor="reminders-enabled"
                      className="text-sm font-semibold"
                    >
                      Enable Profile-Synced Accountability Reminders
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Tracks due dates against your summit date and prompts
                      check-ins on your preferred ministry cadence.
                    </p>
                  </div>
                  <Switch
                    id="reminders-enabled"
                    checked={prefEnabled}
                    onCheckedChange={setPrefEnabled}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="pref-church">Assigned Church / Ministry</Label>
                    <Input
                      id="pref-church"
                      value={prefChurch}
                      onChange={(e) => setPrefChurch(e.target.value)}
                      maxLength={150}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="pref-dept">Default Department</Label>
                    <select
                      id="pref-dept"
                      value={prefDepartment}
                      onChange={(e) => setPrefDepartment(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {MINISTRY_DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="pref-summit-date">Summit Anchor Date</Label>
                    <Input
                      id="pref-summit-date"
                      type="date"
                      value={prefSummitDate}
                      onChange={(e) => setPrefSummitDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="pref-cadence">Reminder Cadence</Label>
                    <select
                      id="pref-cadence"
                      value={prefCadence}
                      onChange={(e) =>
                        setPrefCadence(e.target.value as ReminderCadence)
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {REMINDER_CADENCE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="pref-day">Preferred Check-In Day</Label>
                    <select
                      id="pref-day"
                      value={prefDay}
                      onChange={(e) =>
                        setPrefDay(e.target.value as ReminderDay)
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {REMINDER_DAY_OPTIONS.map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="pref-channel">Delivery Channel</Label>
                    <select
                      id="pref-channel"
                      value={prefChannel}
                      onChange={(e) =>
                        setPrefChannel(e.target.value as ReminderChannel)
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {REMINDER_CHANNEL_OPTIONS.map((ch) => (
                        <option key={ch.value} value={ch.value}>
                          {ch.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowReminderSettings(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={isSavingPref}>
                    {isSavingPref ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Save Reminder Preferences
                  </Button>
                </div>
              </form>
            )}
          </div>

          {/* Custom Action Composer */}
          {showComposer && (
            <form
              onSubmit={handleAddCustomItem}
              className="rounded-xl border border-border bg-background p-5 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border/70 pb-3">
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Add Custom Ministry Action Milestone
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Create a church-specific goal tied to a summit session and
                    accountability horizon.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="new-action-title">Action Milestone Title</Label>
                  <Input
                    id="new-action-title"
                    placeholder="e.g., Launch Sunday first-time guest text follow-up workflow"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    maxLength={220}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="new-action-horizon">Target Horizon</Label>
                  <select
                    id="new-action-horizon"
                    value={newHorizon}
                    onChange={(e) =>
                      setNewHorizon(Number(e.target.value) as ActionHorizon)
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value={30}>30-Day Launch</option>
                    <option value={60}>60-Day Momentum</option>
                    <option value={90}>90-Day Integration</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="new-action-session">Source Session</Label>
                  <select
                    id="new-action-session"
                    value={newSessionId}
                    onChange={(e) => setNewSessionId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {agendaData.map((s) => (
                      <option key={s.id} value={s.id.toString()}>
                        Session {s.id}: {s.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="new-action-dept">Assigned Department</Label>
                  <select
                    id="new-action-dept"
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {MINISTRY_DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="new-action-church">Church / Organization</Label>
                  <Input
                    id="new-action-church"
                    value={newChurchName}
                    onChange={(e) => setNewChurchName(e.target.value)}
                    maxLength={150}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="new-action-assignee">Team Lead / Owner</Label>
                  <Input
                    id="new-action-assignee"
                    value={newAssignee}
                    onChange={(e) => setNewAssignee(e.target.value)}
                    maxLength={120}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="new-action-due">Target Due Date</Label>
                  <Input
                    id="new-action-due"
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                  <Label htmlFor="new-action-notes">
                    Implementation Notes (Optional)
                  </Label>
                  <Textarea
                    id="new-action-notes"
                    rows={2}
                    placeholder="Key steps, people to involve, or ministry metrics to track..."
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    maxLength={600}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowComposer(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isAddingItem}>
                  {isAddingItem ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Add to Action Plan
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Main Interactive Checklist Card */}
      <Card className="shadow-xl">
        <CardHeader className="border-b border-border/70 pb-4 space-y-4">
          {/* Horizon Tabs */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div
              className="flex flex-wrap items-center gap-1.5"
              role="tablist"
              aria-label="Filter action plan by day horizon"
            >
              <button
                type="button"
                role="tab"
                aria-selected={horizonFilter === 'all'}
                onClick={() => setHorizonFilter('all')}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors tabular-nums',
                  horizonFilter === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                All Milestones ({items.length})
              </button>
              {ACTION_HORIZONS.map((h) => {
                const bucket = stats.byHorizon[h];
                const active = horizonFilter === h;
                return (
                  <button
                    key={h}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setHorizonFilter(h)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors tabular-nums',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    {h}-Day ({bucket.completed}/{bucket.total})
                  </button>
                );
              })}
            </div>

            <div className="relative w-full md:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks, department..."
                className="h-9 pl-8 text-xs"
              />
            </div>
          </div>

          {/* Secondary Filters */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label
                htmlFor="filter-department"
                className="text-xs text-muted-foreground"
              >
                Department
              </Label>
              <select
                id="filter-department"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
              >
                <option value="all">All Departments</option>
                {availableDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label
                htmlFor="filter-session"
                className="text-xs text-muted-foreground"
              >
                Summit Session
              </Label>
              <select
                id="filter-session"
                value={sessionFilter}
                onChange={(e) => setSessionFilter(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
              >
                <option value="all">All 6 Sessions</option>
                {agendaData.map((s) => (
                  <option key={s.id} value={s.id.toString()}>
                    Session {s.id}: {s.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label
                htmlFor="filter-status"
                className="text-xs text-muted-foreground"
              >
                Progress Status
              </Label>
              <select
                id="filter-status"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as StatusFilter)
                }
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {isLoadingItems ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center space-y-3">
              <ListChecks className="mx-auto h-9 w-9 text-primary/80" />
              <h3 className="text-base font-bold text-foreground">
                Your 30 / 60 / 90-Day Ministry Action Plan is Ready to Populate
              </h3>
              <p className="mx-auto max-w-lg text-sm text-muted-foreground">
                Import all 18 structured action milestones distilled from Sessions
                1–6, automatically tagged to {syncedChurchDefault} and aligned
                with your summit calendar, or add a custom ministry task.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <Button
                  type="button"
                  onClick={handleSeedAllTemplates}
                  disabled={isSeedingTemplates}
                >
                  {isSeedingTemplates ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Import All 18 Summit Takeaways
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowComposer(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Custom Task
                </Button>
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center space-y-2">
              <p className="text-sm font-semibold text-foreground">
                No action items match your current filters.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setHorizonFilter('all');
                  setDepartmentFilter('all');
                  setSessionFilter('all');
                  setStatusFilter('all');
                  setSearchQuery('');
                }}
              >
                Reset Filters
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => {
                const isPending = pendingItemIds.has(item.id);
                const isEditing = editingItemId === item.id;
                const isDone = item.status === 'completed';

                return (
                  <div
                    key={item.id}
                    className={cn(
                      'rounded-xl border p-4 transition-colors',
                      isDone
                        ? 'border-border/70 bg-muted/20'
                        : 'border-border bg-background'
                    )}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleToggleComplete(item)}
                          disabled={isPending}
                          aria-label={
                            isDone
                              ? `Mark "${item.title}" incomplete`
                              : `Mark "${item.title}" complete`
                          }
                          className="mt-0.5 shrink-0 text-primary transition-transform hover:scale-105 disabled:opacity-50"
                        >
                          {isPending ? (
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          ) : isDone ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground hover:text-primary" />
                          )}
                        </button>

                        <div className="min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted-foreground tabular-nums">
                            <span className="font-semibold text-primary">
                              {item.horizonDays}-Day
                            </span>
                            <span>·</span>
                            <Link
                              href={`/session/${item.sessionId}`}
                              className="hover:text-primary hover:underline"
                            >
                              Session {item.sessionId}: {item.sessionTitle}
                            </Link>
                          </div>

                          <h4
                            className={cn(
                              'text-sm font-semibold leading-snug text-foreground',
                              isDone && 'line-through text-muted-foreground'
                            )}
                          >
                            {item.title}
                          </h4>

                          {item.notes && (
                            <p className="text-xs leading-relaxed text-muted-foreground">
                              {item.notes}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground tabular-nums">
                            <span className="inline-flex items-center gap-1">
                              <Building2 className="h-3.5 w-3.5" />
                              {item.churchName}
                            </span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1 font-medium text-foreground">
                              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                              {item.department}
                            </span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              {item.assigneeLabel}
                            </span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              Due {item.dueDateIso}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0 pl-8 sm:pl-0">
                        <div className="inline-flex rounded-md border border-border bg-muted/20 p-0.5">
                          {(
                            ['pending', 'in_progress', 'completed'] as const
                          ).map((st) => (
                            <button
                              key={st}
                              type="button"
                              disabled={isPending}
                              onClick={() => handleStatusChange(item, st)}
                              className={cn(
                                'rounded px-2 py-1 text-[11px] font-medium transition-colors',
                                item.status === st
                                  ? st === 'completed'
                                    ? 'bg-emerald-600 text-white'
                                    : st === 'in_progress'
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-background text-foreground shadow-sm'
                                  : 'text-muted-foreground hover:text-foreground'
                              )}
                            >
                              {STATUS_LABELS[st]}
                            </button>
                          ))}
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label={`Edit "${item.title}"`}
                          onClick={() =>
                            isEditing
                              ? setEditingItemId(null)
                              : startEditingItem(item)
                          }
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          disabled={isPending}
                          aria-label={`Delete "${item.title}"`}
                          onClick={() => handleDeleteItem(item)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {isEditing && (
                      <div className="mt-4 border-t border-border/80 pt-4 space-y-3 pl-0 sm:pl-8">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <div className="space-y-1 sm:col-span-2">
                            <Label className="text-xs">Action Title</Label>
                            <Input
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              maxLength={220}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Horizon</Label>
                            <select
                              value={editHorizon}
                              onChange={(e) =>
                                setEditHorizon(
                                  Number(e.target.value) as ActionHorizon
                                )
                              }
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                            >
                              <option value={30}>30-Day Launch</option>
                              <option value={60}>60-Day Momentum</option>
                              <option value={90}>90-Day Integration</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Department</Label>
                            <select
                              value={editDepartment}
                              onChange={(e) =>
                                setEditDepartment(e.target.value)
                              }
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                            >
                              {availableDepartments.map((dept) => (
                                <option key={dept} value={dept}>
                                  {dept}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Church / Ministry</Label>
                            <Input
                              value={editChurch}
                              onChange={(e) => setEditChurch(e.target.value)}
                              maxLength={150}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Assignee / Lead</Label>
                            <Input
                              value={editAssignee}
                              onChange={(e) => setEditAssignee(e.target.value)}
                              maxLength={120}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Due Date</Label>
                            <Input
                              type="date"
                              value={editDueDate}
                              onChange={(e) => setEditDueDate(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <Label className="text-xs">Notes</Label>
                            <Input
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              maxLength={600}
                            />
                          </div>
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingItemId(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={isPending}
                            onClick={() => handleSaveEdit(item.id)}
                          >
                            {isPending ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Save Changes
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
