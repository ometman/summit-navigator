import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';

initializeApp();

const FIRESTORE_DATABASE_ID =
  process.env.FIRESTORE_DATABASE_ID ||
  'ai-studio-summitnavigator-bbf3552c-038d-468f-8110-4c0b4949bb1a';

const CADENCE_DAYS: Record<string, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};

const DAY_INDEX: Record<string, number> = {
  Monday: 1,
  Wednesday: 3,
  Friday: 5,
  Saturday: 6,
};

const WEEKDAYS_UTC = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function computeNextDueAtIso(
  cadence: string,
  reminderDay: string,
  fromDate: Date
): string {
  const interval = CADENCE_DAYS[cadence] ?? 7;
  const targetDow = DAY_INDEX[reminderDay] ?? 1;
  const candidate = new Date(
    Date.UTC(
      fromDate.getUTCFullYear(),
      fromDate.getUTCMonth(),
      fromDate.getUTCDate() + interval
    )
  );
  const delta = (targetDow - candidate.getUTCDay() + 7) % 7;
  candidate.setUTCDate(candidate.getUTCDate() + delta);
  return candidate.toISOString().slice(0, 10);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendDigestMail(params: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<'resend' | 'smtp'> {
  if (process.env.RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:
          process.env.SMTP_FROM || 'Summit Navigator <onboarding@resend.dev>',
        to: [params.to],
        subject: params.subject,
        text: params.text,
        html: params.html,
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend failed: ${await res.text()}`);
    }
    return 'resend';
  }

  if (
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  ) {
    const port = Number(process.env.SMTP_PORT || '587');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    return 'smtp';
  }

  throw new Error('Configure RESEND_API_KEY or SMTP_* secrets before enabling live scheduled sends.');
}

export const scheduledAccountabilityDigest = onSchedule(
  {
    schedule: 'every day 08:00',
    timeZone: 'America/Los_Angeles',
    region: 'europe-west2',
    retryCount: 1,
  },
  async () => {
    const db = getFirestore(FIRESTORE_DATABASE_ID);
    const now = new Date();
    const todayIso = now.toISOString().slice(0, 10);
    const in14DaysIso = new Date(now.getTime() + 14 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const todayWeekday = WEEKDAYS_UTC[now.getUTCDay()];
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    ).replace(/\/$/, '');

    const subsSnap = await db
      .collection('reminderSubscriptions')
      .where('enabled', '==', true)
      .get();

    for (const subDoc of subsSnap.docs) {
      const sub = subDoc.data();
      const uid = String(sub.uid || subDoc.id);
      const email = String(sub.email || '');
      const channel = String(sub.preferredChannel || 'both');
      const cadence = String(sub.cadence || 'weekly');
      const reminderDay = String(sub.reminderDay || 'Monday');

      if (!email || channel === 'dashboard_banner') continue;

      const itemsSnap = await db
        .collection('users')
        .doc(uid)
        .collection('actionItems')
        .get();

      let openCount = 0;
      let completedCount = 0;
      let overdueCount = 0;
      let dueSoonCount = 0;
      const topOpenTitles: string[] = [];

      itemsSnap.docs.forEach((docSnap) => {
        const d = docSnap.data();
        const status = String(d.status || 'pending');
        const due = String(d.dueDateIso || todayIso);
        if (status === 'completed') {
          completedCount += 1;
        } else {
          openCount += 1;
          if (due < todayIso) overdueCount += 1;
          else if (due <= in14DaysIso) dueSoonCount += 1;
          if (topOpenTitles.length < 5) {
            topOpenTitles.push(
              `${Number(d.horizonDays) || 30}-Day · ${String(d.department || 'Ministry')}: ${String(d.title || '')} (Due ${due})`.slice(
                0,
                240
              )
            );
          }
        }
      });

      if (openCount <= 0 && overdueCount <= 0) continue;

      const lastEmailedMs = sub.lastEmailedAtIso
        ? Date.parse(String(sub.lastEmailedAtIso))
        : NaN;
      const intervalDays = CADENCE_DAYS[cadence] ?? 7;
      if (
        !Number.isNaN(lastEmailedMs) &&
        now.getTime() - lastEmailedMs < (intervalDays - 0.8) * 86_400_000
      ) {
        continue;
      }

      if (overdueCount === 0 && todayWeekday !== reminderDay) {
        continue;
      }

      const churchName = String(sub.churchName || 'Local Ministry');
      const displayName = String(sub.displayName || 'Ministry Lead');
      const subject =
        overdueCount > 0
          ? `[Action Needed] ${churchName}: ${overdueCount} Overdue Summit Milestone${overdueCount === 1 ? '' : 's'}`
          : `Summit Navigator Accountability Digest · ${churchName}`;

      const text = [
        `Hello ${displayName},`,
        '',
        `Accountability digest for ${churchName}: ${completedCount} completed, ${openCount} open, ${dueSoonCount} due within 14 days, ${overdueCount} overdue.`,
        '',
        ...topOpenTitles.map((t, i) => `${i + 1}. ${t}`),
        '',
        `Manage your 30/60/90-day checklist: ${appUrl}/action-plan`,
      ].join('\n');

      const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;border:1px solid #e5e7eb;border-radius:10px;">
        <h2>${escapeHtml(churchName)} — Accountability Digest</h2>
        <p>Hello ${escapeHtml(displayName)}, you have ${openCount} open milestone(s) (${overdueCount} overdue, ${dueSoonCount} due within 14 days).</p>
        <ul>${topOpenTitles.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
        <p><a href="${escapeHtml(appUrl)}/action-plan">Open Action Plan &amp; Log Check-In</a></p>
      </div>`;

      const logId = `fn-${uid.slice(0, 20)}-${Date.now()}`;
      try {
        const deliveryMode = await sendDigestMail({
          to: email,
          subject,
          text,
          html,
        });
        const sentAtIso = now.toISOString();
        await db.collection('reminderSubscriptions').doc(uid).update({
          lastEmailedAtIso: sentAtIso,
          nextDueAtIso: computeNextDueAtIso(cadence, reminderDay, now),
          openCount,
          completedCount,
          overdueCount,
          dueSoonCount,
          topOpenTitles,
          updatedAt: FieldValue.serverTimestamp(),
        });
        await db.collection('reminderDispatchLogs').doc(logId).set({
          id: logId,
          uid,
          recipientEmail: email,
          recipientName: displayName,
          churchName,
          cadence,
          triggerSource: 'cron_scheduler',
          deliveryMode,
          status: 'sent',
          openCount,
          overdueCount,
          dueSoonCount,
          subject: subject.slice(0, 200),
          sentAtIso,
          errorMessage: '',
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch (err) {
        logger.error('Failed reminder digest send', { uid, err });
      }
    }
  }
);
