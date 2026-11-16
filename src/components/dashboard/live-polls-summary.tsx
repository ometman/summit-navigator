'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { agendaData } from '@/lib/data';
import { useFirebase } from '@/firebase';
import { testFirestoreConnection } from '@/firebase/qa';
import { subscribeToAllSessionPolls, type SessionPoll } from '@/firebase/polls';
import { cn } from '@/lib/utils';

type TypeFilter = 'all' | 'multiple_choice' | 'commitment';

const sessionChartConfig: ChartConfig = {
  multipleChoiceVotes: {
    label: 'Multiple-Choice Votes',
    color: 'hsl(var(--chart-1))',
  },
  commitmentVotes: {
    label: '1-Tap Commitments',
    color: 'hsl(var(--chart-2))',
  },
};

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
    return 'Daily Firestore quota exceeded. Live aggregate updates will resume once quota resets.';
  }
  return detail || 'Unable to stream live poll aggregates right now.';
}

export function LivePollsSummary() {
  const { firestore, auth, isUserLoading } = useFirebase();

  const [polls, setPolls] = useState<SessionPoll[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<TypeFilter>('all');

  useEffect(() => {
    if (!firestore) return;
    void testFirestoreConnection(firestore);
  }, [firestore]);

  useEffect(() => {
    if (!firestore || isUserLoading) return;

    setIsLoading(true);
    setStreamError(null);

    const unsubscribe = subscribeToAllSessionPolls(
      firestore,
      auth,
      (mergedPolls, allLoaded) => {
        setPolls(mergedPolls);
        if (allLoaded) {
          setIsLoading(false);
        }
        setStreamError(null);
      },
      (err) => {
        setStreamError(extractFriendlyErrorMessage(err));
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, auth, isUserLoading]);

  const sessionMap = useMemo(() => {
    const map = new Map<string, { title: string; speaker: string }>();
    for (const s of agendaData) {
      map.set(s.id.toString(), { title: s.title, speaker: s.speaker });
    }
    return map;
  }, []);

  const stats = useMemo(() => {
    let openCount = 0;
    let totalVotes = 0;
    let commitmentPrompts = 0;
    let commitmentResponses = 0;

    for (const poll of polls) {
      if (poll.status === 'open') openCount += 1;
      totalVotes += poll.totalVotes;
      if (poll.pollType === 'commitment') {
        commitmentPrompts += 1;
        commitmentResponses += poll.totalVotes;
      }
    }

    return {
      totalPolls: polls.length,
      openCount,
      totalVotes,
      commitmentPrompts,
      commitmentResponses,
    };
  }, [polls]);

  const sessionChartData = useMemo(() => {
    return agendaData.map((session) => {
      const sid = session.id.toString();
      let multipleChoiceVotes = 0;
      let commitmentVotes = 0;

      for (const poll of polls) {
        if (poll.sessionId !== sid) continue;
        if (poll.pollType === 'commitment') {
          commitmentVotes += poll.totalVotes;
        } else {
          multipleChoiceVotes += poll.totalVotes;
        }
      }

      return {
        sessionLabel: `S${session.id}`,
        sessionTitle: session.title,
        multipleChoiceVotes,
        commitmentVotes,
      };
    });
  }, [polls]);

  const filteredPolls = useMemo(() => {
    return polls.filter((poll) => {
      if (selectedSession !== 'all' && poll.sessionId !== selectedSession) {
        return false;
      }
      if (selectedType !== 'all' && poll.pollType !== selectedType) {
        return false;
      }
      return true;
    });
  }, [polls, selectedSession, selectedType]);

  return (
    <section className="mt-8">
      <Card className="shadow-xl">
        <CardHeader className="border-b border-border/70 pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2.5 text-2xl font-bold text-foreground">
                <BarChart3 className="h-6 w-6 text-primary" />
                <span>Live Audience Polls &amp; Sentiment Pulse</span>
              </CardTitle>
              <CardDescription className="mt-1">
                Real-time aggregate results from speaker polls and 1-tap
                commitment prompts across all six summit sessions.
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm" className="self-start">
              <Link href="/session/1">
                Go to Session 1 Polls
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {/* Real-time aggregate summary metrics */}
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">
                Total Polls Launched
              </p>
              <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">
                {isLoading ? '—' : stats.totalPolls}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">
                Open Right Now
              </p>
              <p className="mt-1 text-2xl font-bold text-primary tabular-nums">
                {isLoading ? '—' : stats.openCount}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">
                Aggregate Responses
              </p>
              <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">
                {isLoading ? '—' : stats.totalVotes}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">
                1-Tap Commitments
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {isLoading ? '—' : stats.commitmentResponses}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {streamError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Stream Error</AlertTitle>
              <AlertDescription>{streamError}</AlertDescription>
            </Alert>
          )}

          {/* Engagement distribution chart */}
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Response Volume by Summit Session
                </h3>
                <p className="text-xs text-muted-foreground">
                  Compares multiple-choice votes and 1-tap commitments per
                  session (S1–S6).
                </p>
              </div>
              <span className="text-xs font-medium text-muted-foreground tabular-nums">
                {stats.commitmentPrompts} commitment ·{' '}
                {Math.max(0, stats.totalPolls - stats.commitmentPrompts)} poll
                prompts
              </span>
            </div>
            <div className="h-56 w-full">
              <ChartContainer
                config={sessionChartConfig}
                className="h-full w-full"
              >
                <BarChart
                  accessibilityLayer
                  data={sessionChartData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="sessionLabel"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent />}
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar
                    dataKey="multipleChoiceVotes"
                    fill="var(--color-multipleChoiceVotes)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="commitmentVotes"
                    fill="var(--color-commitmentVotes)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </div>
          </div>

          {/* Filter controls */}
          <div className="flex flex-col gap-3 border-b border-border/70 pb-4 md:flex-row md:items-center md:justify-between">
            <div
              className="flex flex-wrap items-center gap-1.5"
              role="tablist"
              aria-label="Filter polls by session"
            >
              <button
                type="button"
                role="tab"
                aria-selected={selectedSession === 'all'}
                onClick={() => setSelectedSession('all')}
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  selectedSession === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                All Sessions
              </button>
              {agendaData.map((session) => {
                const sid = session.id.toString();
                const isSelected = selectedSession === sid;
                return (
                  <button
                    key={sid}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setSelectedSession(sid)}
                    className={cn(
                      'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors tabular-nums',
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    Session {sid}
                  </button>
                );
              })}
            </div>

            <div className="inline-flex self-start rounded-md border border-border bg-background p-0.5 md:self-auto">
              {(
                [
                  { key: 'all', label: 'All Types' },
                  { key: 'multiple_choice', label: 'Polls' },
                  { key: 'commitment', label: 'Commitments' },
                ] as const
              ).map((typeTab) => (
                <button
                  key={typeTab.key}
                  type="button"
                  onClick={() => setSelectedType(typeTab.key)}
                  className={cn(
                    'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                    selectedType === typeTab.key
                      ? 'bg-secondary text-secondary-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {typeTab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Aggregate Poll Breakdown Grid */}
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-48 w-full rounded-lg" />
              <Skeleton className="h-48 w-full rounded-lg" />
            </div>
          ) : filteredPolls.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredPolls.map((poll) => {
                const sessionInfo = sessionMap.get(poll.sessionId);
                const isCommitment = poll.pollType === 'commitment';
                const maxCount = Math.max(...poll.counts, 0);
                const relativeTime = formatDistanceToNow(
                  new Date(poll.createdAtMs),
                  { addSuffix: true }
                );

                return (
                  <div
                    key={`${poll.sessionId}-${poll.id}`}
                    className="flex flex-col justify-between rounded-lg border border-border bg-background p-4"
                  >
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
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
                          Session {poll.sessionId} ·{' '}
                          {isCommitment ? '1-Tap Commitment' : 'Poll'}
                        </span>
                        <span className="tabular-nums font-medium text-foreground">
                          {poll.status === 'open' ? 'Open' : 'Closed'} ·{' '}
                          {poll.totalVotes}{' '}
                          {poll.totalVotes === 1 ? 'vote' : 'votes'}
                        </span>
                      </div>

                      {sessionInfo && (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {sessionInfo.title} · {sessionInfo.speaker}
                        </p>
                      )}

                      <h4 className="mt-2.5 text-sm font-semibold leading-snug text-foreground">
                        {poll.question}
                      </h4>

                      <div className="mt-3 space-y-2">
                        {poll.options.map((optionLabel, idx) => {
                          const count = poll.counts[idx] ?? 0;
                          const pct =
                            poll.totalVotes > 0
                              ? Math.round((count / poll.totalVotes) * 100)
                              : 0;
                          const isLeading =
                            poll.totalVotes > 0 && count === maxCount;

                          return (
                            <div
                              key={`${poll.id}-opt-${idx}`}
                              className="space-y-1"
                            >
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <span
                                  className={cn(
                                    'flex min-w-0 items-center gap-1.5 truncate',
                                    isLeading
                                      ? 'font-semibold text-foreground'
                                      : 'text-muted-foreground'
                                  )}
                                >
                                  {isLeading && (
                                    <CheckCircle2
                                      className={cn(
                                        'h-3.5 w-3.5 shrink-0',
                                        isCommitment
                                          ? 'text-emerald-600 dark:text-emerald-400'
                                          : 'text-primary'
                                      )}
                                    />
                                  )}
                                  <span className="truncate">{optionLabel}</span>
                                </span>
                                <span className="shrink-0 font-semibold text-foreground tabular-nums">
                                  {pct}%{' '}
                                  <span className="font-normal text-muted-foreground">
                                    ({count})
                                  </span>
                                </span>
                              </div>
                              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                <div
                                  style={{ width: `${pct}%` }}
                                  className={cn(
                                    'h-full rounded-full transition-all duration-500',
                                    isCommitment
                                      ? isLeading
                                        ? 'bg-emerald-600'
                                        : 'bg-emerald-500/50'
                                      : isLeading
                                        ? 'bg-primary'
                                        : 'bg-primary/45'
                                  )}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
                      <span>
                        {poll.createdByName} · {relativeTime}
                      </span>
                      <Link
                        href={`/session/${poll.sessionId}`}
                        className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                      >
                        {poll.status === 'open' ? 'Respond Live' : 'Open Session'}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">
                No live polls match the current filter.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Speakers can launch multiple-choice polls or 1-tap commitment
                checks inside any session page, and results stream here
                immediately.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {agendaData.slice(0, 3).map((s) => (
                  <Button key={s.id} asChild variant="outline" size="sm">
                    <Link href={`/session/${s.id}`}>
                      Open Session {s.id}
                    </Link>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
