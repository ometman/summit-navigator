import { agendaData } from '@/lib/data';

export type ActionHorizon = 30 | 60 | 90;
export type ActionStatus = 'pending' | 'in_progress' | 'completed';
export type ReminderCadence = 'weekly' | 'biweekly' | 'monthly';
export type ReminderDay = 'Monday' | 'Wednesday' | 'Friday' | 'Saturday';
export type ReminderChannel = 'email_digest' | 'dashboard_banner' | 'both';

export const ACTION_HORIZONS: readonly ActionHorizon[] = [30, 60, 90] as const;

export const MINISTRY_DEPARTMENTS = [
  'Pastoral Leadership',
  'Operations & Strategy',
  'Administration & Governance',
  'Finance & Stewardship',
  'Youth & NextGen',
  'Media & Digital Outreach',
  'Hospitality & Guest Services',
  'Volunteers & Assimilation',
  'Leadership & Discipleship',
] as const;

export const REMINDER_CADENCE_OPTIONS: readonly {
  value: ReminderCadence;
  label: string;
  intervalDays: number;
}[] = [
  { value: 'weekly', label: 'Weekly Check-In', intervalDays: 7 },
  { value: 'biweekly', label: 'Bi-Weekly Check-In', intervalDays: 14 },
  { value: 'monthly', label: 'Monthly Review', intervalDays: 30 },
] as const;

export const REMINDER_DAY_OPTIONS: readonly ReminderDay[] = [
  'Monday',
  'Wednesday',
  'Friday',
  'Saturday',
] as const;

export const REMINDER_CHANNEL_OPTIONS: readonly {
  value: ReminderChannel;
  label: string;
}[] = [
  { value: 'both', label: 'Dashboard Banner + Email Digest' },
  { value: 'dashboard_banner', label: 'Dashboard Banner Only' },
  { value: 'email_digest', label: 'Email Digest Only' },
] as const;

export const DEFAULT_SUMMIT_DATE_ISO = '2026-11-15';

export interface ActionPlanTemplate {
  templateId: string;
  sessionId: string;
  sessionTitle: string;
  horizonDays: ActionHorizon;
  suggestedDepartment: string;
  title: string;
  notes: string;
}

function getSessionTitle(sessionId: number): string {
  return (
    agendaData.find((s) => s.id === sessionId)?.title ||
    `Session ${sessionId}`
  );
}

export const SESSION_ACTION_TEMPLATES: ActionPlanTemplate[] = [
  // Session 1: Understanding the Vision of the Church
  {
    templateId: 'tpl-s1-d30',
    sessionId: '1',
    sessionTitle: getSessionTitle(1),
    horizonDays: 30,
    suggestedDepartment: 'Pastoral Leadership',
    title: 'Align monthly ministry calendar with core Great Commission mandate',
    notes:
      'Audit current recurring events and sunset low-impact programs that pull teams away from unified vision.',
  },
  {
    templateId: 'tpl-s1-d60',
    sessionId: '1',
    sessionTitle: getSessionTitle(1),
    horizonDays: 60,
    suggestedDepartment: 'Leadership & Discipleship',
    title: 'Establish multi-generational leadership pipeline cohort',
    notes:
      'Identify 3–5 emerging leaders across age groups and define clear spiritual & operational stewardship expectations.',
  },
  {
    templateId: 'tpl-s1-d90',
    sessionId: '1',
    sessionTitle: getSessionTitle(1),
    horizonDays: 90,
    suggestedDepartment: 'Operations & Strategy',
    title: 'Publish quarterly community transformation impact report',
    notes:
      'Measure spiritual milestones, volunteer mobilization, and local outreach impact tied directly to church vision.',
  },

  // Session 2: Church Strategy and Policy
  {
    templateId: 'tpl-s2-d30',
    sessionId: '2',
    sessionTitle: getSessionTitle(2),
    horizonDays: 30,
    suggestedDepartment: 'Operations & Strategy',
    title: 'Draft actionable departmental scorecards for every ministry team',
    notes:
      'Translate summit goals into 3 measurable quarterly metrics per department with clear owner sign-off.',
  },
  {
    templateId: 'tpl-s2-d60',
    sessionId: '2',
    sessionTitle: getSessionTitle(2),
    horizonDays: 60,
    suggestedDepartment: 'Administration & Governance',
    title: 'Convene inaugural Departmental Heads Council alignment review',
    notes:
      'Establish monthly cross-team calendar coordination, budget checkpoints, and decision-making clarity.',
  },
  {
    templateId: 'tpl-s2-d90',
    sessionId: '2',
    sessionTitle: getSessionTitle(2),
    horizonDays: 90,
    suggestedDepartment: 'Administration & Governance',
    title: 'Ratify five core church policy pillars and annual review cycle',
    notes:
      'Document financial controls, volunteer onboarding standards, conflict resolution, and member data stewardship.',
  },

  // Session 3: Biblical Stewardship of Church Leaders
  {
    templateId: 'tpl-s3-d30',
    sessionId: '3',
    sessionTitle: getSessionTitle(3),
    horizonDays: 30,
    suggestedDepartment: 'Finance & Stewardship',
    title: 'Enforce dual-signature financial review and separated oversight',
    notes:
      'Separate governance approval from day-to-day treasury handling to safeguard ministry credibility.',
  },
  {
    templateId: 'tpl-s3-d60',
    sessionId: '3',
    sessionTitle: getSessionTitle(3),
    horizonDays: 60,
    suggestedDepartment: 'Finance & Stewardship',
    title: 'Share transparent stewardship & budget update with leadership board',
    notes:
      'Review giving faithfulness, reserve targets, and mission allocation ratios with full fiscal transparency.',
  },
  {
    templateId: 'tpl-s3-d90',
    sessionId: '3',
    sessionTitle: getSessionTitle(3),
    horizonDays: 90,
    suggestedDepartment: 'Pastoral Leadership',
    title: 'Institute leader Sabbath rest rhythm and peer accountability pairs',
    notes:
      'Schedule proactive rest blocks, ethical conduct check-ins, and mentorship support for key pastors and staff.',
  },

  // Session 4: Contemporary Church Methods
  {
    templateId: 'tpl-s4-d30',
    sessionId: '4',
    sessionTitle: getSessionTitle(4),
    horizonDays: 30,
    suggestedDepartment: 'Media & Digital Outreach',
    title: 'Map online visitor-to-Sunday follow-up workflow within 48 hours',
    notes:
      'Connect digital watch-party and social inquiries directly to a personal welcome touchpoint.',
  },
  {
    templateId: 'tpl-s4-d60',
    sessionId: '4',
    sessionTitle: getSessionTitle(4),
    horizonDays: 60,
    suggestedDepartment: 'Youth & NextGen',
    title: 'Assign Youth & NextGen creative leads direct ownership of midweek outreach',
    notes:
      'Equip younger leaders to shape contemporary outreach formats while staying anchored in sound doctrine.',
  },
  {
    templateId: 'tpl-s4-d90',
    sessionId: '4',
    sessionTitle: getSessionTitle(4),
    horizonDays: 90,
    suggestedDepartment: 'Media & Digital Outreach',
    title: 'Launch lightweight digital study kit for hybrid small-group hosts',
    notes:
      'Provide short video recaps, discussion prompts, and attendance check-ins that work seamlessly online and in homes.',
  },

  // Session 5: Church Service Delivery
  {
    templateId: 'tpl-s5-d30',
    sessionId: '5',
    sessionTitle: getSessionTitle(5),
    horizonDays: 30,
    suggestedDepartment: 'Hospitality & Guest Services',
    title: 'Audit Sunday guest journey from parking lot to small-group connection',
    notes:
      'Walk the campus as a first-time family and eliminate signage, seating, or welcome desk friction points.',
  },
  {
    templateId: 'tpl-s5-d60',
    sessionId: '5',
    sessionTitle: getSessionTitle(5),
    horizonDays: 60,
    suggestedDepartment: 'Volunteers & Assimilation',
    title: 'Standardize pre-service briefings, tech checklists, and 10-min debriefs',
    notes:
      'Run unified pre-service huddles across hospitality, tech, and prayer teams every weekend.',
  },
  {
    templateId: 'tpl-s5-d90',
    sessionId: '5',
    sessionTitle: getSessionTitle(5),
    horizonDays: 90,
    suggestedDepartment: 'Volunteers & Assimilation',
    title: 'Roll out cross-trained volunteer rotation schedule to prevent burnout',
    notes:
      'Ensure every critical Sunday serving lane has at least two trained backups on a balanced rotation.',
  },

  // Session 6: Church Membership Management
  {
    templateId: 'tpl-s6-d30',
    sessionId: '6',
    sessionTitle: getSessionTitle(6),
    horizonDays: 30,
    suggestedDepartment: 'Volunteers & Assimilation',
    title: 'Launch 3-step member assimilation pathway from first visit to serving',
    notes:
      'Track Day-1 welcome, Day-14 New Believers/Discovery lunch, and Day-30 serving team placement.',
  },
  {
    templateId: 'tpl-s6-d60',
    sessionId: '6',
    sessionTitle: getSessionTitle(6),
    horizonDays: 60,
    suggestedDepartment: 'Pastoral Leadership',
    title: 'Configure pastoral care follow-up trigger for 3-week absence gaps',
    notes:
      'Assign care team shepherds to reach out warmly whenever a member misses three consecutive gatherings.',
  },
  {
    templateId: 'tpl-s6-d90',
    sessionId: '6',
    sessionTitle: getSessionTitle(6),
    horizonDays: 90,
    suggestedDepartment: 'Leadership & Discipleship',
    title: 'Pair every new member with a discipleship mentor or small group',
    notes:
      'Verify 100% of recent newcomers have an active relational anchor inside the congregation.',
  },
];

export function getTemplatesForSession(sessionId: string): ActionPlanTemplate[] {
  return SESSION_ACTION_TEMPLATES.filter((t) => t.sessionId === sessionId);
}

export function getDefaultDepartmentForRole(role?: string): string {
  switch (role) {
    case 'Senior Pastor':
      return 'Pastoral Leadership';
    case 'Operations & Strategy':
      return 'Operations & Strategy';
    case 'Youth & Outreach':
      return 'Youth & NextGen';
    case 'Volunteer Coordinator':
      return 'Volunteers & Assimilation';
    case 'Ministry Lead':
    default:
      return 'Leadership & Discipleship';
  }
}

export function computeDueDateIso(
  summitDateIso: string,
  horizonDays: ActionHorizon
): string {
  const safeBase = /^\d{4}-\d{2}-\d{2}$/.test(summitDateIso)
    ? summitDateIso
    : DEFAULT_SUMMIT_DATE_ISO;
  const [y, m, d] = safeBase.split('-').map((n) => Number(n));
  const dt = new Date(Date.UTC(y, m - 1, d + horizonDays));
  return dt.toISOString().slice(0, 10);
}

export interface ActionItemForReminder {
  status: ActionStatus;
  dueDateIso: string;
  horizonDays: ActionHorizon;
}

export interface ReminderPreferenceSummaryInput {
  enabled: boolean;
  cadence: ReminderCadence;
  reminderDay: ReminderDay;
  preferredChannel: ReminderChannel;
  lastCheckInIso: string;
}

export interface ComputedReminderStatus {
  isCheckInDue: boolean;
  daysSinceLastCheckIn: number | null;
  dueSoonCount: number;
  overdueCount: number;
  nextReminderDateLabel: string;
  headline: string;
  subline: string;
}

const DAY_INDEX: Record<ReminderDay, number> = {
  Monday: 1,
  Wednesday: 3,
  Friday: 5,
  Saturday: 6,
};

function getCadenceIntervalDays(cadence: ReminderCadence): number {
  return (
    REMINDER_CADENCE_OPTIONS.find((c) => c.value === cadence)?.intervalDays ?? 7
  );
}

export function computeReminderStatus(
  pref: ReminderPreferenceSummaryInput,
  items: ActionItemForReminder[],
  now: Date = new Date()
): ComputedReminderStatus {
  const todayIso = now.toISOString().slice(0, 10);
  const in14Days = new Date(now.getTime() + 14 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  let dueSoonCount = 0;
  let overdueCount = 0;

  for (const item of items) {
    if (item.status === 'completed') continue;
    if (item.dueDateIso < todayIso) {
      overdueCount += 1;
    } else if (item.dueDateIso <= in14Days) {
      dueSoonCount += 1;
    }
  }

  let daysSinceLastCheckIn: number | null = null;
  if (pref.lastCheckInIso) {
    const parsed = Date.parse(pref.lastCheckInIso);
    if (!Number.isNaN(parsed)) {
      daysSinceLastCheckIn = Math.max(
        0,
        Math.floor((now.getTime() - parsed) / 86_400_000)
      );
    }
  }

  const intervalDays = getCadenceIntervalDays(pref.cadence);
  const openCount = items.filter((i) => i.status !== 'completed').length;
  const isCheckInDue =
    pref.enabled &&
    openCount > 0 &&
    (daysSinceLastCheckIn === null || daysSinceLastCheckIn >= intervalDays);

  // Compute next occurrence of reminderDay
  const targetDow = DAY_INDEX[pref.reminderDay] ?? 1;
  const currentDow = now.getUTCDay();
  let deltaDays = (targetDow - currentDow + 7) % 7;
  if (deltaDays === 0 && daysSinceLastCheckIn === 0) {
    deltaDays = intervalDays;
  }
  const nextDate = new Date(now.getTime() + deltaDays * 86_400_000);
  const nextReminderDateLabel = nextDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const cadenceLabel =
    pref.cadence === 'weekly'
      ? 'Weekly'
      : pref.cadence === 'biweekly'
        ? 'Bi-Weekly'
        : 'Monthly';

  let headline = `${cadenceLabel} reminders active (${pref.reminderDay}s)`;
  if (!pref.enabled) {
    headline = 'Accountability reminders paused';
  } else if (overdueCount > 0) {
    headline = `${overdueCount} overdue milestone${overdueCount === 1 ? '' : 's'} need review`;
  } else if (isCheckInDue) {
    headline = `${cadenceLabel} ministry accountability check-in due`;
  } else if (dueSoonCount > 0) {
    headline = `${dueSoonCount} action item${dueSoonCount === 1 ? '' : 's'} due within 14 days`;
  }

  const subline =
    daysSinceLastCheckIn === null
      ? `Next scheduled touchpoint: ${nextReminderDateLabel}`
      : `Last check-in ${daysSinceLastCheckIn === 0 ? 'today' : `${daysSinceLastCheckIn}d ago`} · Next: ${nextReminderDateLabel}`;

  return {
    isCheckInDue,
    daysSinceLastCheckIn,
    dueSoonCount,
    overdueCount,
    nextReminderDateLabel,
    headline,
    subline,
  };
}

export interface ExportableActionItem {
  sessionId: string;
  sessionTitle: string;
  horizonDays: ActionHorizon;
  churchName: string;
  department: string;
  assigneeLabel: string;
  title: string;
  notes: string;
  status: ActionStatus;
  dueDateIso: string;
  completedAtIso: string;
}

export function buildActionPlanMarkdown(
  items: ExportableActionItem[],
  churchName: string,
  cadenceLabel: string
): { filename: string; content: string; mimeType: string } {
  const completedCount = items.filter((i) => i.status === 'completed').length;
  const lines: string[] = [
    `# Post-Summit 30/60/90-Day Ministry Action Plan`,
    '',
    `- **Church / Organization:** ${churchName || 'Local Ministry'}`,
    `- **Reminder Cadence:** ${cadenceLabel}`,
    `- **Progress:** ${completedCount} of ${items.length} milestones completed`,
    '',
  ];

  for (const horizon of ACTION_HORIZONS) {
    const group = items.filter((i) => i.horizonDays === horizon);
    lines.push(`## ${horizon}-Day Milestones (${group.length})`);
    if (group.length === 0) {
      lines.push('- *No milestones assigned to this horizon.*');
    } else {
      for (const item of group) {
        const mark = item.status === 'completed' ? 'x' : ' ';
        lines.push(
          `- [${mark}] **${item.title}** *(Session ${item.sessionId} · ${item.department} · Owner: ${item.assigneeLabel} · Due ${item.dueDateIso})*`
        );
        if (item.notes) {
          lines.push(`  - ${item.notes}`);
        }
      }
    }
    lines.push('');
  }

  return {
    filename: 'summit-30-60-90-action-plan.md',
    mimeType: 'text/markdown;charset=utf-8',
    content: lines.join('\n'),
  };
}

export function buildActionPlanCsv(items: ExportableActionItem[]): {
  filename: string;
  content: string;
  mimeType: string;
} {
  const headers = [
    'Horizon (Days)',
    'Session',
    'Action Title',
    'Church',
    'Department',
    'Assignee',
    'Status',
    'Due Date',
    'Completed At',
    'Notes',
  ];

  const rows = items.map((item) => [
    String(item.horizonDays),
    `Session ${item.sessionId}: ${item.sessionTitle}`,
    item.title,
    item.churchName,
    item.department,
    item.assigneeLabel,
    item.status,
    item.dueDateIso,
    item.completedAtIso || '',
    item.notes || '',
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n');

  return {
    filename: 'summit-30-60-90-action-plan.csv',
    mimeType: 'text/csv;charset=utf-8',
    content: csv,
  };
}
