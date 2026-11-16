import { agendaData, speakerData, type Session } from '@/lib/data';

export type DownloadFormat = 'md' | 'txt' | 'json';
export type PlaybackSpeed = 1 | 1.25 | 1.5;

export interface UserFooterSettings {
  defaultDownloadFormat: DownloadFormat;
  showCaptions: boolean;
  playbackSpeed: PlaybackSpeed;
  autoAdvanceSlides: boolean;
}

export const DEFAULT_FOOTER_SETTINGS: UserFooterSettings = {
  defaultDownloadFormat: 'md',
  showCaptions: true,
  playbackSpeed: 1,
  autoAdvanceSlides: true,
};

export const SUMMIT_SETTINGS_KEY = 'summit_navigator_user_settings_v1';
export const SUMMIT_ENGAGEMENT_KEY = 'summit_navigator_engagement_v1';

export interface EngagementState {
  likedIds: string[];
  likeCounts: Record<string, number>;
  shareCount: number;
}

export const INITIAL_ENGAGEMENT_STATE: EngagementState = {
  likedIds: [],
  likeCounts: {
    'summit-overview': 142,
    'session-1': 64,
    'session-2': 89,
    'session-3': 73,
    'session-4': 95,
    'session-5': 58,
    'session-6': 81,
  },
  shareCount: 36,
};

export interface PresentationSlide {
  heading: string;
  subheading: string;
  bullets: string[];
  caption: string;
  accentHex: string;
}

const SESSION_SLIDES: Record<number, PresentationSlide[]> = {
  1: [
    {
      heading: 'Understanding the Vision of the Church',
      subheading: 'Keynote Opening · Bishop Davis Freeman',
      bullets: [
        'Align local ministry operations with the global Great Commission.',
        'Build multi-generational leadership pipelines grounded in prayer.',
        'Turn spiritual conviction into measurable community transformation.',
      ],
      caption: 'Vision sets the horizon so every ministry team moves in unified rhythm.',
      accentHex: '#375EAB',
    },
    {
      heading: 'Mobilizing Generations for Growth',
      subheading: 'Session 1 · 40 min Teaching + 15 min Q&A',
      bullets: [
        'Clarify the core mandate before launching new programs.',
        'Equip emerging leaders with clear stewardship expectations.',
        'Anchor weekly ministry calendars around mission impact.',
      ],
      caption: 'Clarity multiplies momentum when leaders share one unified purpose.',
      accentHex: '#375EAB',
    },
  ],
  2: [
    {
      heading: 'Church Strategy and Policy',
      subheading: 'Omet Omeni · Operations & Strategy',
      bullets: [
        'Translate vision into actionable departmental scorecards.',
        'Balance spiritual vitality with transparent governance.',
        'Establish a Departmental Heads Council for monthly alignment.',
      ],
      caption: 'Write the vision and make it plain so every team can execute with order.',
      accentHex: '#10B981',
    },
    {
      heading: 'Five Essential Policy Pillars',
      subheading: 'Governance Framework · Habakkuk 2:2',
      bullets: [
        'Financial controls, budget sign-off, and regular audits.',
        'Role clarity, volunteer onboarding, and conflict resolution.',
        'Secure data stewardship and annual policy reviews.',
      ],
      caption: 'Healthy policy protects people, stewards resources, and sustains revival.',
      accentHex: '#10B981',
    },
  ],
  3: [
    {
      heading: 'Biblical Stewardship of Church Leaders',
      subheading: 'Dr. Richard Yeboah · Ethics & Finance',
      bullets: [
        'Cultivate personal financial discipline and public transparency.',
        'Separate governance oversight from day-to-day treasury tasks.',
        'Practice spiritual accountability at every leadership tier.',
      ],
      caption: 'Integrity in small trusts qualifies a ministry for greater influence.',
      accentHex: '#F59E0B',
    },
    {
      heading: 'Stewardship Habits for Sustainable Ministry',
      subheading: 'Session 3 · Practical Safeguards',
      bullets: [
        'Adopt dual-signature financial review and clear reporting.',
        'Invest proactively in leader rest, ethics, and mentorship.',
        'Measure faithfulness alongside attendance and giving.',
      ],
      caption: 'Trust is the currency of leadership—guarded by transparent stewardship.',
      accentHex: '#F59E0B',
    },
  ],
  4: [
    {
      heading: 'Contemporary Church Methods',
      subheading: 'Bishop Davis Freeman · Digital & NextGen',
      bullets: [
        'Keep timeless doctrine central while modernizing delivery.',
        'Use digital media and follow-up workflows to reach families.',
        'Empower youth and creative teams with real ministry ownership.',
      ],
      caption: 'Methods evolve across generations while the core message stands firm.',
      accentHex: '#EF4444',
    },
    {
      heading: 'Hybrid Outreach & Community Engagement',
      subheading: 'Session 4 · Afternoon Opening',
      bullets: [
        'Design seamless guest journeys from online discovery to Sunday welcome.',
        'Equip small-group hosts with lightweight digital resources.',
        'Track weekly engagement beyond weekend attendance.',
      ],
      caption: 'Intentional digital hospitality turns online visitors into rooted disciples.',
      accentHex: '#EF4444',
    },
  ],
  5: [
    {
      heading: 'Church Service Delivery',
      subheading: 'Omet Omeni · Operational Excellence',
      bullets: [
        'Map the guest experience from parking lot to small-group connection.',
        'Standardize volunteer briefings and rehearsal checklists.',
        'Review service flow weekly to eliminate friction for newcomers.',
      ],
      caption: 'Excellence honors guests and removes distractions from worship.',
      accentHex: '#8B5CF6',
    },
    {
      heading: 'Coordinating Sunday & Midweek Operations',
      subheading: 'Session 5 · Team Playbook',
      bullets: [
        'Cross-train hospitality, technical, and prayer response teams.',
        'Use post-service debriefs to celebrate wins and refine handoffs.',
        'Protect volunteer sustainability through healthy rotation schedules.',
      ],
      caption: 'Repeatable service systems free leaders to focus on people.',
      accentHex: '#8B5CF6',
    },
  ],
  6: [
    {
      heading: 'Church Membership Management',
      subheading: 'Dr. Richard Yeboah · Discipleship & Retention',
      bullets: [
        'Build a clear assimilation pathway from first visit to active serving.',
        'Spot pastoral care needs early with structured follow-up.',
        'Pair every new member with a mentor or small-group community.',
      ],
      caption: 'Growth endures when every member is known, cared for, and equipped.',
      accentHex: '#2563EB',
    },
    {
      heading: 'Closing Mandate & Summit Action Plan',
      subheading: 'Session 6 · Closing Charge',
      bullets: [
        'Select top 2 operational improvements for the next 30 days.',
        'Align department leads around shared discipleship milestones.',
        'Commit the next season of growth in corporate prayer.',
      ],
      caption: 'Take today’s insights back to your local team with concrete next steps.',
      accentHex: '#2563EB',
    },
  ],
};

export interface SessionStudyPacket {
  title: string;
  notes: string;
}

export function getDefaultStudyPacket(session: Session): SessionStudyPacket {
  return {
    title: `Session ${session.id} Study Packet: ${session.title}`,
    notes: [
      `Key Focus: ${session.summary}`,
      `Reflection Prompt: Identify one concrete workflow or discipleship practice from "${session.title}" to implement with your ministry team within 30 days.`,
      `Prayer Focus (${session.prayer} min): Commit church leaders, volunteers, and upcoming community outreach initiatives to the Lord.`,
    ].join('\n\n'),
  };
}

export function getSlidesForSession(
  session: Session,
  customSlides?: PresentationSlide[]
): PresentationSlide[] {
  if (Array.isArray(customSlides) && customSlides.length > 0) {
    return customSlides;
  }
  return (
    SESSION_SLIDES[session.id] || [
      {
        heading: session.title,
        subheading: `${session.speaker} · ${session.time}`,
        bullets: [session.summary],
        caption: session.summary,
        accentHex: '#375EAB',
      },
    ]
  );
}

export function buildSessionGuideContent(
  session: Session,
  format: DownloadFormat,
  customSlides?: PresentationSlide[],
  studyPacket?: SessionStudyPacket
): { filename: string; content: string; mimeType: string } {
  const slides = getSlidesForSession(session, customSlides);
  const packet = studyPacket || getDefaultStudyPacket(session);
  const slug = session.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  if (format === 'json') {
    return {
      filename: `summit-session-${session.id}-${slug}.json`,
      mimeType: 'application/json;charset=utf-8',
      content: JSON.stringify(
        {
          event: 'Summit Navigator',
          theme: 'Preparing the Workforce for Growth and Impact',
          session,
          studyPacket: packet,
          presentationSlides: slides,
        },
        null,
        2
      ),
    };
  }

  if (format === 'txt') {
    const lines = [
      `SUMMIT NAVIGATOR — ${packet.title.toUpperCase()}`,
      `Title: ${session.title}`,
      `Speaker: ${session.speaker}`,
      `Time: ${session.time}`,
      `Breakdown: ${session.content}m Teaching | ${session.qa}m Q&A | ${session.prayer}m Prayer`,
      '',
      'OVERVIEW',
      session.summary,
      '',
      'STUDY PACKET NOTES',
      packet.notes || 'No additional organizer notes.',
      '',
      'PRESENTATION HIGHLIGHTS',
      ...slides.flatMap((slide, i) => [
        `${i + 1}. ${slide.heading} (${slide.subheading})`,
        ...slide.bullets.map((b) => `   - ${b}`),
        '',
      ]),
    ];
    return {
      filename: `summit-session-${session.id}-${slug}.txt`,
      mimeType: 'text/plain;charset=utf-8',
      content: lines.join('\n'),
    };
  }

  const md = [
    `# Session ${session.id}: ${session.title}`,
    '',
    `**Study Packet:** ${packet.title}  `,
    `- **Speaker:** ${session.speaker}`,
    `- **Time:** ${session.time}`,
    `- **Allocation:** ${session.content} min Teaching · ${session.qa} min Q&A · ${session.prayer} min Prayer`,
    '',
    '## Overview',
    session.summary,
    '',
    '## Study Packet Notes',
    packet.notes || 'No additional organizer notes.',
    '',
    '## Presentation Key Takeaways',
    ...slides.flatMap((slide, i) => [
      `### ${i + 1}. ${slide.heading}`,
      `*${slide.subheading}*`,
      '',
      ...slide.bullets.map((b) => `- ${b}`),
      '',
    ]),
  ].join('\n');

  return {
    filename: `summit-session-${session.id}-${slug}.md`,
    mimeType: 'text/markdown;charset=utf-8',
    content: md,
  };
}

export function buildFullSummitPackContent(
  format: DownloadFormat,
  sessionsList: Session[] = agendaData,
  speakersList = speakerData,
  slidesBySessionId: Record<number, PresentationSlide[]> = {},
  studyPacketsBySessionId: Record<number, SessionStudyPacket> = {}
): { filename: string; content: string; mimeType: string } {
  if (format === 'json') {
    return {
      filename: 'summit-navigator-full-pack.json',
      mimeType: 'application/json;charset=utf-8',
      content: JSON.stringify(
        {
          event: 'Summit Navigator',
          theme: 'Preparing the Workforce for Growth and Impact',
          scheduleWindow: '9:00 AM - 3:45 PM',
          speakers: speakersList,
          sessions: sessionsList.map((session) => ({
            ...session,
            studyPacket:
              studyPacketsBySessionId[session.id] || getDefaultStudyPacket(session),
            slides: getSlidesForSession(session, slidesBySessionId[session.id]),
          })),
        },
        null,
        2
      ),
    };
  }

  if (format === 'txt') {
    const lines = [
      'SUMMIT NAVIGATOR — COMPLETE LEADERSHIP PACK',
      'Theme: Preparing the Workforce for Growth and Impact',
      'Schedule: 9:00 AM - 3:45 PM (Lunch Break: 12:00 PM - 12:45 PM)',
      '',
      'EXPERT SPEAKERS',
      ...speakersList.map((sp) => `- ${sp.name} (${sp.role}): ${sp.bio}`),
      '',
      'FULL AGENDA & STUDY PACKETS',
      ...sessionsList.flatMap((s) => {
        const packet = studyPacketsBySessionId[s.id] || getDefaultStudyPacket(s);
        return [
          `[${s.time}] Session ${s.id}: ${s.title} — ${s.speaker}`,
          `Summary: ${s.summary}`,
          `Study Packet (${packet.title}): ${packet.notes}`,
          ...getSlidesForSession(s, slidesBySessionId[s.id]).flatMap((sl) =>
            sl.bullets.map((b) => `  * ${b}`)
          ),
          '',
        ];
      }),
    ];
    return {
      filename: 'summit-navigator-full-pack.txt',
      mimeType: 'text/plain;charset=utf-8',
      content: lines.join('\n'),
    };
  }

  const md = [
    '# Summit Navigator — Complete Program Pack',
    '',
    '**Theme:** Preparing the Workforce for Growth and Impact  ',
    '**Hours:** 9:00 AM – 3:45 PM (Lunch Break: 12:00 PM – 12:45 PM)',
    '',
    '## Expert Speakers',
    ...speakersList.map((sp) => `- **${sp.name}** — *${sp.role}*: ${sp.bio}`),
    '',
    '## Sessions, Study Packets & Key Takeaways',
    ...sessionsList.flatMap((s) => {
      const packet = studyPacketsBySessionId[s.id] || getDefaultStudyPacket(s);
      return [
        `### ${s.id}. ${s.title} (${s.time})`,
        `**Speaker:** ${s.speaker} · ${s.content}m Teaching · ${s.qa}m Q&A · ${s.prayer}m Prayer`,
        '',
        s.summary,
        '',
        `#### ${packet.title}`,
        packet.notes,
        '',
        ...getSlidesForSession(s, slidesBySessionId[s.id]).flatMap((sl) =>
          sl.bullets.map((b) => `- ${b}`)
        ),
        '',
      ];
    }),
  ].join('\n');

  return {
    filename: 'summit-navigator-full-pack.md',
    mimeType: 'text/markdown;charset=utf-8',
    content: md,
  };
}

export function buildScheduleCsv(
  sessionsList: Session[] = agendaData
): { filename: string; content: string; mimeType: string } {
  const headers = ['Session ID', 'Time', 'Period', 'Title', 'Speaker', 'Content (min)', 'Q&A (min)', 'Prayer (min)'];
  const rows = sessionsList.map((s) => [
    String(s.id),
    s.time,
    s.afternoon ? 'Afternoon' : 'Morning',
    s.title,
    s.speaker,
    String(s.content),
    String(s.qa),
    String(s.prayer),
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n');

  return {
    filename: 'summit-navigator-schedule.csv',
    mimeType: 'text/csv;charset=utf-8',
    content: csv,
  };
}

export function triggerFileDownload(
  filename: string,
  content: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
