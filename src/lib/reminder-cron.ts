import type {
  ReminderCadence,
  ReminderChannel,
  ReminderDay,
} from '@/lib/action-plan-templates';

export type DispatchTriggerSource =
  | 'cron_scheduler'
  | 'admin_console'
  | 'user_test';
export type DigestDeliveryMode = 'resend' | 'smtp' | 'preview';
export type DigestDispatchStatus = 'sent' | 'preview' | 'failed' | 'skipped';

export interface ReminderSubscriptionSnapshot {
  uid: string;
  email: string;
  displayName: string;
  enabled: boolean;
  cadence: ReminderCadence;
  reminderDay: ReminderDay;
  preferredChannel: ReminderChannel;
  churchName: string;
  defaultDepartment: string;
  summitDateIso: string;
  lastCheckInIso: string;
  lastEmailedAtIso: string;
  nextDueAtIso: string;
  openCount: number;
  completedCount: number;
  overdueCount: number;
  dueSoonCount: number;
  topOpenTitles: string[];
}

export const CADENCE_INTERVAL_DAYS: Record<ReminderCadence, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};

const CADENCE_COOLDOWN_MS: Record<ReminderCadence, number> = {
  weekly: 6.2 * 86_400_000,
  biweekly: 13.2 * 86_400_000,
  monthly: 27.2 * 86_400_000,
};

const DAY_INDEX: Record<ReminderDay, number> = {
  Monday: 1,
  Wednesday: 3,
  Friday: 5,
  Saturday: 6,
};

const WEEKDAY_NAMES_UTC = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export function getUtcWeekdayName(now: Date = new Date()): string {
  return WEEKDAY_NAMES_UTC[now.getUTCDay()] || 'Monday';
}

export function computeNextDueAtIso(
  cadence: ReminderCadence,
  reminderDay: ReminderDay,
  fromDate: Date = new Date()
): string {
  const intervalDays = CADENCE_INTERVAL_DAYS[cadence] ?? 7;
  const targetDow = DAY_INDEX[reminderDay] ?? 1;
  const candidate = new Date(
    Date.UTC(
      fromDate.getUTCFullYear(),
      fromDate.getUTCMonth(),
      fromDate.getUTCDate() + intervalDays
    )
  );
  const deltaToDay = (targetDow - candidate.getUTCDay() + 7) % 7;
  candidate.setUTCDate(candidate.getUTCDate() + deltaToDay);
  return candidate.toISOString().slice(0, 10);
}

export interface DueEvaluationResult {
  isDue: boolean;
  reason: string;
  daysSinceLastEmail: number | null;
}

export function evaluateSubscriptionDueStatus(
  sub: Pick<
    ReminderSubscriptionSnapshot,
    | 'enabled'
    | 'preferredChannel'
    | 'cadence'
    | 'reminderDay'
    | 'lastEmailedAtIso'
    | 'lastCheckInIso'
    | 'openCount'
    | 'overdueCount'
  >,
  now: Date = new Date(),
  options: { force?: boolean; ignoreDayMatch?: boolean } = {}
): DueEvaluationResult {
  if (!sub.enabled) {
    return {
      isDue: false,
      reason: 'Reminders paused by attendee',
      daysSinceLastEmail: null,
    };
  }

  if (sub.preferredChannel === 'dashboard_banner') {
    return {
      isDue: false,
      reason: 'Channel set to dashboard banner only',
      daysSinceLastEmail: null,
    };
  }

  if (sub.openCount <= 0 && sub.overdueCount <= 0) {
    return {
      isDue: false,
      reason: 'All milestones completed',
      daysSinceLastEmail: null,
    };
  }

  let daysSinceLastEmail: number | null = null;
  if (sub.lastEmailedAtIso) {
    const parsed = Date.parse(sub.lastEmailedAtIso);
    if (!Number.isNaN(parsed)) {
      daysSinceLastEmail = Math.max(
        0,
        Math.floor((now.getTime() - parsed) / 86_400_000)
      );
      const cooldownMs = CADENCE_COOLDOWN_MS[sub.cadence] ?? 6.2 * 86_400_000;
      if (!options.force && now.getTime() - parsed < cooldownMs) {
        return {
          isDue: false,
          reason: `Already emailed ${daysSinceLastEmail}d ago (${sub.cadence} cadence)`,
          daysSinceLastEmail,
        };
      }
    }
  }

  // If manually checked in within the last 48h and nothing is overdue, avoid noisy emails
  if (!options.force && sub.overdueCount === 0 && sub.lastCheckInIso) {
    const checkedInMs = Date.parse(sub.lastCheckInIso);
    if (
      !Number.isNaN(checkedInMs) &&
      now.getTime() - checkedInMs < 2 * 86_400_000
    ) {
      return {
        isDue: false,
        reason: 'Recent manual check-in logged within 48h',
        daysSinceLastEmail,
      };
    }
  }

  const todayName = getUtcWeekdayName(now);
  if (
    !options.force &&
    !options.ignoreDayMatch &&
    sub.overdueCount === 0 &&
    todayName !== sub.reminderDay
  ) {
    return {
      isDue: false,
      reason: `Scheduled for ${sub.reminderDay}s (today is ${todayName})`,
      daysSinceLastEmail,
    };
  }

  if (sub.overdueCount > 0) {
    return {
      isDue: true,
      reason: `${sub.overdueCount} overdue milestone${sub.overdueCount === 1 ? '' : 's'} require attention`,
      daysSinceLastEmail,
    };
  }

  return {
    isDue: true,
    reason:
      daysSinceLastEmail === null
        ? `Initial ${sub.cadence} digest ready (${sub.reminderDay} schedule)`
        : `${sub.cadence} cadence interval reached (${daysSinceLastEmail}d since last email)`,
    daysSinceLastEmail,
  };
}
