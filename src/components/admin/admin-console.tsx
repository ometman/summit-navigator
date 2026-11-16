'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  Download,
  FileText,
  Layers,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { useFirebase } from '@/firebase';
import {
  grantModeratorAccess,
  revokeModeratorAccess,
  subscribeToModerators,
  type ModeratorRecord,
} from '@/firebase/qa';
import {
  bulkUpdateRegistrationStatus,
  getUserAdminRole,
  resetSessionOverride,
  resetSpeakerOverride,
  saveSessionOverride,
  saveSpeakerOverride,
  seedRegistrationsToFirestore,
  speakerNameToKey,
  subscribeToFirestoreRegistrations,
  type FirestoreRegistrationRecord,
  type UserAdminRole,
} from '@/firebase/admin-content';
import { useSummitContent } from '@/components/content/summit-content-provider';
import { ReminderCronPanel } from '@/components/admin/reminder-cron-panel';
import { agendaData, speakerData, type Session } from '@/lib/data';
import {
  buildSessionGuideContent,
  getDefaultStudyPacket,
  getSlidesForSession,
  triggerFileDownload,
  type PresentationSlide,
} from '@/lib/presentation-data';
import {
  REGISTRATIONS_STORAGE_KEY,
  initialRegistrations,
  mergeRegistrations,
  type RegistrationStatus,
  type UserRegistration,
} from '@/lib/registrations';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type AdminTab = 'sessions' | 'slides' | 'speakers' | 'approvals' | 'reminders';

const SLIDE_ACCENT_PRESETS = [
  '#375EAB',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#2563EB',
];

function roleLabel(role: UserAdminRole): string {
  switch (role) {
    case 'super_admin':
      return 'Primary Organizer Admin';
    case 'admin':
      return 'Organizer Admin';
    case 'moderator':
      return 'Session Moderator';
    case 'speaker':
      return 'Summit Speaker';
    default:
      return 'Verified Attendee';
  }
}

export function AdminConsole({ initialTab = 'sessions' }: { initialTab?: string }) {
  const { toast } = useToast();
  const { firestore, auth, user, isUserLoading, isMfaVerified, isMfaLoading } =
    useFirebase();
  const {
    sessions,
    speakers,
    sessionOverrides,
    speakerOverrides,
    slidesBySessionId,
    studyPacketsBySessionId,
  } = useSummitContent();

  const resolvedInitialTab: AdminTab =
    initialTab === 'slides' ||
    initialTab === 'speakers' ||
    initialTab === 'approvals'
      ? initialTab
      : 'sessions';

  const [activeTab, setActiveTab] = useState<AdminTab>(resolvedInitialTab);
  const [adminRole, setAdminRole] = useState<UserAdminRole>('attendee');
  const [roleChecking, setRoleChecking] = useState(true);
  const [copiedUid, setCopiedUid] = useState(false);

  // Session & Study Packet editor state
  const [selectedSessionId, setSelectedSessionId] = useState<number>(1);
  const [sessionTime, setSessionTime] = useState('');
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionSpeaker, setSessionSpeaker] = useState('');
  const [sessionContentMin, setSessionContentMin] = useState(40);
  const [sessionQaMin, setSessionQaMin] = useState(15);
  const [sessionPrayerMin, setSessionPrayerMin] = useState(5);
  const [sessionSummary, setSessionSummary] = useState('');
  const [packetTitle, setPacketTitle] = useState('');
  const [packetNotes, setPacketNotes] = useState('');
  const [slidesDraft, setSlidesDraft] = useState<PresentationSlide[]>([]);
  const [savingSession, setSavingSession] = useState(false);
  const [resettingSession, setResettingSession] = useState(false);

  // Speaker Bio editor state
  const [selectedSpeakerName, setSelectedSpeakerName] = useState<string>(
    speakerData[0].name
  );
  const [speakerRoleInput, setSpeakerRoleInput] = useState('');
  const [speakerBioInput, setSpeakerBioInput] = useState('');
  const [savingSpeaker, setSavingSpeaker] = useState(false);
  const [resettingSpeaker, setResettingSpeaker] = useState(false);

  // Bulk Registrations & Role Management state (Super Admin / Admin)
  const [apiRegistrations, setApiRegistrations] = useState<UserRegistration[]>([]);
  const [firestoreRegistrations, setFirestoreRegistrations] = useState<
    FirestoreRegistrationRecord[]
  >([]);
  const [regsLoading, setRegsLoading] = useState(false);
  const [regSearch, setRegSearch] = useState('');
  const [regStatusFilter, setRegStatusFilter] = useState<string>('all');
  const [regTrackFilter, setRegTrackFilter] = useState<string>('all');
  const [selectedRegIds, setSelectedRegIds] = useState<Set<string>>(new Set());
  const [batchTargetStatus, setBatchTargetStatus] =
    useState<RegistrationStatus>('Confirmed');
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [seedingRoster, setSeedingRoster] = useState(false);

  // Moderators & Admins management
  const [moderators, setModerators] = useState<ModeratorRecord[]>([]);
  const [grantUid, setGrantUid] = useState('');
  const [grantName, setGrantName] = useState('');
  const [grantRole, setGrantRole] = useState<'admin' | 'moderator' | 'speaker'>(
    'admin'
  );
  const [grantingRole, setGrantingRole] = useState(false);

  const isFullyVerified = Boolean(
    user && !user.isAnonymous && user.emailVerified && isMfaVerified
  );
  const canEditContent = adminRole !== 'attendee';
  const isAdminTier = adminRole === 'super_admin' || adminRole === 'admin';
  const isSuperAdmin = adminRole === 'super_admin';

  // Resolve user RBAC role
  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      if (!firestore || !isFullyVerified || !user) {
        if (!cancelled) {
          setAdminRole('attendee');
          setRoleChecking(false);
        }
        return;
      }
      setRoleChecking(true);
      try {
        const role = await getUserAdminRole(firestore, auth, user);
        if (!cancelled) setAdminRole(role);
      } catch {
        if (!cancelled) setAdminRole('attendee');
      } finally {
        if (!cancelled) setRoleChecking(false);
      }
    };
    resolve();
    return () => {
      cancelled = true;
    };
  }, [firestore, auth, user, isFullyVerified]);

  // Populate Session + Slides + Study Packet editor when selectedSessionId or overrides change
  useEffect(() => {
    const active =
      sessions.find((s) => s.id === selectedSessionId) || agendaData[0];
    const packet =
      studyPacketsBySessionId[active.id] || getDefaultStudyPacket(active);
    const slides =
      slidesBySessionId[active.id] || getSlidesForSession(active);

    setSessionTime(active.time);
    setSessionTitle(active.title);
    setSessionSpeaker(active.speaker);
    setSessionContentMin(active.content);
    setSessionQaMin(active.qa);
    setSessionPrayerMin(active.prayer);
    setSessionSummary(active.summary);
    setPacketTitle(packet.title);
    setPacketNotes(packet.notes);
    setSlidesDraft(slides.map((s) => ({ ...s, bullets: [...s.bullets] })));
  }, [selectedSessionId, sessions, slidesBySessionId, studyPacketsBySessionId]);

  // Populate Speaker Bio editor
  useEffect(() => {
    const sp =
      speakers.find((item) => item.name === selectedSpeakerName) ||
      speakerData[0];
    setSpeakerRoleInput(sp.role);
    setSpeakerBioInput(sp.bio);
  }, [selectedSpeakerName, speakers]);

  // Subscribe to Firestore registrations & moderators for Super Admin
  useEffect(() => {
    if (!firestore || !isSuperAdmin || !isFullyVerified) {
      setFirestoreRegistrations([]);
      setModerators([]);
      return;
    }

    setRegsLoading(true);
    const unsubRegs = subscribeToFirestoreRegistrations(
      firestore,
      auth,
      (records) => {
        setFirestoreRegistrations(records);
        setRegsLoading(false);
      },
      () => {
        setRegsLoading(false);
      }
    );

    const unsubMods = subscribeToModerators(
      firestore,
      auth,
      (list) => setModerators(list),
      () => {}
    );

    return () => {
      unsubRegs();
      unsubMods();
    };
  }, [firestore, auth, isSuperAdmin, isFullyVerified]);

  // Load baseline API + localStorage registrations for Super Admin seeding / bulk sync
  const loadApiRegistrations = useCallback(async () => {
    try {
      let localRows: UserRegistration[] = [];
      try {
        const raw = localStorage.getItem(REGISTRATIONS_STORAGE_KEY);
        if (raw) localRows = JSON.parse(raw) as UserRegistration[];
      } catch {
        localRows = [];
      }
      const res = await fetch('/api/registrations', { cache: 'no-store' });
      const data = res.ok ? await res.json() : { registrations: initialRegistrations };
      const apiRows: UserRegistration[] = Array.isArray(data.registrations)
        ? data.registrations
        : initialRegistrations;
      setApiRegistrations(mergeRegistrations(localRows, apiRows));
    } catch {
      setApiRegistrations(initialRegistrations);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin && isFullyVerified) {
      loadApiRegistrations();
    }
  }, [isSuperAdmin, isFullyVerified, loadApiRegistrations]);

  const firestoreRegIds = useMemo(
    () => new Set(firestoreRegistrations.map((r) => r.id)),
    [firestoreRegistrations]
  );

  const combinedRegistrations = useMemo(() => {
    return mergeRegistrations(firestoreRegistrations, apiRegistrations);
  }, [firestoreRegistrations, apiRegistrations]);

  const filteredRegistrations = useMemo(() => {
    const q = regSearch.trim().toLowerCase();
    return combinedRegistrations.filter((item) => {
      if (regStatusFilter !== 'all' && item.status !== regStatusFilter) {
        return false;
      }
      if (regTrackFilter !== 'all' && item.track !== regTrackFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.fullName.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        item.organization.toLowerCase().includes(q) ||
        item.role.toLowerCase().includes(q)
      );
    });
  }, [combinedRegistrations, regSearch, regStatusFilter, regTrackFilter]);

  const missingInFirestoreCount = useMemo(
    () =>
      apiRegistrations.filter((r) => !firestoreRegIds.has(r.id)).length,
    [apiRegistrations, firestoreRegIds]
  );

  const handleCopyUid = async () => {
    if (!user?.uid) return;
    try {
      await navigator.clipboard.writeText(user.uid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
      toast({
        title: 'UID copied',
        description: 'Share your UID with the Primary Organizer Admin to request role access.',
      });
    } catch {
      // Clipboard unavailable
    }
  };

  const handleSaveSessionAndDeck = async (sourceLabel: string) => {
    if (!firestore || !user || !canEditContent) return;
    setSavingSession(true);
    try {
      await saveSessionOverride(firestore, auth, {
        sessionId: String(selectedSessionId),
        time: sessionTime,
        title: sessionTitle,
        speaker: sessionSpeaker,
        content: sessionContentMin,
        qa: sessionQaMin,
        prayer: sessionPrayerMin,
        summary: sessionSummary,
        studyPacketTitle: packetTitle,
        studyPacketNotes: packetNotes,
        slides: slidesDraft,
        updatedBy: user.uid,
      });
      toast({
        title: `${sourceLabel} saved`,
        description: `Session ${selectedSessionId} updates are now live across the Summit Navigator dashboard and downloads.`,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description:
          err instanceof Error
            ? err.message
            : 'Unable to save session updates.',
      });
    } finally {
      setSavingSession(false);
    }
  };

  const handleResetSession = async () => {
    if (!firestore || !isAdminTier) return;
    setResettingSession(true);
    try {
      await resetSessionOverride(firestore, auth, String(selectedSessionId));
      toast({
        title: 'Session restored to defaults',
        description: `Session ${selectedSessionId} schedule, slides, and study packet reset.`,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Reset failed',
        description:
          err instanceof Error ? err.message : 'Unable to reset session.',
      });
    } finally {
      setResettingSession(false);
    }
  };

  const handlePreviewPacketDownload = (formatType: 'md' | 'txt') => {
    const base =
      sessions.find((s) => s.id === selectedSessionId) || agendaData[0];
    const previewSession: Session = {
      ...base,
      time: sessionTime || base.time,
      title: sessionTitle || base.title,
      speaker: sessionSpeaker || base.speaker,
      content: sessionContentMin,
      qa: sessionQaMin,
      prayer: sessionPrayerMin,
      summary: sessionSummary || base.summary,
    };
    const file = buildSessionGuideContent(
      previewSession,
      formatType,
      slidesDraft,
      {
        title: packetTitle || getDefaultStudyPacket(previewSession).title,
        notes: packetNotes,
      }
    );
    triggerFileDownload(file.filename, file.content, file.mimeType);
    toast({
      title: 'Study packet downloaded',
      description: `Saved ${file.filename}`,
    });
  };

  // Slide deck list handlers
  const handleAddSlide = () => {
    if (slidesDraft.length >= 8) {
      toast({
        variant: 'destructive',
        title: 'Maximum 8 slides',
        description: 'Each session deck supports up to 8 slides.',
      });
      return;
    }
    setSlidesDraft((prev) => [
      ...prev,
      {
        heading: `Key Insight ${prev.length + 1}`,
        subheading: `${sessionSpeaker} · Session ${selectedSessionId}`,
        bullets: ['Actionable takeaway for church leadership teams.'],
        caption: 'Summarize the core principle for attendees.',
        accentHex: SLIDE_ACCENT_PRESETS[prev.length % SLIDE_ACCENT_PRESETS.length],
      },
    ]);
  };

  const handleRemoveSlide = (index: number) => {
    if (slidesDraft.length <= 1) return;
    setSlidesDraft((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleMoveSlide = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= slidesDraft.length) return;
    setSlidesDraft((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const updateSlideField = (
    index: number,
    patch: Partial<PresentationSlide>
  ) => {
    setSlidesDraft((prev) =>
      prev.map((slide, idx) => (idx === index ? { ...slide, ...patch } : slide))
    );
  };

  // Speaker handlers
  const handleSaveSpeaker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user || !canEditContent) return;
    setSavingSpeaker(true);
    try {
      await saveSpeakerOverride(firestore, auth, {
        name: selectedSpeakerName,
        role: speakerRoleInput,
        bio: speakerBioInput,
        updatedBy: user.uid,
      });
      toast({
        title: 'Speaker bio updated',
        description: `${selectedSpeakerName}'s role and bio are synced across speaker profiles and summit packs.`,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description:
          err instanceof Error ? err.message : 'Unable to save speaker bio.',
      });
    } finally {
      setSavingSpeaker(false);
    }
  };

  const handleResetSpeaker = async () => {
    if (!firestore || !isAdminTier) return;
    setResettingSpeaker(true);
    try {
      await resetSpeakerOverride(firestore, auth, selectedSpeakerName);
      toast({
        title: 'Speaker restored to default',
        description: `${selectedSpeakerName}'s original profile bio has been restored.`,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Reset failed',
        description:
          err instanceof Error ? err.message : 'Unable to restore speaker.',
      });
    } finally {
      setResettingSpeaker(false);
    }
  };

  // Bulk registration handlers
  const handleToggleRegSelection = (id: string) => {
    setSelectedRegIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const allFilteredSelected =
    filteredRegistrations.length > 0 &&
    filteredRegistrations.every((r) => selectedRegIds.has(r.id));

  const handleToggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedRegIds((prev) => {
        const next = new Set(prev);
        for (const r of filteredRegistrations) {
          next.delete(r.id);
        }
        return next;
      });
    } else {
      setSelectedRegIds((prev) => {
        const next = new Set(prev);
        for (const r of filteredRegistrations) {
          next.add(r.id);
        }
        return next;
      });
    }
  };

  const handleSeedRoster = async () => {
    if (!firestore || !user || !isSuperAdmin) return;
    setSeedingRoster(true);
    try {
      const count = await seedRegistrationsToFirestore(
        firestore,
        auth,
        apiRegistrations,
        firestoreRegIds,
        user.uid
      );
      toast({
        title: count > 0 ? 'Roster synced to Firestore' : 'Roster already synced',
        description:
          count > 0
            ? `Uploaded ${count} baseline registration records for batch management.`
            : 'All registration records are already stored in Firestore.',
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Sync failed',
        description:
          err instanceof Error ? err.message : 'Unable to sync baseline roster.',
      });
    } finally {
      setSeedingRoster(false);
    }
  };

  const handleBulkStatusApply = async () => {
    if (!firestore || !user || !isSuperAdmin || selectedRegIds.size === 0) {
      return;
    }

    const targets = combinedRegistrations.filter((r) =>
      selectedRegIds.has(r.id)
    );
    if (targets.length === 0) return;

    setBatchProcessing(true);
    try {
      const updatedCount = await bulkUpdateRegistrationStatus(firestore, auth, {
        records: targets,
        existingFirestoreIds: firestoreRegIds,
        targetStatus: batchTargetStatus,
        adminUid: user.uid,
      });

      // Mirror updates into localStorage & /api/registrations best-effort so report stays aligned
      const updatedLocal = combinedRegistrations.map((r) =>
        selectedRegIds.has(r.id) ? { ...r, status: batchTargetStatus } : r
      );
      setApiRegistrations(updatedLocal);
      try {
        localStorage.setItem(
          REGISTRATIONS_STORAGE_KEY,
          JSON.stringify(updatedLocal)
        );
      } catch {
        // Ignore storage errors
      }

      await Promise.allSettled(
        targets.map((item) =>
          fetch('/api/registrations', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: item.id,
              email: item.email,
              fullName: item.fullName,
              organization: item.organization,
              role: item.role,
              track: item.track,
              status: batchTargetStatus,
            }),
          })
        )
      );

      setSelectedRegIds(new Set());
      toast({
        title: 'Bulk approval complete',
        description: `Updated ${updatedCount} registration${
          updatedCount === 1 ? '' : 's'
        } to ${batchTargetStatus} via atomic Firestore batch.`,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Batch update failed',
        description:
          err instanceof Error
            ? err.message
            : 'Unable to apply bulk registration status.',
      });
    } finally {
      setBatchProcessing(false);
    }
  };

  const handleGrantRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user || !isSuperAdmin) return;
    setGrantingRole(true);
    try {
      await grantModeratorAccess(firestore, auth, {
        targetUid: grantUid,
        displayName: grantName,
        role: grantRole,
        adminUid: user.uid,
      });
      toast({
        title: 'Role assigned',
        description: `Granted ${grantRole} access to ${grantName}.`,
      });
      setGrantUid('');
      setGrantName('');
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Role assignment failed',
        description:
          err instanceof Error ? err.message : 'Unable to assign role.',
      });
    } finally {
      setGrantingRole(false);
    }
  };

  const handleRevokeRole = async (targetUid: string, displayName: string) => {
    if (!firestore || !isSuperAdmin) return;
    try {
      await revokeModeratorAccess(firestore, auth, targetUid);
      toast({
        title: 'Role revoked',
        description: `Removed console access for ${displayName}.`,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Revoke failed',
        description:
          err instanceof Error ? err.message : 'Unable to revoke role.',
      });
    }
  };

  // Loading state
  if (isUserLoading || isMfaLoading || (isFullyVerified && roleChecking)) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  // Unauthenticated or unverified MFA gate
  if (!isFullyVerified || !user) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 max-w-2xl mx-auto text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">
          Organizer Authentication Required
        </h2>
        <p className="text-sm text-muted-foreground">
          Sign in with your verified Google account and complete Email OTP verification to access the Role-Based Admin Console.
        </p>
        <div className="pt-2">
          <Button asChild>
            <Link href="/login">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Sign In &amp; Verify MFA
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Authenticated Attendee (no organizer/speaker role assigned in Firestore)
  if (!canEditContent) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 max-w-2xl mx-auto space-y-5">
        <div className="flex items-start gap-3">
          <Lock className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-foreground">
              Organizer or Speaker Role Required
            </h2>
            <p className="text-sm text-muted-foreground">
              Your account ({user.email}) is verified as an attendee. Firestore security rules restrict session editing, slide deck publishing, and bulk registration approvals to authorized organizers, moderators, and speakers.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Your Firebase User UID (share with Primary Organizer Admin for role assignment)
          </p>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={user.uid}
              className="font-mono text-xs bg-background"
              aria-label="Your Firebase User UID"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyUid}
              className="shrink-0"
            >
              {copiedUid ? (
                <>
                  <Check className="h-4 w-4 mr-1.5 text-emerald-600" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1.5" />
                  Copy UID
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <Link href="/dashboard">Return to Dashboard</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/directory">Open Leadership Directory</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isSessionOverridden = Boolean(sessionOverrides[selectedSessionId]);
  const isSpeakerOverridden = Boolean(
    speakerOverrides[speakerNameToKey(selectedSpeakerName)]
  );
  const totalSessionMinutes = sessionContentMin + sessionQaMin + sessionPrayerMin;

  return (
    <div className="space-y-6">
      {/* Console Banner */}
      <section className="bg-card border border-border rounded-xl p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>{roleLabel(adminRole)}</span>
            <span>·</span>
            <span>{user.email}</span>
            <span>·</span>
            <span>Enforced by Firestore Rules</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Organizer Admin Console &amp; Content Editor
          </h2>
          <p className="text-sm text-muted-foreground">
            Update summit schedules, slide decks, speaker biographies, study packets, and batch registration approvals in real time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="outline" asChild size="sm">
            <Link href="/dashboard">View Live Agenda</Link>
          </Button>
          <Button variant="outline" asChild size="sm">
            <Link href="/dashboard/registrations">Registration Report</Link>
          </Button>
        </div>
      </section>

      {/* Main 4-Tab Workspace */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as AdminTab)}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 h-auto p-1">
          <TabsTrigger value="sessions" className="py-2.5 text-xs sm:text-sm">
            <Clock className="h-4 w-4 mr-1.5 shrink-0" />
            Sessions &amp; Packets
          </TabsTrigger>
          <TabsTrigger value="slides" className="py-2.5 text-xs sm:text-sm">
            <Layers className="h-4 w-4 mr-1.5 shrink-0" />
            Slide Decks
          </TabsTrigger>
          <TabsTrigger value="speakers" className="py-2.5 text-xs sm:text-sm">
            <Users className="h-4 w-4 mr-1.5 shrink-0" />
            Speaker Bios
          </TabsTrigger>
          <TabsTrigger value="approvals" className="py-2.5 text-xs sm:text-sm">
            <UserCheck className="h-4 w-4 mr-1.5 shrink-0" />
            Bulk Approvals &amp; Roles
          </TabsTrigger>
          <TabsTrigger value="reminders" className="py-2.5 text-xs sm:text-sm">
            <Bell className="h-4 w-4 mr-1.5 shrink-0" />
            Reminders &amp; Cron
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Sessions & Study Packets */}
        <TabsContent value="sessions" className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Session Schedule &amp; Study Packet Editor
                </h3>
                <p className="text-xs text-muted-foreground">
                  Edits sync immediately to Agenda cards, Session detail pages, and downloadable study packets.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sessions.map((s) => {
                  const active = s.id === selectedSessionId;
                  const customized = Boolean(sessionOverrides[s.id]);
                  return (
                    <Button
                      key={s.id}
                      type="button"
                      size="sm"
                      variant={active ? 'default' : 'outline'}
                      onClick={() => setSelectedSessionId(s.id)}
                      className="tabular-nums"
                    >
                      S{s.id}
                      {customized && (
                        <span
                          className={cn(
                            'ml-1.5 inline-block h-1.5 w-1.5 rounded-full',
                            active ? 'bg-white' : 'bg-emerald-500'
                          )}
                          title="Customized in Firestore"
                        />
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Session Timing & Details */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-session-time">Session Time Window</Label>
                    <Input
                      id="admin-session-time"
                      value={sessionTime}
                      onChange={(e) => setSessionTime(e.target.value)}
                      placeholder="9:00 AM - 10:00 AM"
                      maxLength={80}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-session-speaker">Assigned Speaker</Label>
                    <Input
                      id="admin-session-speaker"
                      value={sessionSpeaker}
                      onChange={(e) => setSessionSpeaker(e.target.value)}
                      maxLength={120}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="admin-session-title">Session Title</Label>
                  <Input
                    id="admin-session-title"
                    value={sessionTitle}
                    onChange={(e) => setSessionTitle(e.target.value)}
                    maxLength={160}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-min-content">Content (min)</Label>
                    <Input
                      id="admin-min-content"
                      type="number"
                      min={1}
                      max={180}
                      value={sessionContentMin}
                      onChange={(e) =>
                        setSessionContentMin(Number(e.target.value) || 1)
                      }
                      className="tabular-nums"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-min-qa">Q&amp;A (min)</Label>
                    <Input
                      id="admin-min-qa"
                      type="number"
                      min={0}
                      max={120}
                      value={sessionQaMin}
                      onChange={(e) =>
                        setSessionQaMin(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="tabular-nums"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-min-prayer">Prayer (min)</Label>
                    <Input
                      id="admin-min-prayer"
                      type="number"
                      min={0}
                      max={60}
                      value={sessionPrayerMin}
                      onChange={(e) =>
                        setSessionPrayerMin(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="tabular-nums"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">
                  Total Session Duration: <span className="font-semibold text-foreground">{totalSessionMinutes} minutes</span>
                </p>

                <div className="space-y-1.5">
                  <Label htmlFor="admin-session-summary">Session Summary</Label>
                  <Textarea
                    id="admin-session-summary"
                    rows={4}
                    value={sessionSummary}
                    onChange={(e) => setSessionSummary(e.target.value)}
                    maxLength={2000}
                  />
                </div>
              </div>

              {/* Downloadable Study Packet */}
              <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-bold text-foreground">
                      Downloadable Study Packet
                    </h4>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handlePreviewPacketDownload('md')}
                    >
                      <Download className="h-3.5 w-3.5 mr-1" />
                      .md
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handlePreviewPacketDownload('txt')}
                    >
                      <Download className="h-3.5 w-3.5 mr-1" />
                      .txt
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="admin-packet-title">Study Packet Title</Label>
                  <Input
                    id="admin-packet-title"
                    value={packetTitle}
                    onChange={(e) => setPacketTitle(e.target.value)}
                    maxLength={160}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="admin-packet-notes">
                    Organizer Notes, Discussion Prompts &amp; Action Steps
                  </Label>
                  <Textarea
                    id="admin-packet-notes"
                    rows={8}
                    value={packetNotes}
                    onChange={(e) => setPacketNotes(e.target.value)}
                    maxLength={4000}
                    placeholder="Add scripture references, group prompts, or 30-day action steps..."
                  />
                  <p className="text-xs text-muted-foreground tabular-nums text-right">
                    {packetNotes.length} / 4000 characters
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {isSessionOverridden ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Live Firestore override active for Session {selectedSessionId}
                  </span>
                ) : (
                  <span>Using baseline schedule &amp; default study packet</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isAdminTier && isSessionOverridden && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleResetSession}
                    disabled={resettingSession || savingSession}
                  >
                    {resettingSession ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4 mr-1.5" />
                    )}
                    Reset to Default
                  </Button>
                )}

                <Button
                  type="button"
                  onClick={() => handleSaveSessionAndDeck('Session & study packet')}
                  disabled={savingSession}
                >
                  {savingSession ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-1.5" />
                      Save Session &amp; Packet
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: Slide Decks */}
        <TabsContent value="slides" className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Session Slide Deck Editor
                </h3>
                <p className="text-xs text-muted-foreground">
                  Customize up to 8 keynote slides per session. Changes update the Keynote Video Player and downloadable briefs live.
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {sessions.map((s) => (
                  <Button
                    key={s.id}
                    type="button"
                    size="sm"
                    variant={s.id === selectedSessionId ? 'default' : 'outline'}
                    onClick={() => setSelectedSessionId(s.id)}
                    className="tabular-nums"
                  >
                    Session {s.id}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground tabular-nums">
                Editing <span className="font-semibold text-foreground">{sessionTitle}</span> · {slidesDraft.length} of 8 slides
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddSlide}
                  disabled={slidesDraft.length >= 8}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Slide
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleSaveSessionAndDeck('Slide deck')}
                  disabled={savingSession}
                >
                  {savingSession ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1.5" />
                  )}
                  Publish Slide Deck
                </Button>
              </div>
            </div>

            <div className="space-y-5">
              {slidesDraft.map((slide, slideIdx) => (
                <div
                  key={slideIdx}
                  className="rounded-xl border border-border bg-muted/15 p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="inline-block h-3.5 w-3.5 rounded-sm border border-border"
                        style={{ backgroundColor: slide.accentHex }}
                      />
                      <span className="text-sm font-bold text-foreground tabular-nums">
                        Slide {slideIdx + 1}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleMoveSlide(slideIdx, -1)}
                        disabled={slideIdx === 0}
                        title="Move slide up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleMoveSlide(slideIdx, 1)}
                        disabled={slideIdx === slidesDraft.length - 1}
                        title="Move slide down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveSlide(slideIdx)}
                        disabled={slidesDraft.length <= 1}
                        title="Remove slide"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Slide Heading</Label>
                      <Input
                        value={slide.heading}
                        onChange={(e) =>
                          updateSlideField(slideIdx, { heading: e.target.value })
                        }
                        maxLength={160}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Subheading</Label>
                      <Input
                        value={slide.subheading}
                        onChange={(e) =>
                          updateSlideField(slideIdx, { subheading: e.target.value })
                        }
                        maxLength={160}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 space-y-1.5">
                      <Label>Presenter Caption</Label>
                      <Input
                        value={slide.caption}
                        onChange={(e) =>
                          updateSlideField(slideIdx, { caption: e.target.value })
                        }
                        maxLength={300}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Accent Color</Label>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {SLIDE_ACCENT_PRESETS.map((hex) => (
                            <button
                              key={hex}
                              type="button"
                              onClick={() =>
                                updateSlideField(slideIdx, { accentHex: hex })
                              }
                              className={cn(
                                'h-6 w-6 rounded border transition-transform',
                                slide.accentHex.toUpperCase() === hex
                                  ? 'ring-2 ring-primary scale-110'
                                  : 'border-border'
                              )}
                              style={{ backgroundColor: hex }}
                              title={hex}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Bullet Takeaways (1–6 points)</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={slide.bullets.length >= 6}
                        onClick={() =>
                          updateSlideField(slideIdx, {
                            bullets: [...slide.bullets, 'New key insight'],
                          })
                        }
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add Bullet
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {slide.bullets.map((bullet, bIdx) => (
                        <div key={bIdx} className="flex items-center gap-2">
                          <Input
                            value={bullet}
                            onChange={(e) => {
                              const nextBullets = [...slide.bullets];
                              nextBullets[bIdx] = e.target.value;
                              updateSlideField(slideIdx, { bullets: nextBullets });
                            }}
                            maxLength={240}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={slide.bullets.length <= 1}
                            onClick={() => {
                              const nextBullets = slide.bullets.filter(
                                (_, i) => i !== bIdx
                              );
                              updateSlideField(slideIdx, { bullets: nextBullets });
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: Speaker Bios */}
        <TabsContent value="speakers" className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Speaker Role &amp; Biography Editor
                </h3>
                <p className="text-xs text-muted-foreground">
                  Changes sync immediately across dashboard speaker tooltips, speaker profile pages, and summit program packs.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {speakers.map((sp) => {
                  const active = sp.name === selectedSpeakerName;
                  const customized = Boolean(
                    speakerOverrides[speakerNameToKey(sp.name)]
                  );
                  return (
                    <Button
                      key={sp.name}
                      type="button"
                      size="sm"
                      variant={active ? 'default' : 'outline'}
                      onClick={() => setSelectedSpeakerName(sp.name)}
                    >
                      {sp.name}
                      {customized && (
                        <span
                          className={cn(
                            'ml-1.5 inline-block h-1.5 w-1.5 rounded-full',
                            active ? 'bg-white' : 'bg-emerald-500'
                          )}
                        />
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleSaveSpeaker} className="space-y-4 max-w-3xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Speaker Name</Label>
                  <Input readOnly value={selectedSpeakerName} className="bg-muted/40" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-speaker-role">Specialty Title / Role</Label>
                  <Input
                    id="admin-speaker-role"
                    value={speakerRoleInput}
                    onChange={(e) => setSpeakerRoleInput(e.target.value)}
                    maxLength={120}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admin-speaker-bio">Biography</Label>
                <Textarea
                  id="admin-speaker-bio"
                  rows={6}
                  value={speakerBioInput}
                  onChange={(e) => setSpeakerBioInput(e.target.value)}
                  maxLength={2000}
                  required
                />
                <p className="text-xs text-muted-foreground tabular-nums text-right">
                  {speakerBioInput.length} / 2000 characters
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href={`/speaker/${selectedSpeakerName.replace(/\s/g, '+')}`}
                  >
                    Preview Public Speaker Profile
                  </Link>
                </Button>

                <div className="flex items-center gap-2">
                  {isAdminTier && isSpeakerOverridden && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleResetSpeaker}
                      disabled={resettingSpeaker || savingSpeaker}
                    >
                      {resettingSpeaker ? (
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4 mr-1.5" />
                      )}
                      Restore Default
                    </Button>
                  )}

                  <Button type="submit" disabled={savingSpeaker}>
                    {savingSpeaker ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-1.5" />
                        Save Speaker Bio
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </TabsContent>

        {/* TAB 4: Bulk Registration Approvals & Role Management */}
        <TabsContent value="approvals" className="space-y-6">
          {!isSuperAdmin ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Primary Organizer Admin Required</AlertTitle>
              <AlertDescription>
                Firestore security rules restrict full attendee PII roster listing, batch registration status approvals, and role delegation to the Primary Organizer Admin account (`stackvarsity@gmail.com`). Your current role ({roleLabel(adminRole)}) grants access to session, slide deck, and speaker content editors.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Bulk Registration Approvals */}
              <div className="bg-card border border-border rounded-xl p-6 space-y-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      Bulk Registration Approvals
                    </h3>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {firestoreRegistrations.length} records in Firestore ·{' '}
                      {combinedRegistrations.filter((r) => r.status === 'Pending Verification').length}{' '}
                      pending verification ·{' '}
                      {combinedRegistrations.filter((r) => r.status === 'Confirmed').length}{' '}
                      confirmed ·{' '}
                      {combinedRegistrations.filter((r) => r.status === 'Checked In').length}{' '}
                      checked in
                    </p>
                  </div>

                  {missingInFirestoreCount > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSeedRoster}
                      disabled={seedingRoster}
                    >
                      {seedingRoster ? (
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      ) : (
                        <Database className="h-4 w-4 mr-1.5" />
                      )}
                      Sync {missingInFirestoreCount} Baseline Records to Firestore
                    </Button>
                  )}
                </div>

                {/* Search + Filter + Batch Action Toolbar */}
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-col sm:flex-row gap-2.5 flex-1">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="search"
                        placeholder="Search attendee, church, or email..."
                        value={regSearch}
                        onChange={(e) => setRegSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Select
                      value={regStatusFilter}
                      onValueChange={setRegStatusFilter}
                    >
                      <SelectTrigger className="w-full sm:w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="Pending Verification">
                          Pending Verification
                        </SelectItem>
                        <SelectItem value="Confirmed">Confirmed</SelectItem>
                        <SelectItem value="Checked In">Checked In</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={regTrackFilter}
                      onValueChange={setRegTrackFilter}
                    >
                      <SelectTrigger className="w-full sm:w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tracks</SelectItem>
                        <SelectItem value="Morning & Afternoon">
                          Morning &amp; Afternoon
                        </SelectItem>
                        <SelectItem value="Morning Track">Morning Track</SelectItem>
                        <SelectItem value="Afternoon Track">
                          Afternoon Track
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Batch Bar */}
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <span className="text-xs font-medium text-muted-foreground tabular-nums whitespace-nowrap">
                      {selectedRegIds.size} selected
                    </span>
                    <Select
                      value={batchTargetStatus}
                      onValueChange={(v) =>
                        setBatchTargetStatus(v as RegistrationStatus)
                      }
                    >
                      <SelectTrigger className="w-44 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Confirmed">
                          Approve as Confirmed
                        </SelectItem>
                        <SelectItem value="Checked In">
                          Mark Checked In
                        </SelectItem>
                        <SelectItem value="Pending Verification">
                          Set Pending Verification
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="sm"
                      disabled={selectedRegIds.size === 0 || batchProcessing}
                      onClick={handleBulkStatusApply}
                      className="h-8 whitespace-nowrap"
                    >
                      {batchProcessing ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>Apply Batch ({selectedRegIds.size})</>
                      )}
                    </Button>
                  </div>
                </div>

                {regsLoading ? (
                  <div className="space-y-2.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-11 w-full" />
                    ))}
                  </div>
                ) : filteredRegistrations.length === 0 ? (
                  <div className="py-10 text-center border border-dashed border-border rounded-lg text-sm text-muted-foreground">
                    No matching attendee registrations found.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={allFilteredSelected}
                            onCheckedChange={handleToggleSelectAllFiltered}
                            aria-label="Select all filtered registrations"
                          />
                        </TableHead>
                        <TableHead>Attendee</TableHead>
                        <TableHead>Organization &amp; Role</TableHead>
                        <TableHead>Track</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Registered</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRegistrations.map((row) => {
                        const checked = selectedRegIds.has(row.id);
                        return (
                          <TableRow key={row.id}>
                            <TableCell>
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() =>
                                  handleToggleRegSelection(row.id)
                                }
                                aria-label={`Select ${row.fullName}`}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-foreground">
                                {row.fullName}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {row.email}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-foreground">
                                {row.organization}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {row.role}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-foreground">
                              {row.track}
                            </TableCell>
                            <TableCell>
                              <span
                                className={cn(
                                  'text-xs font-medium whitespace-nowrap',
                                  row.status === 'Checked In'
                                    ? 'text-emerald-700'
                                    : row.status === 'Confirmed'
                                    ? 'text-primary'
                                    : 'text-amber-700'
                                )}
                              >
                                {row.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground font-mono tabular-nums whitespace-nowrap">
                              {format(parseISO(row.registeredAt), 'MMM d · HH:mm')}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>

              {/* Organizer & Speaker Role Assignments */}
              <div className="bg-card border border-border rounded-xl p-6 space-y-5">
                <div className="border-b pb-3">
                  <h3 className="text-lg font-bold text-foreground">
                    Role-Based Access Assignments
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Grant or revoke Organizer Admin, Session Moderator, or Speaker access backed by `/moderators/{'{uid}'}` in Firestore rules.
                  </p>
                </div>

                <form
                  onSubmit={handleGrantRole}
                  className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="grant-uid">Firebase User UID</Label>
                    <Input
                      id="grant-uid"
                      placeholder="Paste verified user UID"
                      value={grantUid}
                      onChange={(e) => setGrantUid(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="grant-name">Display Name</Label>
                    <Input
                      id="grant-name"
                      placeholder="Omet Omeni"
                      value={grantName}
                      onChange={(e) => setGrantName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="grant-role">Role</Label>
                    <Select
                      value={grantRole}
                      onValueChange={(v) =>
                        setGrantRole(v as 'admin' | 'moderator' | 'speaker')
                      }
                    >
                      <SelectTrigger id="grant-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">
                          Admin (Content + Resets)
                        </SelectItem>
                        <SelectItem value="moderator">
                          Moderator (Q&amp;A + Polls + Content)
                        </SelectItem>
                        <SelectItem value="speaker">
                          Speaker (Decks + Q&amp;A + Polls)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" disabled={grantingRole}>
                    {grantingRole ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4 mr-1.5" />
                    )}
                    Assign Role
                  </Button>
                </form>

                {moderators.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No additional delegated admins, moderators, or speakers assigned yet.
                  </p>
                ) : (
                  <div className="divide-y divide-border rounded-lg border border-border">
                    {moderators.map((mod) => (
                      <div
                        key={mod.uid}
                        className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">
                            {mod.displayName}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono truncate">
                            {mod.role} · {mod.uid}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleRevokeRole(mod.uid, mod.displayName)
                          }
                          className="text-destructive hover:text-destructive shrink-0"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Revoke
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </TabsContent>

        {/* TAB 5: Automated Reminder Email Cron */}
        <TabsContent value="reminders" className="space-y-6">
          <ReminderCronPanel isSuperAdmin={isSuperAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
