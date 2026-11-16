'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Inbox,
  Loader2,
  LogIn,
  Mic,
  Search,
  Send,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { agendaData, speakerData } from '@/lib/data';
import type { RegistrationTrack } from '@/lib/registrations';
import { useFirebase } from '@/firebase';
import { getVerifiedUserProfile } from '@/firebase/user-profile';
import {
  checkUserModeratorAccess,
  testFirestoreConnection,
} from '@/firebase/qa';
import {
  CONNECTION_MESSAGE_MAX_LENGTH,
  CONNECTION_MESSAGE_MIN_LENGTH,
  DIRECTORY_BIO_MAX_LENGTH,
  DIRECTORY_ROLES,
  DIRECTORY_TRACKS,
  parseFocusTopicsInput,
  respondToDirectoryConnection,
  sendDirectoryConnection,
  subscribeToOptedInDirectory,
  subscribeToOwnDirectoryProfile,
  subscribeToUserConnections,
  upsertDirectoryProfile,
  type DirectoryProfileRecord,
  type UserConnectionsState,
} from '@/firebase/directory';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type WorkspaceTab = 'browse' | 'connections' | 'profile';

function extractFriendlyErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  let detail = raw;
  try {
    const parsed = JSON.parse(raw) as { error?: string };
    if (parsed && typeof parsed.error === 'string') {
      detail = parsed.error;
    }
  } catch {
    // Plain error message
  }
  if (detail.includes('Quota exceeded')) {
    return 'Daily Firestore quota exceeded. Directory updates will resume when the quota resets.';
  }
  if (
    detail.toLowerCase().includes('permission') ||
    detail.toLowerCase().includes('insufficient')
  ) {
    return 'Permission denied. Confirm Google Sign-In, Email OTP verification, and directory opt-in status.';
  }
  return detail || 'Unable to sync leadership directory right now.';
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'SL';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function DirectoryWorkspace() {
  const { firestore, auth, user, isUserLoading, isMfaVerified } = useFirebase();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('browse');
  const [directoryProfiles, setDirectoryProfiles] = useState<
    DirectoryProfileRecord[]
  >([]);
  const [ownProfile, setOwnProfile] = useState<DirectoryProfileRecord | null>(
    null
  );
  const [connections, setConnections] = useState<UserConnectionsState>({
    sent: [],
    received: [],
    byPeerUid: new Map(),
  });

  const [isLoadingDirectory, setIsLoadingDirectory] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isModerator, setIsModerator] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedTrack, setSelectedTrack] = useState<string>('all');
  const [speakersOnly, setSpeakersOnly] = useState(false);

  // Opt-In Profile Form State
  const [formFullName, setFormFullName] = useState('');
  const [formOrg, setFormOrg] = useState('');
  const [formRole, setFormRole] = useState<string>('Ministry Lead');
  const [formTrack, setFormTrack] = useState<RegistrationTrack>(
    'Morning & Afternoon'
  );
  const [formBio, setFormBio] = useState('');
  const [formTopicsText, setFormTopicsText] = useState('');
  const [formOptedIn, setFormOptedIn] = useState(true);
  const [formAsSpeaker, setFormAsSpeaker] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [hasPrefilledFromUserDoc, setHasPrefilledFromUserDoc] = useState(false);

  // Connect Modal State
  const [connectTarget, setConnectTarget] =
    useState<DirectoryProfileRecord | null>(null);
  const [connectMessage, setConnectMessage] = useState('');
  const [isSendingConnect, setIsSendingConnect] = useState(false);

  // Reply / Accept State
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [pendingRespondIds, setPendingRespondIds] = useState<Set<string>>(
    new Set()
  );

  const canParticipate = Boolean(
    user && !user.isAnonymous && user.emailVerified && isMfaVerified
  );
  const canListAsSpeaker = Boolean(canParticipate && isModerator);

  useEffect(() => {
    if (!firestore) return;
    void testFirestoreConnection(firestore);
  }, [firestore]);

  useEffect(() => {
    let active = true;
    if (!firestore || isUserLoading) return;
    if (!user || user.isAnonymous || !user.emailVerified) {
      setIsModerator(false);
      return;
    }

    checkUserModeratorAccess(firestore, auth, user)
      .then((allowed) => {
        if (active) setIsModerator(allowed);
      })
      .catch(() => {
        if (active) setIsModerator(false);
      });

    return () => {
      active = false;
    };
  }, [firestore, auth, user, isUserLoading]);

  // 1. Live subscription to all opted-in directory profiles
  useEffect(() => {
    if (!firestore || isUserLoading) return;

    setIsLoadingDirectory(true);
    setStreamError(null);

    const unsubscribe = subscribeToOptedInDirectory(
      firestore,
      auth,
      (profiles) => {
        setDirectoryProfiles(profiles);
        setIsLoadingDirectory(false);
        setStreamError(null);
      },
      (err) => {
        setStreamError(extractFriendlyErrorMessage(err));
        setIsLoadingDirectory(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, auth, isUserLoading]);

  // 2. Live subscription to current user's directory profile
  useEffect(() => {
    if (!firestore || isUserLoading) return;
    if (!user || user.isAnonymous || !user.emailVerified) {
      setOwnProfile(null);
      return;
    }

    const unsubscribe = subscribeToOwnDirectoryProfile(
      firestore,
      auth,
      user.uid,
      (profile) => {
        setOwnProfile(profile);
        if (profile) {
          setFormFullName(profile.fullName);
          setFormOrg(profile.organization);
          setFormRole(profile.role);
          setFormTrack(profile.track);
          setFormBio(profile.bio);
          setFormTopicsText(profile.focusTopics.join(', '));
          setFormOptedIn(profile.optedIn);
          setFormAsSpeaker(profile.memberType === 'speaker');
          setHasPrefilledFromUserDoc(true);
        }
      },
      (err) => {
        console.warn('Own directory profile warning:', err.message);
      }
    );

    return () => unsubscribe();
  }, [firestore, auth, user, isUserLoading]);

  // 3. Prefill form from verified user profile if user hasn't created directory profile yet
  useEffect(() => {
    let active = true;
    if (
      !firestore ||
      !canParticipate ||
      !user ||
      ownProfile ||
      hasPrefilledFromUserDoc
    ) {
      return;
    }

    getVerifiedUserProfile(firestore, auth, user.uid)
      .then((profile) => {
        if (!active) return;
        if (profile) {
          setFormFullName(profile.fullName || user.displayName || '');
          setFormOrg(profile.organization || '');
          setFormRole(profile.role || 'Ministry Lead');
          setFormTrack(profile.track || 'Morning & Afternoon');
        } else {
          setFormFullName(user.displayName || '');
        }
        setHasPrefilledFromUserDoc(true);
      })
      .catch(() => {
        if (active && user.displayName) {
          setFormFullName(user.displayName);
          setHasPrefilledFromUserDoc(true);
        }
      });

    return () => {
      active = false;
    };
  }, [
    firestore,
    auth,
    user,
    canParticipate,
    ownProfile,
    hasPrefilledFromUserDoc,
  ]);

  // 4. Live subscription to current user's sent & received connections
  useEffect(() => {
    if (!firestore || isUserLoading) return;
    if (!user || user.isAnonymous || !user.emailVerified) {
      setConnections({ sent: [], received: [], byPeerUid: new Map() });
      return;
    }

    const unsubscribe = subscribeToUserConnections(
      firestore,
      auth,
      user.uid,
      (state) => setConnections(state),
      (err) => {
        console.warn('Directory connections warning:', err.message);
      }
    );

    return () => unsubscribe();
  }, [firestore, auth, user, isUserLoading]);

  // Compute speaker faculty metadata mapped to summit sessions & tracks
  const facultySpeakers = useMemo(() => {
    return speakerData.map((speaker) => {
      const sessions = agendaData.filter((s) => s.speaker === speaker.name);
      const hasMorning = sessions.some((s) => !s.afternoon);
      const hasAfternoon = sessions.some((s) => s.afternoon);
      const trackLabel: RegistrationTrack =
        hasMorning && hasAfternoon
          ? 'Morning & Afternoon'
          : hasAfternoon
            ? 'Afternoon Track'
            : 'Morning Track';
      return {
        ...speaker,
        sessions,
        trackLabel,
      };
    });
  }, []);

  const filteredFaculty = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return facultySpeakers.filter((sp) => {
      if (selectedTrack !== 'all' && sp.trackLabel !== selectedTrack) {
        return false;
      }
      if (!q) return true;
      return (
        sp.name.toLowerCase().includes(q) ||
        sp.role.toLowerCase().includes(q) ||
        sp.bio.toLowerCase().includes(q) ||
        sp.sessions.some((s) => s.title.toLowerCase().includes(q))
      );
    });
  }, [facultySpeakers, searchQuery, selectedTrack]);

  const roleCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of DIRECTORY_ROLES) {
      map.set(r, 0);
    }
    for (const p of directoryProfiles) {
      map.set(p.role, (map.get(p.role) ?? 0) + 1);
    }
    return map;
  }, [directoryProfiles]);

  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return directoryProfiles.filter((profile) => {
      if (selectedRole !== 'all' && profile.role !== selectedRole) {
        return false;
      }
      if (selectedTrack !== 'all' && profile.track !== selectedTrack) {
        return false;
      }
      if (speakersOnly && profile.memberType !== 'speaker') {
        return false;
      }
      if (!q) return true;
      return (
        profile.fullName.toLowerCase().includes(q) ||
        profile.organization.toLowerCase().includes(q) ||
        profile.role.toLowerCase().includes(q) ||
        profile.bio.toLowerCase().includes(q) ||
        profile.focusTopics.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [
    directoryProfiles,
    searchQuery,
    selectedRole,
    selectedTrack,
    speakersOnly,
  ]);

  const organizationCount = useMemo(() => {
    const orgs = new Set<string>();
    for (const p of directoryProfiles) {
      const normalized = p.organization.trim().toLowerCase();
      if (normalized) orgs.add(normalized);
    }
    return orgs.size;
  }, [directoryProfiles]);

  const pendingIncomingCount = useMemo(
    () => connections.received.filter((c) => c.status === 'pending').length,
    [connections.received]
  );

  const acceptedCount = useMemo(() => {
    const seen = new Set<string>();
    for (const c of [...connections.sent, ...connections.received]) {
      if (c.status === 'accepted') seen.add(c.id);
    }
    return seen.size;
  }, [connections]);

  const handleSaveDirectoryProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user || !canParticipate) return;

    if (formFullName.trim().length < 2) {
      toast({
        variant: 'destructive',
        title: 'Full name required',
        description: 'Enter at least 2 characters for your directory name.',
      });
      return;
    }

    setIsSavingProfile(true);
    try {
      const focusTopics = parseFocusTopicsInput(formTopicsText);
      await upsertDirectoryProfile(firestore, auth, {
        uid: user.uid,
        fullName: formFullName,
        organization: formOrg,
        role: formRole,
        track: formTrack,
        memberType: canListAsSpeaker && formAsSpeaker ? 'speaker' : 'attendee',
        bio: formBio,
        focusTopics,
        optedIn: formOptedIn,
      });
      toast({
        title: formOptedIn
          ? 'Directory profile published'
          : 'Directory visibility paused',
        description: formOptedIn
          ? 'Other church leaders can now discover and connect with you.'
          : 'Your listing is hidden from the public directory.',
      });
      if (formOptedIn) {
        setActiveTab('browse');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not save directory profile',
        description: extractFriendlyErrorMessage(error),
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleOpenConnectDialog = (target: DirectoryProfileRecord) => {
    if (!canParticipate) {
      toast({
        variant: 'destructive',
        title: 'Verification required',
        description:
          'Sign in with Google and verify your Email OTP to connect with leaders.',
      });
      return;
    }
    if (!ownProfile || !ownProfile.optedIn) {
      setActiveTab('profile');
      setFormOptedIn(true);
      toast({
        title: 'Opt in to connect',
        description:
          'Publish your networking profile first so recipients know who is reaching out.',
      });
      return;
    }

    setConnectTarget(target);
    setConnectMessage('');
  };

  const handleSendConnection = async () => {
    if (
      !firestore ||
      !ownProfile ||
      !ownProfile.optedIn ||
      !connectTarget ||
      isSendingConnect
    ) {
      return;
    }

    const clean = connectMessage.trim();
    if (clean.length < CONNECTION_MESSAGE_MIN_LENGTH) {
      toast({
        variant: 'destructive',
        title: 'Message too short',
        description: `Write at least ${CONNECTION_MESSAGE_MIN_LENGTH} characters introducing yourself.`,
      });
      return;
    }

    setIsSendingConnect(true);
    try {
      await sendDirectoryConnection(firestore, auth, {
        sender: ownProfile,
        recipient: connectTarget,
        message: clean,
      });
      toast({
        title: 'Introduction sent',
        description: `Connection request delivered to ${connectTarget.fullName}.`,
      });
      setConnectTarget(null);
      setConnectMessage('');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not send introduction',
        description: extractFriendlyErrorMessage(error),
      });
    } finally {
      setIsSendingConnect(false);
    }
  };

  const handleRespondToConnection = async (
    connectionId: string,
    status: 'accepted' | 'declined'
  ) => {
    if (!firestore || !canParticipate || pendingRespondIds.has(connectionId)) {
      return;
    }

    setPendingRespondIds((prev) => new Set(prev).add(connectionId));
    try {
      await respondToDirectoryConnection(firestore, auth, {
        connectionId,
        status,
        replyNote: replyDrafts[connectionId] || '',
      });
      toast({
        title:
          status === 'accepted'
            ? 'Connection accepted'
            : 'Connection declined',
        description:
          status === 'accepted'
            ? 'Your reply note is now visible to your ministry peer.'
            : 'The request has been closed.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Action failed',
        description: extractFriendlyErrorMessage(error),
      });
    } finally {
      setPendingRespondIds((prev) => {
        const next = new Set(prev);
        next.delete(connectionId);
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Directory Overview & Primary Navigation Tabs */}
      <Card className="border border-border bg-card shadow-sm">
        <CardHeader className="border-b border-border/70 pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground">
                <Users className="h-6 w-6 text-primary" />
                <span>Leadership &amp; Speaker Directory</span>
              </CardTitle>
              <CardDescription className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Opt in to share your ministry role and summit track so fellow
                pastors, operations leads, and speakers can connect across
                organizations.
              </CardDescription>
            </div>

            <div
              className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/40 p-1 self-start"
              role="tablist"
              aria-label="Directory workspace sections"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'browse'}
                onClick={() => setActiveTab('browse')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0',
                  activeTab === 'browse'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Users className="h-3.5 w-3.5" />
                Browse Directory
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'connections'}
                onClick={() => setActiveTab('connections')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 tabular-nums',
                  activeTab === 'connections'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Inbox className="h-3.5 w-3.5" />
                Connections
                {pendingIncomingCount > 0 && (
                  <span className="font-bold text-primary">
                    ({pendingIncomingCount})
                  </span>
                )}
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'profile'}
                onClick={() => setActiveTab('profile')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0',
                  activeTab === 'profile'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <UserCheck className="h-3.5 w-3.5" />
                {ownProfile?.optedIn ? 'My Listing' : 'Opt In'}
              </button>
            </div>
          </div>

          {/* Real-time KPI summary strip */}
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">
                Opted-In Leaders
              </p>
              <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">
                {isLoadingDirectory ? '—' : directoryProfiles.length}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">
                Organizations
              </p>
              <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">
                {isLoadingDirectory ? '—' : organizationCount}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">
                Keynote Faculty
              </p>
              <p className="mt-1 text-2xl font-bold text-primary tabular-nums">
                {facultySpeakers.length}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">
                My Connections
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {canParticipate ? acceptedCount : '—'}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {streamError && (
            <Alert variant="destructive" className="mb-5">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Directory Sync Error</AlertTitle>
              <AlertDescription>{streamError}</AlertDescription>
            </Alert>
          )}

          {/* TAB 1: BROWSE DIRECTORY */}
          {activeTab === 'browse' && (
            <div className="space-y-8">
              {/* Opt-in callout for verified attendees not listed yet */}
              {!isUserLoading && (
                <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/25 p-4 sm:flex-row sm:items-center sm:justify-between">
                  {!canParticipate ? (
                    <>
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-foreground">
                          {user && !isMfaVerified
                            ? 'Complete Email OTP verification to opt in & connect'
                            : 'Sign in with Google + Email OTP to join the directory'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Verified church leaders can publish an opt-in
                          networking card and send cross-organization
                          introductions.
                        </p>
                      </div>
                      <Button asChild size="sm" className="shrink-0">
                        <Link href="/login">
                          <LogIn className="mr-1.5 h-4 w-4" />
                          {user && !isMfaVerified ? 'Verify OTP' : 'Sign In'}
                        </Link>
                      </Button>
                    </>
                  ) : ownProfile?.optedIn ? (
                    <>
                      <div className="flex items-center gap-2.5 text-sm">
                        <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <div>
                          <p className="font-semibold text-foreground">
                            You are listed in the directory as {ownProfile.role}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {ownProfile.organization} · {ownProfile.track}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTab('profile')}
                        className="shrink-0"
                      >
                        Update My Listing
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-foreground">
                          Join the Opt-In Leadership Directory
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Share your ministry role, organization, and session
                          track so peers and speakers can connect with you.
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setFormOptedIn(true);
                          setActiveTab('profile');
                        }}
                        className="shrink-0"
                      >
                        <UserPlus className="mr-1.5 h-4 w-4" />
                        Opt In Now
                      </Button>
                    </>
                  )}
                </div>
              )}

              {/* Search & Role / Track Filters */}
              <div className="space-y-4 border-b border-border/70 pb-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by leader name, church/organization, or focus topic..."
                      aria-label="Search leadership directory"
                      className="pl-9 text-sm"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="filter-speakers-only"
                      checked={speakersOnly}
                      onCheckedChange={(checked) =>
                        setSpeakersOnly(checked === true)
                      }
                    />
                    <Label
                      htmlFor="filter-speakers-only"
                      className="cursor-pointer text-xs font-medium text-muted-foreground whitespace-nowrap"
                    >
                      Speakers &amp; moderators only
                    </Label>
                  </div>
                </div>

                {/* Role filter buttons */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Filter by Ministry Role
                  </p>
                  <div
                    className="flex flex-wrap items-center gap-1.5"
                    role="tablist"
                    aria-label="Filter by ministry role"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={selectedRole === 'all'}
                      onClick={() => setSelectedRole('all')}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 tabular-nums',
                        selectedRole === 'all'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <span>All Roles</span>
                      <span className="opacity-80">
                        {directoryProfiles.length}
                      </span>
                    </button>
                    {DIRECTORY_ROLES.map((role) => {
                      const active = selectedRole === role;
                      const count = roleCounts.get(role) ?? 0;
                      return (
                        <button
                          key={role}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setSelectedRole(role)}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 tabular-nums',
                            active
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                          )}
                        >
                          <span>{role}</span>
                          <span className="opacity-80">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Track filter buttons */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Filter by Session Track
                  </p>
                  <div
                    className="flex flex-wrap items-center gap-1.5"
                    role="tablist"
                    aria-label="Filter by session track"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={selectedTrack === 'all'}
                      onClick={() => setSelectedTrack('all')}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0',
                        selectedTrack === 'all'
                          ? 'bg-secondary text-secondary-foreground font-semibold'
                          : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      All Tracks
                    </button>
                    {DIRECTORY_TRACKS.map((track) => {
                      const active = selectedTrack === track;
                      return (
                        <button
                          key={track}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setSelectedTrack(track)}
                          className={cn(
                            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0',
                            active
                              ? 'bg-secondary text-secondary-foreground font-semibold'
                              : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                          )}
                        >
                          {track}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Opt-In Attendee & Speaker Networking Grid */}
              <div>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      Opted-In Church Leaders &amp; Speakers
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Verified participants who opted in to cross-organization
                      networking.
                    </p>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground tabular-nums">
                    Showing {filteredProfiles.length} of{' '}
                    {directoryProfiles.length}
                  </span>
                </div>

                {isLoadingDirectory ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Skeleton className="h-52 w-full rounded-lg" />
                    <Skeleton className="h-52 w-full rounded-lg" />
                    <Skeleton className="h-52 w-full rounded-lg" />
                  </div>
                ) : filteredProfiles.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredProfiles.map((profile) => {
                      const isSelf = user?.uid === profile.uid;
                      const conn = connections.byPeerUid.get(profile.uid);
                      const isSpeaker = profile.memberType === 'speaker';

                      return (
                        <div
                          key={profile.uid}
                          className="flex flex-col justify-between rounded-lg border border-border bg-background p-5"
                        >
                          <div>
                            <div className="flex items-start gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                                {getInitials(profile.fullName)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <h4 className="truncate text-base font-bold text-foreground">
                                    {profile.fullName}
                                  </h4>
                                  {isSpeaker && (
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary shrink-0">
                                      <Mic className="h-3.5 w-3.5" />
                                      Speaker
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs font-medium text-foreground/80">
                                  <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  <span className="truncate">
                                    {profile.organization}
                                  </span>
                                </p>
                              </div>
                            </div>

                            {/* Zero-pill metadata line */}
                            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">
                                {profile.role}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{profile.track}</span>
                            </div>

                            {profile.bio && (
                              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                                {profile.bio}
                              </p>
                            )}

                            {profile.focusTopics.length > 0 && (
                              <p className="mt-3 text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">
                                  Focus:
                                </span>{' '}
                                {profile.focusTopics.join(' · ')}
                              </p>
                            )}
                          </div>

                          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                            {isSelf ? (
                              <>
                                <span className="text-xs font-medium text-muted-foreground">
                                  Your public listing
                                </span>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setActiveTab('profile')}
                                  className="h-8 text-xs"
                                >
                                  Edit Profile
                                </Button>
                              </>
                            ) : conn?.status === 'accepted' ? (
                              <>
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Connected
                                </span>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setActiveTab('connections')}
                                  className="h-8 text-xs"
                                >
                                  View Note
                                </Button>
                              </>
                            ) : conn?.status === 'pending' &&
                              conn.senderUid === user?.uid ? (
                              <>
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                                  <Clock className="h-3.5 w-3.5" />
                                  Introduction Sent
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setActiveTab('connections')}
                                  className="h-8 text-xs"
                                >
                                  Status
                                </Button>
                              </>
                            ) : conn?.status === 'pending' ? (
                              <>
                                <span className="text-xs font-semibold text-primary">
                                  Requested to connect
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => setActiveTab('connections')}
                                  className="h-8 text-xs"
                                >
                                  Respond
                                </Button>
                              </>
                            ) : (
                              <>
                                <span className="text-xs text-muted-foreground">
                                  Open to connect
                                </span>
                                {canParticipate ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() =>
                                      handleOpenConnectDialog(profile)
                                    }
                                    className="h-8 text-xs"
                                  >
                                    <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                                    Connect
                                  </Button>
                                ) : (
                                  <Button
                                    asChild
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs"
                                  >
                                    <Link href="/login">Sign in</Link>
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
                    <p className="text-sm font-medium text-foreground">
                      {directoryProfiles.length === 0
                        ? 'No attendees have opted into the directory yet.'
                        : 'No leaders match the active role, track, or search filters.'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {directoryProfiles.length === 0
                        ? 'Be the first verified church leader to publish your networking card.'
                        : 'Reset your filters or search query to view all opted-in participants.'}
                    </p>
                    <div className="mt-4 flex justify-center gap-2">
                      {directoryProfiles.length > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearchQuery('');
                            setSelectedRole('all');
                            setSelectedTrack('all');
                            setSpeakersOnly(false);
                          }}
                        >
                          Clear Filters
                        </Button>
                      )}
                      {canParticipate && !ownProfile?.optedIn && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            setFormOptedIn(true);
                            setActiveTab('profile');
                          }}
                        >
                          Opt In to Directory
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Summit Keynote Speakers & Faculty Section */}
              {selectedRole === 'all' && filteredFaculty.length > 0 && (
                <div className="border-t border-border/70 pt-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-bold text-foreground">
                        Summit Keynote Speakers &amp; Session Faculty
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Connect directly with faculty through their session Q&amp;A
                        rooms or speaker briefs.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    {filteredFaculty.map((speaker) => {
                      const firstSession = speaker.sessions[0];
                      return (
                        <div
                          key={speaker.name}
                          className="flex flex-col justify-between rounded-lg border border-border bg-muted/15 p-5"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="text-base font-bold text-foreground">
                                  {speaker.name}
                                </h4>
                                <p className="mt-0.5 text-xs font-medium text-primary">
                                  {speaker.role}
                                </p>
                              </div>
                              <Mic className="h-4 w-4 shrink-0 text-muted-foreground" />
                            </div>

                            <p className="mt-2 text-xs text-muted-foreground">
                              {speaker.trackLabel} · {speaker.sessions.length}{' '}
                              {speaker.sessions.length === 1
                                ? 'Session'
                                : 'Sessions'}
                            </p>

                            <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                              {speaker.bio}
                            </p>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="h-8 flex-1 text-xs"
                            >
                              <Link
                                href={`/speaker/${speaker.name.replace(/\s/g, '+')}`}
                              >
                                Speaker Profile
                              </Link>
                            </Button>
                            {firstSession && (
                              <Button
                                asChild
                                size="sm"
                                className="h-8 flex-1 text-xs"
                              >
                                <Link href={`/session/${firstSession.id}`}>
                                  Session Q&amp;A
                                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                                </Link>
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MY CONNECTIONS */}
          {activeTab === 'connections' && (
            <div className="space-y-6">
              {!canParticipate ? (
                <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center space-y-3">
                  <p className="text-sm font-semibold text-foreground">
                    Sign in and verify your Email OTP to view connections
                  </p>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Connection requests and replies are private between you and
                    the other verified church leader.
                  </p>
                  <Button asChild size="sm">
                    <Link href="/login">
                      <LogIn className="mr-1.5 h-4 w-4" />
                      {user && !isMfaVerified ? 'Verify OTP' : 'Sign In'}
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="grid gap-8 lg:grid-cols-2">
                  {/* Incoming Requests */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-border/70 pb-2">
                      <h3 className="text-base font-bold text-foreground">
                        Incoming Requests
                      </h3>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {connections.received.length} total
                      </span>
                    </div>

                    {connections.received.length > 0 ? (
                      <div className="space-y-3">
                        {connections.received.map((conn) => {
                          const isBusy = pendingRespondIds.has(conn.id);
                          const timeAgo = formatDistanceToNow(
                            new Date(conn.updatedAtMs),
                            { addSuffix: true }
                          );

                          return (
                            <div
                              key={conn.id}
                              className="rounded-lg border border-border bg-background p-4 space-y-3"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-bold text-foreground">
                                    {conn.senderName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {conn.senderRole} · {conn.senderOrg}
                                  </p>
                                </div>
                                <span
                                  className={cn(
                                    'text-xs font-semibold capitalize',
                                    conn.status === 'accepted'
                                      ? 'text-emerald-700 dark:text-emerald-400'
                                      : conn.status === 'declined'
                                        ? 'text-muted-foreground'
                                        : 'text-primary'
                                  )}
                                >
                                  {conn.status}
                                </span>
                              </div>

                              <p className="text-sm text-foreground/90 rounded-md bg-muted/30 p-3">
                                {conn.message}
                              </p>

                              {conn.status === 'pending' ? (
                                <div className="space-y-2.5 pt-1">
                                  <Input
                                    value={replyDrafts[conn.id] || ''}
                                    maxLength={CONNECTION_MESSAGE_MAX_LENGTH}
                                    disabled={isBusy}
                                    onChange={(e) =>
                                      setReplyDrafts((prev) => ({
                                        ...prev,
                                        [conn.id]: e.target.value,
                                      }))
                                    }
                                    placeholder="Optional reply or preferred contact note (e.g. Meet after Session 2)"
                                    className="h-9 text-xs"
                                  />
                                  <div className="flex items-center justify-end gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      disabled={isBusy}
                                      onClick={() =>
                                        void handleRespondToConnection(
                                          conn.id,
                                          'declined'
                                        )
                                      }
                                      className="h-8 text-xs"
                                    >
                                      <X className="mr-1 h-3.5 w-3.5" />
                                      Decline
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={isBusy}
                                      onClick={() =>
                                        void handleRespondToConnection(
                                          conn.id,
                                          'accepted'
                                        )
                                      }
                                      className="h-8 text-xs"
                                    >
                                      {isBusy ? (
                                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Check className="mr-1 h-3.5 w-3.5" />
                                      )}
                                      Accept Connection
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1 text-xs text-muted-foreground">
                                  {conn.replyNote && (
                                    <p className="text-foreground">
                                      <span className="font-semibold">
                                        Your note:
                                      </span>{' '}
                                      {conn.replyNote}
                                    </p>
                                  )}
                                  <p className="tabular-nums">
                                    Updated {timeAgo}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
                        <p className="text-sm font-medium text-foreground">
                          No incoming requests yet
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          When another leader reaches out from the directory,
                          their note appears here.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Sent Requests */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-border/70 pb-2">
                      <h3 className="text-base font-bold text-foreground">
                        Sent Introductions
                      </h3>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {connections.sent.length} total
                      </span>
                    </div>

                    {connections.sent.length > 0 ? (
                      <div className="space-y-3">
                        {connections.sent.map((conn) => {
                          const timeAgo = formatDistanceToNow(
                            new Date(conn.updatedAtMs),
                            { addSuffix: true }
                          );
                          return (
                            <div
                              key={conn.id}
                              className="rounded-lg border border-border bg-background p-4 space-y-2.5"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-bold text-foreground">
                                    {conn.recipientName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {conn.recipientRole} · {conn.recipientOrg}
                                  </p>
                                </div>
                                <span
                                  className={cn(
                                    'text-xs font-semibold capitalize',
                                    conn.status === 'accepted'
                                      ? 'text-emerald-700 dark:text-emerald-400'
                                      : conn.status === 'declined'
                                        ? 'text-muted-foreground'
                                        : 'text-primary'
                                  )}
                                >
                                  {conn.status}
                                </span>
                              </div>

                              <p className="text-sm text-foreground/85 rounded-md bg-muted/30 p-3">
                                {conn.message}
                              </p>

                              {conn.replyNote && (
                                <p className="text-xs text-foreground rounded-md border border-emerald-500/25 bg-emerald-500/5 p-2.5">
                                  <span className="font-semibold">
                                    Reply from {conn.recipientName}:
                                  </span>{' '}
                                  {conn.replyNote}
                                </p>
                              )}

                              <p className="text-xs text-muted-foreground tabular-nums">
                                Updated {timeAgo}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
                        <p className="text-sm font-medium text-foreground">
                          No introductions sent yet
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Browse the directory by ministry role or session track
                          to connect with peers.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveTab('browse')}
                          className="mt-3"
                        >
                          Browse Directory
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MY OPT-IN PROFILE */}
          {activeTab === 'profile' && (
            <div className="max-w-2xl">
              {!canParticipate ? (
                <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center space-y-3">
                  <p className="text-sm font-semibold text-foreground">
                    Google Sign-In &amp; Email OTP required
                  </p>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Only verified Summit Navigator attendees and speakers can
                    publish an opt-in networking listing.
                  </p>
                  <Button asChild size="sm">
                    <Link href="/login">
                      <LogIn className="mr-1.5 h-4 w-4" />
                      {user && !isMfaVerified ? 'Verify OTP' : 'Sign In'}
                    </Link>
                  </Button>
                </div>
              ) : (
                <form
                  onSubmit={handleSaveDirectoryProfile}
                  className="space-y-5"
                >
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/25 p-4">
                    <div>
                      <Label
                        htmlFor="directory-opt-in"
                        className="text-sm font-semibold text-foreground"
                      >
                        Show my profile in the Leadership Directory
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Your personal email stays private. Only your name,
                        organization, ministry role, track, and bio appear.
                      </p>
                    </div>
                    <Switch
                      id="directory-opt-in"
                      checked={formOptedIn}
                      onCheckedChange={setFormOptedIn}
                      disabled={isSavingProfile}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="dir-fullname">Full Name</Label>
                      <Input
                        id="dir-fullname"
                        value={formFullName}
                        onChange={(e) => setFormFullName(e.target.value)}
                        maxLength={120}
                        required
                        disabled={isSavingProfile}
                        placeholder="Pastor Samuel Adeyemi"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="dir-org">Church / Organization</Label>
                      <Input
                        id="dir-org"
                        value={formOrg}
                        onChange={(e) => setFormOrg(e.target.value)}
                        maxLength={150}
                        required
                        disabled={isSavingProfile}
                        placeholder="Harvest House International"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="dir-role">Ministry Role</Label>
                      <Select
                        value={formRole}
                        onValueChange={setFormRole}
                        disabled={isSavingProfile}
                      >
                        <SelectTrigger id="dir-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DIRECTORY_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="dir-track">Session Track</Label>
                      <Select
                        value={formTrack}
                        onValueChange={(v) =>
                          setFormTrack(v as RegistrationTrack)
                        }
                        disabled={isSavingProfile}
                      >
                        <SelectTrigger id="dir-track">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DIRECTORY_TRACKS.map((track) => (
                            <SelectItem key={track} value={track}>
                              {track}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {canListAsSpeaker && (
                    <div className="flex items-center space-x-2 rounded-md border border-primary/25 bg-primary/5 px-3.5 py-2.5">
                      <Checkbox
                        id="dir-speaker-flag"
                        checked={formAsSpeaker}
                        onCheckedChange={(checked) =>
                          setFormAsSpeaker(checked === true)
                        }
                        disabled={isSavingProfile}
                      />
                      <Label
                        htmlFor="dir-speaker-flag"
                        className="cursor-pointer text-xs font-medium text-primary"
                      >
                        Display Speaker / Moderator designation on my directory
                        card
                      </Label>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="dir-bio">
                        Ministry Focus &amp; Collaboration Bio
                      </Label>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formBio.length}/{DIRECTORY_BIO_MAX_LENGTH}
                      </span>
                    </div>
                    <Textarea
                      id="dir-bio"
                      rows={3}
                      value={formBio}
                      maxLength={DIRECTORY_BIO_MAX_LENGTH}
                      disabled={isSavingProfile}
                      onChange={(e) => setFormBio(e.target.value)}
                      placeholder="Share what your team is focused on and what kind of leaders you'd like to meet at the summit."
                      className="resize-none text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="dir-topics">
                      Focus Topics (comma-separated, up to 5)
                    </Label>
                    <Input
                      id="dir-topics"
                      value={formTopicsText}
                      disabled={isSavingProfile}
                      onChange={(e) => setFormTopicsText(e.target.value)}
                      placeholder="Church Governance, Youth Discipleship, Volunteer Systems"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActiveTab('browse')}
                      disabled={isSavingProfile}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSavingProfile}>
                      {isSavingProfile ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving Listing...
                        </>
                      ) : formOptedIn ? (
                        'Save & Publish Listing'
                      ) : (
                        'Save Hidden Profile'
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send Leadership Introduction Dialog */}
      <Dialog
        open={Boolean(connectTarget)}
        onOpenChange={(open) => {
          if (!open && !isSendingConnect) {
            setConnectTarget(null);
            setConnectMessage('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Connect with {connectTarget?.fullName}
            </DialogTitle>
            <DialogDescription>
              {connectTarget?.role} at {connectTarget?.organization} (
              {connectTarget?.track})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="connect-intro-message">
                  Introduction Message
                </Label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {connectMessage.trim().length}/{CONNECTION_MESSAGE_MAX_LENGTH}
                </span>
              </div>
              <Textarea
                id="connect-intro-message"
                rows={4}
                value={connectMessage}
                maxLength={CONNECTION_MESSAGE_MAX_LENGTH}
                disabled={isSendingConnect}
                onChange={(e) => setConnectMessage(e.target.value)}
                placeholder="Introduce your ministry context and suggest a time or topic to collaborate on during the summit..."
                className="resize-none text-sm"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isSendingConnect}
                onClick={() => {
                  setConnectTarget(null);
                  setConnectMessage('');
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={
                  isSendingConnect ||
                  connectMessage.trim().length < CONNECTION_MESSAGE_MIN_LENGTH
                }
                onClick={() => void handleSendConnection()}
              >
                {isSendingConnect ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send Introduction
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
