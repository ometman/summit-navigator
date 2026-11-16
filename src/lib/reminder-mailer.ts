import nodemailer from 'nodemailer';
import type { NextRequest } from 'next/server';
import { firebaseConfig } from '@/firebase/config';
import { verifySignedPayload } from '@/lib/otp';
import type {
  DigestDeliveryMode,
  DispatchTriggerSource,
} from '@/lib/reminder-cron';

const MFA_SESSION_COOKIE = 'summit_mfa_session';
export const BOOTSTRAPPED_ADMIN_EMAIL = 'stackvarsity@gmail.com';

interface MfaSessionPayload {
  uid: string;
  email: string;
  verifiedAt: string;
  exp: number;
}

export interface VerifiedRequestIdentity {
  uid: string;
  email: string;
  emailVerified: boolean;
  isAdmin: boolean;
  source: 'id_token' | 'mfa_cookie';
}

export interface DigestEmailInput {
  recipientEmail: string;
  recipientName: string;
  churchName: string;
  defaultDepartment: string;
  cadence: string;
  reminderDay: string;
  openCount: number;
  completedCount: number;
  overdueCount: number;
  dueSoonCount: number;
  topOpenTitles: string[];
  appBaseUrl?: string;
  triggerSource?: DispatchTriggerSource;
}

export interface DigestDeliveryResult {
  deliveryMode: DigestDeliveryMode;
  status: 'sent' | 'preview';
  subject: string;
  text: string;
  html: string;
  sentAtIso: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildReminderDigestEmail(input: DigestEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const totalCount = Math.max(0, input.openCount) + Math.max(0, input.completedCount);
  const completionPct =
    totalCount > 0 ? Math.round((input.completedCount / totalCount) * 100) : 0;

  const baseUrl = (
    input.appBaseUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
  const actionPlanUrl = `${baseUrl}/action-plan`;

  const subject =
    input.overdueCount > 0
      ? `[Action Needed] ${input.churchName}: ${input.overdueCount} Overdue Summit Milestone${input.overdueCount === 1 ? '' : 's'}`
      : `Summit Navigator Accountability Digest · ${input.churchName} (${completionPct}% Complete)`;

  const milestoneLines =
    input.topOpenTitles.length > 0
      ? input.topOpenTitles
      : [
          'Review your 30 / 60 / 90-day post-summit milestones and log your weekly accountability check-in.',
        ];

  const text = [
    `Hello ${input.recipientName},`,
    '',
    `Here is your ${input.cadence} Summit Navigator accountability digest for ${input.churchName} (${input.defaultDepartment}).`,
    '',
    `Progress Summary: ${input.completedCount} of ${totalCount} milestones completed (${completionPct}%)`,
    `- Open Milestones: ${input.openCount}`,
    `- Due Within 14 Days: ${input.dueSoonCount}`,
    `- Overdue Milestones: ${input.overdueCount}`,
    '',
    'Priority Open Action Steps:',
    ...milestoneLines.map((line, i) => `${i + 1}. ${line}`),
    '',
    `Open your full 30/60/90-Day Action Plan & log check-in: ${actionPlanUrl}`,
    '',
    `Scheduled cadence: ${input.cadence} (${input.reminderDay}s). You can update or pause digest emails anytime in Action Plan > Reminder Settings.`,
  ].join('\n');

  const safeName = escapeHtml(input.recipientName);
  const safeChurch = escapeHtml(input.churchName);
  const safeDept = escapeHtml(input.defaultDepartment);
  const safeCadence = escapeHtml(input.cadence);
  const safeDay = escapeHtml(input.reminderDay);
  const safeUrl = escapeHtml(actionPlanUrl);

  const htmlListItems = milestoneLines
    .map(
      (line) =>
        `<li style="margin: 0 0 8px; color: #1f2937; font-size: 14px; line-height: 1.5;">${escapeHtml(line)}</li>`
    )
    .join('');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background: #ffffff;">
      <p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #375EAB;">
        Summit Navigator · ${safeCadence} Accountability Digest
      </p>
      <h2 style="margin: 0 0 12px; font-size: 20px; color: #111827;">
        ${safeChurch} — ${safeDept}
      </h2>
      <p style="margin: 0 0 16px; color: #4b5563; font-size: 14px; line-height: 1.6;">
        Hello ${safeName}, here is your post-summit 30/60/90-day ministry accountability snapshot.
      </p>

      <div style="display: table; width: 100%; border-collapse: separate; border-spacing: 8px 0; margin: 0 -8px 20px;">
        <div style="display: table-cell; width: 25%; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="font-size: 11px; color: #64748b;">Completion</div>
          <div style="font-size: 18px; font-weight: 700; color: #111827;">${completionPct}%</div>
        </div>
        <div style="display: table-cell; width: 25%; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="font-size: 11px; color: #64748b;">Open</div>
          <div style="font-size: 18px; font-weight: 700; color: #111827;">${input.openCount}</div>
        </div>
        <div style="display: table-cell; width: 25%; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="font-size: 11px; color: #64748b;">Due Soon</div>
          <div style="font-size: 18px; font-weight: 700; color: #375EAB;">${input.dueSoonCount}</div>
        </div>
        <div style="display: table-cell; width: 25%; padding: 12px; background: ${input.overdueCount > 0 ? '#fffbeb' : '#f8fafc'}; border: 1px solid ${input.overdueCount > 0 ? '#fcd34d' : '#e2e8f0'}; border-radius: 8px;">
          <div style="font-size: 11px; color: #64748b;">Overdue</div>
          <div style="font-size: 18px; font-weight: 700; color: ${input.overdueCount > 0 ? '#b45309' : '#111827'};">${input.overdueCount}</div>
        </div>
      </div>

      <h3 style="margin: 0 0 10px; font-size: 14px; font-weight: 700; color: #111827;">
        Priority Action Milestones
      </h3>
      <ol style="margin: 0 0 20px; padding-left: 20px;">
        ${htmlListItems}
      </ol>

      <div style="margin: 24px 0 16px;">
        <a href="${safeUrl}" style="display: inline-block; padding: 10px 18px; background: #375EAB; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 8px;">
          Open Action Plan &amp; Log Check-In
        </a>
      </div>

      <p style="margin: 16px 0 0; font-size: 12px; color: #6b7280; line-height: 1.5;">
        Cadence: ${safeCadence} on ${safeDay}s. Update your reminder schedule or pause emails anytime in your Summit Navigator Action Plan settings.
      </p>
    </div>
  `;

  return { subject, text, html };
}

export async function deliverDigestEmail(
  input: DigestEmailInput
): Promise<DigestDeliveryResult> {
  const { subject, text, html } = buildReminderDigestEmail(input);
  const sentAtIso = new Date().toISOString();

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
        to: [input.recipientEmail],
        subject,
        text,
        html,
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Resend delivery failed: ${detail}`);
    }
    return {
      deliveryMode: 'resend',
      status: 'sent',
      subject,
      text,
      html,
      sentAtIso,
    };
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
      to: input.recipientEmail,
      subject,
      text,
      html,
    });
    return {
      deliveryMode: 'smtp',
      status: 'sent',
      subject,
      text,
      html,
      sentAtIso,
    };
  }

  return {
    deliveryMode: 'preview',
    status: 'preview',
    subject,
    text,
    html,
    sentAtIso,
  };
}

export function getMailTransportStatus(): {
  configured: boolean;
  mode: DigestDeliveryMode;
} {
  if (process.env.RESEND_API_KEY) {
    return { configured: true, mode: 'resend' };
  }
  if (
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  ) {
    return { configured: true, mode: 'smtp' };
  }
  return { configured: false, mode: 'preview' };
}

export async function verifyFirebaseIdTokenViaRest(
  idToken: string
): Promise<VerifiedRequestIdentity | null> {
  const apiKey = firebaseConfig.apiKey;
  if (!apiKey || !idToken) return null;

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      users?: Array<{
        localId?: string;
        email?: string;
        emailVerified?: boolean;
      }>;
    };
    const account = data.users?.[0];
    if (!account?.localId || !account?.email) return null;

    const normalizedEmail = account.email.trim().toLowerCase();
    return {
      uid: account.localId,
      email: normalizedEmail,
      emailVerified: Boolean(account.emailVerified),
      isAdmin:
        Boolean(account.emailVerified) &&
        normalizedEmail === BOOTSTRAPPED_ADMIN_EMAIL,
      source: 'id_token',
    };
  } catch {
    return null;
  }
}

export async function verifyAuthenticatedCaller(
  req: NextRequest
): Promise<VerifiedRequestIdentity | null> {
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    const idIdentity = await verifyFirebaseIdTokenViaRest(token);
    if (idIdentity) return idIdentity;
  }

  const mfaCookie = req.cookies.get(MFA_SESSION_COOKIE)?.value;
  const session = verifySignedPayload<MfaSessionPayload>(mfaCookie);
  if (session && session.exp >= Date.now() && session.uid && session.email) {
    const normalizedEmail = session.email.trim().toLowerCase();
    return {
      uid: session.uid,
      email: normalizedEmail,
      emailVerified: true,
      isAdmin: normalizedEmail === BOOTSTRAPPED_ADMIN_EMAIL,
      source: 'mfa_cookie',
    };
  }

  return null;
}
