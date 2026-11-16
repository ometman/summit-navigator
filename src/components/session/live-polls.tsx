'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  BarChart3,
  CheckCircle2,
  Circle,
  Loader2,
  Lock,
  LogIn,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Unlock,
  Zap,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ToastAction } from '@/components/ui/toast';
import { useFirebase } from '@/firebase';
import {
  checkUserModeratorAccess,
  isBootstrappedAdminUser,
  testFirestoreConnection,
} from '@/firebase/qa';
import {
  castPollVote,
  launchSessionPoll,
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  POLL_OPTION_MAX_LENGTH,
  POLL_PRESETS,
  POLL_QUESTION_MAX_LENGTH,
  POLL_QUESTION_MIN_LENGTH,
  subscribeToSessionPolls,
  subscribeToUserPollVotes,
  updateSessionPollState,
  type PollPreset,
  type PollType,
  type SessionPoll,
} from '@/firebase/polls';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type PollFilter = 'active' | 'archived';

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
    return 'Daily Firestore quota exceeded. Please try again tomorrow or review Firebase plan limits.';
  }
  if (
    detail.toLowerCase().includes('permission') ||
    detail.toLowerCase().includes('insufficient')
  ) {
    return 'Permission denied. Ensure Google Sign-In and Email OTP verification are active.';
  }
  return detail || 'Unable to sync live polls right now.';
}

export function LivePolls({ sessionId }: { sessionId: string }) {
  const { firestore, auth, user, isUserLoading, isMfaVerified } = useFirebase();
  const { toast } = useToast();

  const [polls, setPolls] = useState<SessionPoll[]>([]);
  const [userVotes, setUserVotes] = useState<Map<string, number>>(new Map());
  const [isLoadingPolls, setIsLoadingPolls] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);

  const [isModerator, setIsModerator] = useState(false);
  const [activeFilter, setActiveFilter] = useState<PollFilter>('active');
  const [showLauncher, setShowLauncher] = useState(false);

  // Composer state for speakers/moderators
  const [pollType, setPollType] = useState<PollType>('multiple_choice');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchingPresetId, setLaunchingPresetId] = useState<string | null>(
    null
  );

  // Pending actions
  const [pendingVotePollIds, setPendingVotePollIds] = useState<Set<string>>(
    new Set()
  );
  const [pendingModPollIds, setPendingModPollIds] = useState<Set<string>>(
    new Set()
  );

  const isAdmin = isBootstrappedAdminUser(user);
  const canWrite = Boolean(
    user && !user.isAnonymous && user.emailVerified && isMfaVerified
  );
  const canModerate = Boolean(canWrite && isModerator);

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

  useEffect(() => {
    if (!firestore || isUserLoading) return;

    setIsLoadingPolls(true);
    setStreamError(null);

    const includeArchived = Boolean(isAdmin);
    const unsubscribe = subscribeToSessionPolls(
      firestore,
      auth,
      sessionId,
      includeArchived,
      (items) => {
        setPolls(items);
        setIsLoadingPolls(false);
        setStreamError(null);
      },
      (err) => {
        setStreamError(extractFriendlyErrorMessage(err));
        setIsLoadingPolls(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, auth, sessionId, isUserLoading, isAdmin]);

  useEffect(() => {
    if (!firestore || isUserLoading) return;
    if (!user || user.isAnonymous || !user.emailVerified) {
      setUserVotes(new Map());
      return;
    }

    const unsubscribe = subscribeToUserPollVotes(
      firestore,
      auth,
      sessionId,
      user.uid,
      (votesMap) => setUserVotes(votesMap),
      (err) => {
        console.warn('Poll vote stream warning:', err.message);
      }
    );

    return () => unsubscribe();
  }, [firestore, auth, sessionId, user, isUserLoading]);

  useEffect(() => {
    if (activeFilter === 'archived' && !isAdmin) {
      setActiveFilter('active');
    }
  }, [activeFilter, isAdmin]);

  const counts = useMemo(() => {
    let active = 0;
    let open = 0;
    let archived = 0;
    let totalResponses = 0;
    for (const poll of polls) {
      if (poll.archived) {
        archived += 1;
      } else {
        active += 1;
        totalResponses += poll.totalVotes;
        if (poll.status === 'open') open += 1;
      }
    }
    return { active, open, archived, totalResponses };
  }, [polls]);

  const visiblePolls = useMemo(() => {
    return polls.filter((poll) =>
      activeFilter === 'archived' ? poll.archived : !poll.archived
    );
  }, [polls, activeFilter]);

  const cleanedQuestion = question.trim();
  const validOptions = options
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  const canSubmitCustomPoll =
    cleanedQuestion.length >= POLL_QUESTION_MIN_LENGTH &&
    validOptions.length >= POLL_MIN_OPTIONS &&
    !isLaunching;

  const handleOptionChange = (index: number, value: string) => {
    setOptions((prev) => prev.map((item, idx) => (idx === index ? value : item)));
  };

  const handleAddOption = () => {
    setOptions((prev) =>
      prev.length < POLL_MAX_OPTIONS ? [...prev, ''] : prev
    );
  };

  const handleRemoveOption = (index: number) => {
    setOptions((prev) =>
      prev.length > POLL_MIN_OPTIONS
        ? prev.filter((_, idx) => idx !== index)
        : prev
    );
  };

  const handleApplyPreset = (preset: PollPreset) => {
    setPollType(preset.pollType);
    setQuestion(preset.question);
    setOptions([...preset.options]);
  };

  const handleLaunchPreset = async (preset: PollPreset) => {
    if (!firestore || !user || !canModerate || launchingPresetId) return;
    setLaunchingPresetId(preset.id);
    setStreamError(null);
    try {
      await launchSessionPoll(firestore, auth, {
        sessionId,
        pollType: preset.pollType,
        question: preset.question,
        options: preset.options,
        creatorUid: user.uid,
        creatorName:
          user.displayName || user.email?.split('@')[0] || 'Speaker',
      });
      setActiveFilter('active');
      toast({
        title:
          preset.pollType === 'commitment'
            ? '1-Tap commitment launched live'
            : 'Poll launched live',
        description: 'Attendees can now respond in real time.',
      });
    } catch (error) {
      const msg = extractFriendlyErrorMessage(error);
      setStreamError(msg);
      toast({
        variant: 'destructive',
        title: 'Failed to launch poll',
        description: msg,
      });
    } finally {
      setLaunchingPresetId(null);
    }
  };

  const handleLaunchCustomPoll = async () => {
    if (!firestore || !user || !canModerate || !canSubmitCustomPoll) return;
    setIsLaunching(true);
    setStreamError(null);

    try {
      await launchSessionPoll(firestore, auth, {
        sessionId,
        pollType,
        question: cleanedQuestion,
        options: validOptions,
        creatorUid: user.uid,
        creatorName:
          user.displayName || user.email?.split('@')[0] || 'Speaker',
      });

      setQuestion('');
      setOptions(['', '']);
      setShowLauncher(false);
      setActiveFilter('active');
      toast({
        title:
          pollType === 'commitment'
            ? '1-Tap commitment prompt live'
            : 'Live poll launched',
        description: 'Responses are now streaming to this session and the dashboard.',
      });
    } catch (error) {
      const msg = extractFriendlyErrorMessage(error);
      setStreamError(msg);
      toast({
        variant: 'destructive',
        title: 'Could not launch poll',
        description: msg,
      });
    } finally {
      setIsLaunching(false);
    }
  };

  const handleVote = async (poll: SessionPoll, optionIndex: number) => {
    if (!firestore) return;
    if (!user || !canWrite) {
      toast({
        variant: 'destructive',
        title: 'Verification required',
        description:
          'Sign in with Google and verify your Email OTP to respond to live polls.',
      });
      return;
    }
    if (
      poll.status !== 'open' ||
      poll.archived ||
      userVotes.has(poll.id) ||
      pendingVotePollIds.has(poll.id)
    ) {
      return;
    }

    setPendingVotePollIds((prev) => new Set(prev).add(poll.id));
    try {
      await castPollVote(firestore, auth, {
        sessionId,
        pollId: poll.id,
        uid: user.uid,
        optionIndex,
      });
      toast({
        title:
          poll.pollType === 'commitment'
            ? 'Commitment recorded'
            : 'Response recorded',
        description: `Selected: "${poll.options[optionIndex]}"`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not submit response',
        description: extractFriendlyErrorMessage(error),
      });
    } finally {
      setPendingVotePollIds((prev) => {
        const next = new Set(prev);
        next.delete(poll.id);
        return next;
      });
    }
  };

  const handlePollStateUpdate = async (
    poll: SessionPoll,
    patch: Partial<Pick<SessionPoll, 'status' | 'archived'>>,
    feedbackTitle: string
  ) => {
    if (!firestore || !canModerate || pendingModPollIds.has(poll.id)) return;

    setPendingModPollIds((prev) => new Set(prev).add(poll.id));
    try {
      await updateSessionPollState(firestore, auth, {
        sessionId,
        pollId: poll.id,
        patch,
      });
      toast({
        title: feedbackTitle,
        action:
          patch.archived === true ? (
            <ToastAction
              altText="Undo archive"
              onClick={() => {
                void updateSessionPollState(firestore, auth, {
                  sessionId,
                  pollId: poll.id,
                  patch: { archived: false },
                }).catch((err) => {
                  toast({
                    variant: 'destructive',
                    title: 'Restore failed',
                    description: extractFriendlyErrorMessage(err),
                  });
                });
              }}
            >
              Undo
            </ToastAction>
          ) : undefined,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Poll update failed',
        description: extractFriendlyErrorMessage(error),
      });
    } finally {
      setPendingModPollIds((prev) => {
        const next = new Set(prev);
        next.delete(poll.id);
        return next;
      });
    }
  };

  return (
    <Card className="mt-8 border border-border bg-card shadow-sm">
      <CardHeader className="border-b border-border/70 pb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground">
              <BarChart3 className="h-6 w-6 text-primary" />
              <span>Live Audience Polls &amp; Commitments</span>
            </CardTitle>
            <CardDescription className="mt-1 text-sm text-muted-foreground">
              Speakers can launch live multiple-choice polls or 1-tap commitment
              checks. Aggregate results stream here and on the main dashboard.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground tabular-nums">
            <span className="font-semibold text-foreground">
              {counts.open} Open
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {counts.totalResponses}{' '}
              {counts.totalResponses === 1 ? 'Response' : 'Responses'}
            </span>
          </div>
        </div>

        {/* Speaker / Moderator Launch Banner */}
        {canModerate && (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-primary/25 bg-primary/5 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>
                Speaker Poll Controls — Launch a custom poll or fire a 1-tap
                commitment check live.
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              variant={showLauncher ? 'secondary' : 'default'}
              onClick={() => setShowLauncher((v) => !v)}
              className="h-8 self-start text-xs sm:self-auto"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {showLauncher ? 'Close Launcher' : 'Launch Poll / Commitment'}
            </Button>
          </div>
        )}

        {/* Speaker Poll Builder */}
        {canModerate && showLauncher && (
          <div className="mt-3 space-y-5 rounded-lg border border-border bg-muted/25 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Quick Stage Presets
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {POLL_PRESETS.map((preset) => {
                  const isPresetBusy = launchingPresetId === preset.id;
                  return (
                    <div
                      key={preset.id}
                      className="flex flex-col justify-between gap-2.5 rounded-md border border-border bg-background p-3"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          {preset.pollType === 'commitment' ? (
                            <Zap className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <BarChart3 className="h-3.5 w-3.5 text-primary" />
                          )}
                          <span>{preset.label}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {preset.question}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          disabled={Boolean(launchingPresetId) || isLaunching}
                          onClick={() => void handleLaunchPreset(preset)}
                          className="h-7 flex-1 text-xs"
                        >
                          {isPresetBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            'Launch Now'
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={Boolean(launchingPresetId) || isLaunching}
                          onClick={() => handleApplyPreset(preset)}
                          className="h-7 px-2 text-xs"
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-border/70 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Custom Live Poll Builder
                </Label>
                <div className="inline-flex rounded-md border border-border bg-background p-0.5">
                  <button
                    type="button"
                    onClick={() => setPollType('multiple_choice')}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                      pollType === 'multiple_choice'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    Multiple Choice
                  </button>
                  <button
                    type="button"
                    onClick={() => setPollType('commitment')}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
                      pollType === 'commitment'
                        ? 'bg-emerald-600 text-white'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    1-Tap Commitment
                  </button>
                </div>
              </div>

              <div className="mt-3 space-y-3">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <Label
                      htmlFor={`poll-question-${sessionId}`}
                      className="text-xs font-medium text-foreground"
                    >
                      Question or Commitment Prompt
                    </Label>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {cleanedQuestion.length}/{POLL_QUESTION_MAX_LENGTH}
                    </span>
                  </div>
                  <Input
                    id={`poll-question-${sessionId}`}
                    value={question}
                    maxLength={POLL_QUESTION_MAX_LENGTH}
                    disabled={isLaunching}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder={
                      pollType === 'commitment'
                        ? 'e.g. What commitment are you making from this teaching?'
                        : 'e.g. Which operational bottleneck should we address next?'
                    }
                    className="bg-background text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-foreground">
                      Response Options ({POLL_MIN_OPTIONS}–{POLL_MAX_OPTIONS})
                    </Label>
                    {options.length < POLL_MAX_OPTIONS && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleAddOption}
                        disabled={isLaunching}
                        className="h-7 px-2 text-xs text-primary"
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        Add Option
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-2">
                    {options.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="w-5 text-center text-xs font-semibold text-muted-foreground tabular-nums">
                          {idx + 1}.
                        </span>
                        <Input
                          value={opt}
                          maxLength={POLL_OPTION_MAX_LENGTH}
                          disabled={isLaunching}
                          onChange={(e) =>
                            handleOptionChange(idx, e.target.value)
                          }
                          placeholder={`Option ${idx + 1}`}
                          className="h-9 bg-background text-sm"
                        />
                        {options.length > POLL_MIN_OPTIONS && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={isLaunching}
                            onClick={() => handleRemoveOption(idx)}
                            className="h-9 px-2 text-muted-foreground hover:text-destructive"
                            aria-label={`Remove option ${idx + 1}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    disabled={!canSubmitCustomPoll}
                    onClick={() => void handleLaunchCustomPoll()}
                    className="h-9 px-4"
                  >
                    {isLaunching ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Launch Live Now
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-6">
        {!isUserLoading && !canWrite && counts.open > 0 && (
          <div className="mb-5 flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-foreground">
                {user && !isMfaVerified
                  ? 'Verify Email OTP to vote in live polls'
                  : 'Sign in to vote or submit a 1-tap commitment'}
              </p>
              <p className="text-xs text-muted-foreground">
                Live results update automatically for everyone. Participation
                requires Google Sign-In and Email OTP verification.
              </p>
            </div>
            <Button asChild size="sm" className="shrink-0">
              <Link href="/login">
                <LogIn className="mr-1.5 h-4 w-4" />
                {user && !isMfaVerified ? 'Verify OTP' : 'Sign In'}
              </Link>
            </Button>
          </div>
        )}

        {isAdmin && counts.archived > 0 && (
          <div
            className="mb-4 flex flex-wrap items-center gap-2 border-b border-border/70 pb-3"
            role="tablist"
            aria-label="Filter session polls"
          >
            {(
              [
                { key: 'active', label: 'Active Polls', count: counts.active },
                { key: 'archived', label: 'Archived', count: counts.archived },
              ] as const
            ).map((tab) => {
              const selected = activeFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveFilter(tab.key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                    selected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <span>{tab.label}</span>
                  <span className="tabular-nums opacity-80">{tab.count}</span>
                </button>
              );
            })}
          </div>
        )}

        {streamError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Poll Sync Error</AlertTitle>
            <AlertDescription>{streamError}</AlertDescription>
          </Alert>
        )}

        {isLoadingPolls ? (
          <div className="space-y-3">
            <Skeleton className="h-36 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        ) : visiblePolls.length > 0 ? (
          <div className="space-y-4">
            {visiblePolls.map((poll) => {
              const votedOptionIndex = userVotes.get(poll.id);
              const hasVoted = typeof votedOptionIndex === 'number';
              const isVoting = pendingVotePollIds.has(poll.id);
              const isModBusy = pendingModPollIds.has(poll.id);
              const isInteractive =
                canWrite &&
                poll.status === 'open' &&
                !poll.archived &&
                !hasVoted &&
                !isVoting;
              const isCommitment = poll.pollType === 'commitment';
              const relativeTime = formatDistanceToNow(
                new Date(poll.createdAtMs),
                { addSuffix: true }
              );

              return (
                <div
                  key={poll.id}
                  className={cn(
                    'rounded-lg border p-4 transition-colors',
                    poll.archived
                      ? 'border-border/60 bg-muted/25 opacity-75'
                      : poll.status === 'open'
                        ? isCommitment
                          ? 'border-emerald-500/35 bg-emerald-500/[0.02]'
                          : 'border-primary/35 bg-primary/[0.02]'
                        : 'border-border bg-background'
                  )}
                >
                  {/* Metadata header row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <div className="flex flex-wrap items-center gap-2 font-medium">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 font-semibold',
                          isCommitment
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-primary'
                        )}
                      >
                        {isCommitment ? (
                          <Zap className="h-3.5 w-3.5" />
                        ) : (
                          <BarChart3 className="h-3.5 w-3.5" />
                        )}
                        {isCommitment
                          ? '1-Tap Commitment'
                          : 'Multiple-Choice Poll'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={cn(
                          'font-semibold',
                          poll.status === 'open'
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                        )}
                      >
                        {poll.status === 'open' ? 'Open for Voting' : 'Closed'}
                      </span>
                      {poll.archived && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Archived</span>
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 tabular-nums">
                      <span className="font-semibold text-foreground">
                        {poll.totalVotes}{' '}
                        {poll.totalVotes === 1 ? 'response' : 'responses'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{poll.createdByName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{relativeTime}</span>
                    </div>
                  </div>

                  {/* Question */}
                  <h4 className="mt-2.5 text-base font-semibold leading-snug text-foreground">
                    {poll.question}
                  </h4>

                  {/* Interactive Response / Results Bars */}
                  <div className="mt-3.5 space-y-2">
                    {poll.options.map((optionLabel, idx) => {
                      const count = poll.counts[idx] ?? 0;
                      const pct =
                        poll.totalVotes > 0
                          ? Math.round((count / poll.totalVotes) * 100)
                          : 0;
                      const isChosen = votedOptionIndex === idx;

                      return (
                        <button
                          key={`${poll.id}-${idx}`}
                          type="button"
                          disabled={!isInteractive}
                          onClick={() => void handleVote(poll, idx)}
                          aria-pressed={isChosen}
                          className={cn(
                            'group relative flex w-full items-center justify-between overflow-hidden rounded-md border px-3.5 py-2.5 text-left text-sm transition-colors',
                            isChosen
                              ? isCommitment
                                ? 'border-emerald-600/60 bg-background font-medium text-foreground'
                                : 'border-primary/70 bg-background font-medium text-foreground'
                              : isInteractive
                                ? 'cursor-pointer border-border bg-background hover:border-primary/60 hover:bg-muted/30'
                                : 'cursor-default border-border/80 bg-background/80'
                          )}
                        >
                          {/* Animated aggregate bar fill */}
                          <span
                            aria-hidden="true"
                            style={{ width: `${pct}%` }}
                            className={cn(
                              'pointer-events-none absolute inset-y-0 left-0 transition-all duration-500',
                              isChosen
                                ? isCommitment
                                  ? 'bg-emerald-500/20'
                                  : 'bg-primary/20'
                                : isCommitment
                                  ? 'bg-emerald-500/10'
                                  : 'bg-primary/10'
                            )}
                          />

                          <span className="relative z-10 flex min-w-0 items-center gap-2.5 pr-3">
                            {isVoting && !hasVoted ? (
                              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                            ) : isChosen ? (
                              <CheckCircle2
                                className={cn(
                                  'h-4 w-4 shrink-0',
                                  isCommitment
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-primary'
                                )}
                              />
                            ) : isCommitment && isInteractive ? (
                              <Zap className="h-4 w-4 shrink-0 text-emerald-600/80 transition-transform group-hover:scale-110 dark:text-emerald-400" />
                            ) : (
                              <Circle className="h-4 w-4 shrink-0 text-muted-foreground/60 group-hover:text-primary" />
                            )}
                            <span className="break-words text-foreground">
                              {optionLabel}
                            </span>
                          </span>

                          <span className="relative z-10 shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">
                            <span className="text-foreground">{pct}%</span>
                            <span className="mx-1" aria-hidden="true">
                              ·
                            </span>
                            <span>{count}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Footer line: attendee status + speaker actions */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                      {hasVoted ? (
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Your response is recorded live.
                        </span>
                      ) : poll.status === 'closed' ? (
                        <span>Voting closed by speaker.</span>
                      ) : canWrite ? (
                        <span>
                          {isCommitment
                            ? 'Tap once to register your commitment.'
                            : 'Select one option to submit your vote.'}
                        </span>
                      ) : (
                        <span>
                          <Link
                            href="/login"
                            className="font-medium text-primary underline underline-offset-2"
                          >
                            Sign in &amp; verify Email OTP
                          </Link>{' '}
                          to respond.
                        </span>
                      )}
                    </div>

                    {canModerate && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isModBusy || poll.archived}
                          onClick={() =>
                            void handlePollStateUpdate(
                              poll,
                              {
                                status:
                                  poll.status === 'open' ? 'closed' : 'open',
                              },
                              poll.status === 'open'
                                ? 'Poll closed to new responses'
                                : 'Poll reopened for voting'
                            )
                          }
                          className="h-7 px-2.5 text-xs"
                        >
                          {poll.status === 'open' ? (
                            <>
                              <Lock className="mr-1 h-3.5 w-3.5" />
                              Close Poll
                            </>
                          ) : (
                            <>
                              <Unlock className="mr-1 h-3.5 w-3.5" />
                              Reopen
                            </>
                          )}
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isModBusy}
                          onClick={() =>
                            void handlePollStateUpdate(
                              poll,
                              { archived: !poll.archived },
                              poll.archived
                                ? 'Poll restored to session feed'
                                : 'Poll archived'
                            )
                          }
                          className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                          {poll.archived ? (
                            <>
                              <ArchiveRestore className="mr-1 h-3.5 w-3.5" />
                              Restore
                            </>
                          ) : (
                            <>
                              <Archive className="mr-1 h-3.5 w-3.5" />
                              Archive
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground">
              {activeFilter === 'archived'
                ? 'No archived polls for this session.'
                : 'No live polls or commitment checks launched yet.'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {canModerate
                ? 'Use "Launch Poll / Commitment" above to engage attendees in real time.'
                : 'When the session speaker launches a poll or 1-tap commitment prompt, it will appear here automatically.'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
