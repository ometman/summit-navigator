import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { NextRequest, NextResponse } from 'next/server';
import { hashOtpCode, signPayload, verifySignedPayload } from '@/lib/otp';

const CHALLENGE_COOKIE = 'summit_otp_challenge';
const MFA_SESSION_COOKIE = 'summit_mfa_session';
const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const MFA_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;

interface OtpChallengePayload {
  uid: string;
  email: string;
  codeHash: string;
  exp: number;
  issuedAt: number;
  attemptsLeft: number;
}

interface MfaSessionPayload {
  uid: string;
  email: string;
  verifiedAt: string;
  exp: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getCookieOptions(req: NextRequest, maxAgeSeconds: number) {
  const isHttps =
    req.headers.get('x-forwarded-proto') === 'https' ||
    req.nextUrl.protocol === 'https:';
  return {
    httpOnly: true,
    sameSite: isHttps ? ('none' as const) : ('lax' as const),
    secure: isHttps,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

async function deliverOtpEmail(
  email: string,
  displayName: string,
  code: string
): Promise<'resend' | 'smtp' | 'preview'> {
  const safeName = escapeHtml(displayName || 'Attendee');
  const subject = 'Your Summit Navigator Verification Code';
  const text = `Hello ${displayName || 'Attendee'},\n\nYour Summit Navigator one-time verification code is: ${code}\n\nThis code expires in 5 minutes. If you did not request this login, please ignore this email.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
      <h2 style="margin: 0 0 12px; color: #1f2937;">Summit Navigator Verification</h2>
      <p style="margin: 0 0 16px; color: #4b5563; line-height: 1.5;">
        Hello ${safeName}, enter the 6-digit verification code below to complete your sign-in:
      </p>
      <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; text-align: center; padding: 16px; background: #f3f4f6; border-radius: 8px; color: #111827; font-family: monospace;">
        ${code}
      </div>
      <p style="margin: 16px 0 0; font-size: 13px; color: #6b7280;">
        This code expires in 5 minutes.
      </p>
    </div>
  `;

  if (process.env.RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.SMTP_FROM || 'Summit Navigator <onboarding@resend.dev>',
        to: [email],
        subject,
        text,
        html,
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Resend delivery failed: ${detail}`);
    }
    return 'resend';
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
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
      to: email,
      subject,
      text,
      html,
    });
    return 'smtp';
  }

  return 'preview';
}

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get('uid');
  if (!uid) {
    return NextResponse.json({ verified: false });
  }

  const token = req.cookies.get(MFA_SESSION_COOKIE)?.value;
  const session = verifySignedPayload<MfaSessionPayload>(token);

  if (!session || session.uid !== uid || session.exp < Date.now()) {
    return NextResponse.json({ verified: false });
  }

  return NextResponse.json({
    verified: true,
    verifiedAt: session.verifiedAt,
    email: session.email,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action;

    if (action === 'send') {
      const uid = typeof body.uid === 'string' ? body.uid.trim() : '';
      const email =
        typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const displayName =
        typeof body.displayName === 'string' ? body.displayName.trim() : '';

      if (!uid || !email) {
        return NextResponse.json(
          { error: 'Authenticated user UID and email are required.' },
          { status: 400 }
        );
      }

      const existingChallenge = verifySignedPayload<OtpChallengePayload>(
        req.cookies.get(CHALLENGE_COOKIE)?.value
      );
      if (
        existingChallenge &&
        existingChallenge.uid === uid &&
        existingChallenge.email === email &&
        Date.now() - existingChallenge.issuedAt < RESEND_COOLDOWN_MS
      ) {
        const retryAfterSeconds = Math.ceil(
          (RESEND_COOLDOWN_MS - (Date.now() - existingChallenge.issuedAt)) / 1000
        );
        return NextResponse.json(
          {
            error: `Please wait ${retryAfterSeconds}s before requesting a new code.`,
            retryAfterSeconds,
          },
          { status: 429 }
        );
      }

      const code = crypto.randomInt(100000, 1000000).toString();
      const now = Date.now();
      const challenge: OtpChallengePayload = {
        uid,
        email,
        codeHash: hashOtpCode(uid, email, code),
        exp: now + OTP_TTL_MS,
        issuedAt: now,
        attemptsLeft: MAX_ATTEMPTS,
      };

      const deliveryMode = await deliverOtpEmail(email, displayName, code);
      const responsePayload: Record<string, unknown> = {
        sent: true,
        deliveryMode,
        expiresInSeconds: OTP_TTL_MS / 1000,
      };
      if (deliveryMode === 'preview') {
        responsePayload.previewOtp = code;
      }

      const res = NextResponse.json(responsePayload);
      res.cookies.set(
        CHALLENGE_COOKIE,
        signPayload(challenge),
        getCookieOptions(req, OTP_TTL_MS / 1000)
      );
      return res;
    }

    if (action === 'verify') {
      const uid = typeof body.uid === 'string' ? body.uid.trim() : '';
      const email =
        typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const code =
        typeof body.code === 'string' ? body.code.replace(/\s+/g, '') : '';

      if (!uid || !email || !/^\d{6}$/.test(code)) {
        return NextResponse.json(
          { error: 'Enter a valid 6-digit verification code.' },
          { status: 400 }
        );
      }

      const challenge = verifySignedPayload<OtpChallengePayload>(
        req.cookies.get(CHALLENGE_COOKIE)?.value
      );

      if (!challenge || challenge.uid !== uid || challenge.email !== email) {
        return NextResponse.json(
          { error: 'No active verification challenge found. Please request a new code.' },
          { status: 400 }
        );
      }

      if (challenge.exp < Date.now()) {
        const expiredRes = NextResponse.json(
          { error: 'Verification code expired. Please request a new code.' },
          { status: 400 }
        );
        expiredRes.cookies.delete(CHALLENGE_COOKIE);
        return expiredRes;
      }

      if (challenge.attemptsLeft <= 0) {
        const lockedRes = NextResponse.json(
          { error: 'Too many failed attempts. Please request a new verification code.' },
          { status: 429 }
        );
        lockedRes.cookies.delete(CHALLENGE_COOKIE);
        return lockedRes;
      }

      const incomingHash = hashOtpCode(uid, email, code);
      const valid = crypto.timingSafeEqual(
        Buffer.from(incomingHash),
        Buffer.from(challenge.codeHash)
      );

      if (!valid) {
        const remaining = challenge.attemptsLeft - 1;
        const updatedChallenge: OtpChallengePayload = {
          ...challenge,
          attemptsLeft: remaining,
        };
        const badRes = NextResponse.json(
          {
            error:
              remaining > 0
                ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
                : 'Too many failed attempts. Please request a new verification code.',
          },
          { status: 400 }
        );
        if (remaining > 0) {
          badRes.cookies.set(
            CHALLENGE_COOKIE,
            signPayload(updatedChallenge),
            getCookieOptions(
              req,
              Math.max(1, Math.floor((challenge.exp - Date.now()) / 1000))
            )
          );
        } else {
          badRes.cookies.delete(CHALLENGE_COOKIE);
        }
        return badRes;
      }

      const verifiedAt = new Date().toISOString();
      const sessionPayload: MfaSessionPayload = {
        uid,
        email,
        verifiedAt,
        exp: Date.now() + MFA_SESSION_TTL_MS,
      };

      const okRes = NextResponse.json({
        verified: true,
        verifiedAt,
      });
      okRes.cookies.delete(CHALLENGE_COOKIE);
      okRes.cookies.set(
        MFA_SESSION_COOKIE,
        signPayload(sessionPayload),
        getCookieOptions(req, MFA_SESSION_TTL_MS / 1000)
      );
      return okRes;
    }

    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Unable to process verification request.',
      },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const res = NextResponse.json({ cleared: true });
  res.cookies.delete(CHALLENGE_COOKIE);
  res.cookies.delete(MFA_SESSION_COOKIE);
  return res;
}
