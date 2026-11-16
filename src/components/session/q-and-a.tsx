'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ThumbsUp,
  MessageCircle,
  Send,
  Loader2,
  User,
  AlertCircle,
  Copy,
  CheckCircle2,
  Pin,
  PinOff,
  Archive,
  ArchiveRestore,
  ShieldCheck,
  LogIn,
  UserPlus,
  Trash2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ToastAction } from '@/components/ui/toast';
import { useFirebase } from '@/firebase';
import {
  checkUserModeratorAccess,
  grantModeratorAccess,
  isBootstrappedAdminUser,
  moderateSessionQuestion,
  QUESTION_MAX_LENGTH,
  QUESTION_MIN_LENGTH,
  revokeModeratorAccess,
  submitSessionQuestion,
  subscribeToModerators,
  subscribeToSessionQuestions,
  subscribeToUserUpvotes,
  testFirestoreConnection,
  toggleQuestionUpvote,
  type ModeratorRecord,
  type SessionQuestion,
} from '@/firebase/qa';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type QuestionFilter = 'active' | 'pinned' | 'answered' | 'archived';

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
    return 'Daily Firestore quota exceeded. Please try again tomorrow or review Firebase Spark plan limits.';
  }
  if (
    detail.toLowerCase().includes('permission') ||
    detail.toLowerCase().includes('insufficient')
  ) {
    return 'You do not have permission to perform this action. Please verify your Google sign-in and Email OTP verification.';
  }
  return detail || 'Unable to sync live Q&A right now.';
}

export function QandA({ sessionId }: { sessionId: string }) {
  const { firestore, auth, user, isUserLoading, isMfaVerified, isMfaLoading } =
    useFirebase();
  const { toast } = useToast();

  const [questions, setQuestions] = useState<SessionQuestion[]>([]);
  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set());
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);

  const [newQuestion, setNewQuestion] = useState('');
  const [postAnonymously, setPostAnonymously] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [activeFilter, setActiveFilter] = useState<QuestionFilter>('active');
  const [pendingUpvoteIds, setPendingUpvoteIds] = useState<Set<string>>(
    new Set()
  );
  const [pendingModIds, setPendingModIds] = useState<Set<string>>(new Set());

  const [isModerator, setIsModerator] = useState(false);
  const [showModManager, setShowModManager] = useState(false);
  const [moderators, setModerators] = useState<ModeratorRecord[]>([]);
  const [newModUid, setNewModUid] = useState('');
  const [newModName, setNewModName] = useState('');
  const [newModRole, setNewModRole] = useState<'speaker' | 'moderator'>(
    'speaker'
  );
  const [isSavingMod, setIsSavingMod] = useState(false);

  const isAdmin = isBootstrappedAdminUser(user);
  const canWrite = Boolean(
    user && !user.isAnonymous && user.emailVerified && isMfaVerified
  );
  const canModerate = Boolean(canWrite && isModerator);

  // 1. Validate Firestore server connection once on mount
  useEffect(() => {
    if (!firestore) return;
    void testFirestoreConnection(firestore);
  }, [firestore]);

  // 2. Check moderator privilege whenever authenticated user changes
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

  // 3. Subscribe to shared session Q&A stream via onSnapshot
  useEffect(() => {
    if (!firestore || isUserLoading) return;

    setIsLoadingQuestions(true);
    setStreamError(null);

    const includeArchived = Boolean(isAdmin);
    const unsubscribe = subscribeToSessionQuestions(
      firestore,
      auth,
      sessionId,
      includeArchived,
      (items) => {
        setQuestions(items);
        setIsLoadingQuestions(false);
        setStreamError(null);
      },
      (err) => {
        setStreamError(extractFriendlyErrorMessage(err));
        setIsLoadingQuestions(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, auth, sessionId, isUserLoading, isAdmin]);

  // 4. Subscribe to signed-in attendee's upvotes for this session
  useEffect(() => {
    if (!firestore || isUserLoading) return;
    if (!user || user.isAnonymous || !user.emailVerified) {
      setUpvotedIds(new Set());
      return;
    }

    const unsubscribe = subscribeToUserUpvotes(
      firestore,
      auth,
      sessionId,
      user.uid,
      (ids) => setUpvotedIds(ids),
      (err) => {
        console.warn('Upvote stream warning:', err.message);
      }
    );

    return () => unsubscribe();
  }, [firestore, auth, sessionId, user, isUserLoading]);

  // 5. Subscribe to moderator roster for bootstrapped admin
  useEffect(() => {
    if (!firestore || !isAdmin || !canWrite) {
      setModerators([]);
      return;
    }

    const unsubscribe = subscribeToModerators(
      firestore,
      auth,
      (list) => setModerators(list),
      (err) => {
        console.warn('Moderator list warning:', err.message);
      }
    );

    return () => unsubscribe();
  }, [firestore, auth, isAdmin, canWrite]);

  // Reset filter off archived if user loses admin view
  useEffect(() => {
    if (activeFilter === 'archived' && !isAdmin) {
      setActiveFilter('active');
    }
  }, [activeFilter, isAdmin]);

  const counts = useMemo(() => {
    let active = 0;
    let pinned = 0;
    let answered = 0;
    let archived = 0;
    for (const q of questions) {
      if (q.archived) {
        archived += 1;
      } else {
        active += 1;
        if (q.pinned) pinned += 1;
        if (q.answered) answered += 1;
      }
    }
    return { active, pinned, answered, archived };
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (activeFilter === 'archived') return q.archived;
      if (q.archived) return false;
      if (activeFilter === 'pinned') return q.pinned;
      if (activeFilter === 'answered') return q.answered;
      return true;
    });
  }, [questions, activeFilter]);

  const trimmedQuestion = newQuestion.trim();
  const isQuestionTooShort =
    trimmedQuestion.length > 0 && trimmedQuestion.length < QUESTION_MIN_LENGTH;

  const handleQuestionSubmit = async () => {
    if (!firestore || !user || !canWrite) return;
    if (trimmedQuestion.length < QUESTION_MIN_LENGTH) return;

    setIsSubmitting(true);
    setStreamError(null);

    try {
      await submitSessionQuestion(firestore, auth, {
        sessionId,
        text: trimmedQuestion,
        authorId: user.uid,
        authorDisplayName:
          user.displayName || user.email?.split('@')[0] || 'Verified Attendee',
        isAnonymous: postAnonymously,
      });

      setNewQuestion('');
      setPostAnonymously(false);
      if (activeFilter === 'answered' || activeFilter === 'archived') {
        setActiveFilter('active');
      }
      toast({
        title: 'Question posted live',
        description: 'All session attendees can now see and upvote it.',
      });
    } catch (error) {
      const msg = extractFriendlyErrorMessage(error);
      setStreamError(msg);
      toast({
        variant: 'destructive',
        title: 'Could not post question',
        description: msg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpvoteToggle = async (question: SessionQuestion) => {
    if (!firestore) return;
    if (!user || !canWrite) {
      toast({
        variant: 'destructive',
        title: 'Verification required',
        description:
          'Sign in with Google and verify your Email OTP to upvote questions.',
      });
      return;
    }
    if (question.archived || pendingUpvoteIds.has(question.id)) return;

    const currentlyUpvoted = upvotedIds.has(question.id);
    setPendingUpvoteIds((prev) => new Set(prev).add(question.id));

    try {
      await toggleQuestionUpvote(firestore, auth, {
        sessionId,
        questionId: question.id,
        uid: user.uid,
        currentlyUpvoted,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Upvote failed',
        description: extractFriendlyErrorMessage(error),
      });
    } finally {
      setPendingUpvoteIds((prev) => {
        const next = new Set(prev);
        next.delete(question.id);
        return next;
      });
    }
  };

  const handleModeration = async (
    question: SessionQuestion,
    patch: Partial<Pick<SessionQuestion, 'pinned' | 'answered' | 'archived'>>,
    feedbackTitle: string
  ) => {
    if (!firestore || !user || !canModerate) return;
    if (pendingModIds.has(question.id)) return;

    setPendingModIds((prev) => new Set(prev).add(question.id));
    try {
      await moderateSessionQuestion(firestore, auth, {
        sessionId,
        questionId: question.id,
        moderatorUid: user.uid,
        patch,
      });
      toast({
        title: feedbackTitle,
        action:
          patch.archived === true ? (
            <ToastAction
              altText="Undo archive"
              onClick={() => {
                void moderateSessionQuestion(firestore, auth, {
                  sessionId,
                  questionId: question.id,
                  moderatorUid: user.uid,
                  patch: { archived: false, pinned: question.pinned },
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
        title: 'Moderation update failed',
        description: extractFriendlyErrorMessage(error),
      });
    } finally {
      setPendingModIds((prev) => {
        const next = new Set(prev);
        next.delete(question.id);
        return next;
      });
    }
  };

  const handleCopy = (text: string, label = 'Question text') => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: `${label} copied to clipboard.`,
    });
  };

  const handleGrantModerator = async () => {
    if (!firestore || !user || !isAdmin || !canWrite) return;
    setIsSavingMod(true);
    try {
      await grantModeratorAccess(firestore, auth, {
        targetUid: newModUid,
        displayName: newModName,
        role: newModRole,
        adminUid: user.uid,
      });
      setNewModUid('');
      setNewModName('');
      toast({
        title: 'Moderator access granted',
        description: 'Speaker/moderator can now pin, answer, and archive Q&A.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to add moderator',
        description: extractFriendlyErrorMessage(error),
      });
    } finally {
      setIsSavingMod(false);
    }
  };

  const handleRevokeModerator = async (targetUid: string) => {
    if (!firestore || !isAdmin || !canWrite) return;
    try {
      await revokeModeratorAccess(firestore, auth, targetUid);
      toast({ title: 'Moderator access removed' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to remove moderator',
        description: extractFriendlyErrorMessage(error),
      });
    }
  };

  return (
    <Card className="mt-8 border border-border bg-card shadow-sm">
      <CardHeader className="border-b border-border/70 pb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground">
              <MessageCircle className="h-6 w-6 text-primary" />
              <span>Shared Live Q&amp;A</span>
            </CardTitle>
            <CardDescription className="mt-1 text-sm text-muted-foreground">
              Questions and upvotes sync live across all attendees. Speakers can
              pin priority items, mark them answered, or archive off-topic posts.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground tabular-nums">
            <span className="font-semibold text-foreground">
              {counts.active} {counts.active === 1 ? 'Question' : 'Questions'}
            </span>
            {counts.pinned > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>{counts.pinned} Pinned</span>
              </>
            )}
            {counts.answered > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>{counts.answered} Answered</span>
              </>
            )}
          </div>
        </div>

        {/* Speaker / Moderator Banner */}
        {canModerate && (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-primary/25 bg-primary/5 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>
                Speaker &amp; Moderator Controls Active — Pin, mark answered, or
                archive questions below.
              </span>
            </div>
            {isAdmin && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowModManager((v) => !v)}
                className="h-7 self-start text-xs sm:self-auto"
              >
                <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                {showModManager ? 'Hide Speaker Access' : 'Manage Speakers'}
              </Button>
            )}
          </div>
        )}

        {/* Bootstrapped Admin Speaker/Moderator Roster Manager */}
        {isAdmin && canWrite && showModManager && (
          <div className="mt-3 rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Assign Speaker or Moderator by UID
            </p>
            <div className="mt-2.5 grid gap-2 sm:grid-cols-[1fr_1fr_130px_auto]">
              <Input
                type="text"
                placeholder="Firebase User UID"
                value={newModUid}
                onChange={(e) => setNewModUid(e.target.value)}
                disabled={isSavingMod}
                className="h-9 text-sm"
              />
              <Input
                type="text"
                placeholder="Speaker display name"
                value={newModName}
                onChange={(e) => setNewModName(e.target.value)}
                disabled={isSavingMod}
                className="h-9 text-sm"
              />
              <select
                value={newModRole}
                onChange={(e) =>
                  setNewModRole(
                    e.target.value === 'moderator' ? 'moderator' : 'speaker'
                  )
                }
                disabled={isSavingMod}
                aria-label="Moderation role"
                className="h-9 rounded-md border border-input bg-background px-2.5 text-sm"
              >
                <option value="speaker">Speaker</option>
                <option value="moderator">Moderator</option>
              </select>
              <Button
                type="button"
                size="sm"
                onClick={handleGrantModerator}
                disabled={
                  isSavingMod || !newModUid.trim() || newModName.trim().length < 2
                }
                className="h-9"
              >
                {isSavingMod ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Grant Access'
                )}
              </Button>
            </div>
            {moderators.length > 0 && (
              <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
                {moderators.map((mod) => (
                  <div
                    key={mod.uid}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-foreground">
                      <span className="font-semibold">{mod.displayName}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="capitalize text-muted-foreground">
                        {mod.role}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                        {mod.uid}
                      </code>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevokeModerator(mod.uid)}
                      className="h-7 px-2 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only">Revoke access</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-6">
        {/* Compose Area */}
        {!isUserLoading && !canWrite ? (
          <div className="mb-6 flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-foreground">
                {user && !isMfaVerified
                  ? 'Complete Email OTP verification to participate'
                  : 'Sign in to ask a question or upvote'}
              </p>
              <p className="text-xs text-muted-foreground">
                Live Q&amp;A updates are visible to everyone. Posting and
                upvoting require a Google + Email OTP verified attendee session.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {user && !isMfaLoading && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(user.uid, 'Your UID')}
                  className="text-xs text-muted-foreground"
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy UID
                </Button>
              )}
              <Button asChild size="sm">
                <Link href="/login">
                  <LogIn className="mr-1.5 h-4 w-4" />
                  {user && !isMfaVerified ? 'Verify OTP' : 'Sign In'}
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="mb-6 flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4">
            <Textarea
              placeholder="Ask a question for the speaker..."
              value={newQuestion}
              maxLength={QUESTION_MAX_LENGTH}
              rows={2}
              onChange={(e) => setNewQuestion(e.target.value)}
              disabled={isSubmitting || isUserLoading}
              onKeyDown={(e) => {
                if (
                  e.key === 'Enter' &&
                  !e.shiftKey &&
                  !isSubmitting &&
                  trimmedQuestion.length >= QUESTION_MIN_LENGTH
                ) {
                  e.preventDefault();
                  void handleQuestionSubmit();
                }
              }}
              className="resize-none bg-background text-sm"
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`anonymous-${sessionId}`}
                    checked={postAnonymously}
                    onCheckedChange={(checked) =>
                      setPostAnonymously(checked === true)
                    }
                    disabled={isSubmitting || isUserLoading}
                  />
                  <Label
                    htmlFor={`anonymous-${sessionId}`}
                    className="cursor-pointer text-xs font-medium text-muted-foreground"
                  >
                    Post anonymously
                  </Label>
                </div>
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    isQuestionTooShort
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  )}
                >
                  {trimmedQuestion.length}/{QUESTION_MAX_LENGTH}
                  {isQuestionTooShort && ` (min ${QUESTION_MIN_LENGTH})`}
                </span>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                {user && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(user.uid, 'Your speaker UID')}
                    className="h-8 text-xs text-muted-foreground"
                    title="Copy your UID to request speaker moderation access"
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    My UID
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={handleQuestionSubmit}
                  disabled={
                    isSubmitting ||
                    isUserLoading ||
                    trimmedQuestion.length < QUESTION_MIN_LENGTH
                  }
                  size="sm"
                  className="h-9 px-4"
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Post Question
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div
          className="mb-4 flex flex-wrap items-center gap-2 border-b border-border/70 pb-3"
          role="tablist"
          aria-label="Filter session questions"
        >
          {(
            [
              { key: 'active', label: 'Active', count: counts.active },
              { key: 'pinned', label: 'Pinned', count: counts.pinned },
              { key: 'answered', label: 'Answered', count: counts.answered },
              ...(isAdmin
                ? [
                    {
                      key: 'archived' as const,
                      label: 'Archived',
                      count: counts.archived,
                    },
                  ]
                : []),
            ] as const
          ).map((tab) => {
            const isSelected = activeFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setActiveFilter(tab.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  isSelected
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

        {streamError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Sync Error</AlertTitle>
            <AlertDescription>{streamError}</AlertDescription>
          </Alert>
        )}

        {/* Questions Feed */}
        <div className="space-y-3">
          {isLoadingQuestions ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          ) : filteredQuestions.length > 0 ? (
            filteredQuestions.map((question) => {
              const hasUpvoted = upvotedIds.has(question.id);
              const isUpvotePending = pendingUpvoteIds.has(question.id);
              const isModPending = pendingModIds.has(question.id);
              const relativeTime = formatDistanceToNow(
                new Date(question.createdAtMs),
                { addSuffix: true }
              );

              return (
                <div
                  key={question.id}
                  className={cn(
                    'flex items-start gap-3.5 rounded-lg border p-4 transition-colors',
                    question.archived
                      ? 'border-border/60 bg-muted/30 opacity-75'
                      : question.pinned && !question.answered
                        ? 'border-primary/40 bg-primary/[0.03]'
                        : question.answered
                          ? 'border-emerald-500/30 bg-emerald-500/[0.03]'
                          : 'border-border bg-background'
                  )}
                >
                  {/* Upvote Column */}
                  <div className="flex flex-col items-center gap-1.5 pt-0.5">
                    <Button
                      type="button"
                      variant={hasUpvoted ? 'default' : 'outline'}
                      size="sm"
                      disabled={isUpvotePending || question.archived}
                      onClick={() => handleUpvoteToggle(question)}
                      aria-pressed={hasUpvoted}
                      aria-label={
                        hasUpvoted
                          ? `Remove upvote (${question.upvotesCount})`
                          : `Upvote question (${question.upvotesCount})`
                      }
                      className={cn(
                        'flex h-auto min-w-[48px] flex-col gap-0.5 px-2.5 py-2',
                        !hasUpvoted && 'text-foreground hover:border-primary/50'
                      )}
                    >
                      {isUpvotePending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ThumbsUp className="h-4 w-4" />
                      )}
                      <span className="text-xs font-bold tabular-nums">
                        {question.upvotesCount}
                      </span>
                    </Button>
                  </div>

                  {/* Body + Metadata + Controls */}
                  <div className="min-w-0 flex-1">
                    {/* Status Line (zero-pill typography) */}
                    {(question.pinned || question.answered || question.archived) && (
                      <div className="mb-1.5 flex flex-wrap items-center gap-3 text-xs font-semibold">
                        {question.pinned && (
                          <span className="inline-flex items-center gap-1 text-primary">
                            <Pin className="h-3.5 w-3.5" />
                            Pinned by Speaker
                          </span>
                        )}
                        {question.answered && (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Answered
                          </span>
                        )}
                        {question.archived && (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Archive className="h-3.5 w-3.5" />
                            Archived
                          </span>
                        )}
                      </div>
                    )}

                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                      {question.text}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
                          <User className="h-3.5 w-3.5" />
                          {question.authorName}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{relativeTime}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(question.text)}
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                          title="Copy question text"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span className="sr-only sm:not-sr-only sm:ml-1">
                            Copy
                          </span>
                        </Button>

                        {canModerate && (
                          <>
                            <Button
                              type="button"
                              variant={question.pinned ? 'secondary' : 'outline'}
                              size="sm"
                              disabled={isModPending || question.archived}
                              onClick={() =>
                                handleModeration(
                                  question,
                                  { pinned: !question.pinned },
                                  question.pinned
                                    ? 'Question unpinned'
                                    : 'Question pinned to top'
                                )
                              }
                              className="h-7 px-2.5 text-xs"
                            >
                              {question.pinned ? (
                                <>
                                  <PinOff className="mr-1 h-3.5 w-3.5" />
                                  Unpin
                                </>
                              ) : (
                                <>
                                  <Pin className="mr-1 h-3.5 w-3.5" />
                                  Pin
                                </>
                              )}
                            </Button>

                            <Button
                              type="button"
                              variant={
                                question.answered ? 'secondary' : 'outline'
                              }
                              size="sm"
                              disabled={isModPending || question.archived}
                              onClick={() =>
                                handleModeration(
                                  question,
                                  { answered: !question.answered },
                                  question.answered
                                    ? 'Marked unanswered'
                                    : 'Marked answered'
                                )
                              }
                              className="h-7 px-2.5 text-xs"
                            >
                              <CheckCircle2
                                className={cn(
                                  'mr-1 h-3.5 w-3.5',
                                  question.answered &&
                                    'text-emerald-600 dark:text-emerald-400'
                                )}
                              />
                              {question.answered ? 'Reopen' : 'Mark Answered'}
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isModPending}
                              onClick={() =>
                                handleModeration(
                                  question,
                                  {
                                    archived: !question.archived,
                                    ...(question.archived ? {} : { pinned: false }),
                                  },
                                  question.archived
                                    ? 'Question restored to live feed'
                                    : 'Question archived'
                                )
                              }
                              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                            >
                              {question.archived ? (
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
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-lg border border-dashed border-border py-10 px-4 text-center">
              <p className="text-sm font-medium text-foreground">
                {activeFilter === 'active' && 'No live questions yet.'}
                {activeFilter === 'pinned' && 'No pinned questions yet.'}
                {activeFilter === 'answered' &&
                  'No questions marked answered yet.'}
                {activeFilter === 'archived' && 'No archived questions.'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {activeFilter === 'active'
                  ? 'Be the first verified attendee to ask a question for this session.'
                  : 'Switch back to Active to view incoming audience questions.'}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
