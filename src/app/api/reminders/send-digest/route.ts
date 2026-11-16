import { NextRequest, NextResponse } from 'next/server';
import {
  deliverDigestEmail,
  verifyAuthenticatedCaller,
} from '@/lib/reminder-mailer';
import type { DispatchTriggerSource } from '@/lib/reminder-cron';

export async function POST(req: NextRequest) {
  try {
    const caller = await verifyAuthenticatedCaller(req);
    if (!caller || !caller.emailVerified) {
      return NextResponse.json(
        {
          error:
            'Verified Google Sign-In and Email OTP authentication required.',
        },
        { status: 401 }
      );
    }

    const body = (await req.json()) as Record<string, unknown>;
    const targetUid = typeof body.uid === 'string' ? body.uid.trim() : caller.uid;
    const requestedEmail =
      typeof body.recipientEmail === 'string'
        ? body.recipientEmail.trim().toLowerCase()
        : caller.email;

    if (!caller.isAdmin && targetUid !== caller.uid) {
      return NextResponse.json(
        { error: 'Only the Primary Organizer Admin can dispatch to other members.' },
        { status: 403 }
      );
    }

    const recipientEmail = caller.isAdmin ? requestedEmail : caller.email;
    if (!recipientEmail || !recipientEmail.includes('@')) {
      return NextResponse.json(
        { error: 'A valid recipient email address is required.' },
        { status: 400 }
      );
    }

    const recipientName =
      typeof body.recipientName === 'string' && body.recipientName.trim()
        ? body.recipientName.trim().slice(0, 120)
        : 'Ministry Lead';
    const churchName =
      typeof body.churchName === 'string' && body.churchName.trim()
        ? body.churchName.trim().slice(0, 150)
        : 'Local Ministry';
    const defaultDepartment =
      typeof body.defaultDepartment === 'string' && body.defaultDepartment.trim()
        ? body.defaultDepartment.trim().slice(0, 80)
        : 'Pastoral Leadership';
    const cadence =
      typeof body.cadence === 'string' &&
      ['weekly', 'biweekly', 'monthly'].includes(body.cadence)
        ? body.cadence
        : 'weekly';
    const reminderDay =
      typeof body.reminderDay === 'string' &&
      ['Monday', 'Wednesday', 'Friday', 'Saturday'].includes(body.reminderDay)
        ? body.reminderDay
        : 'Monday';

    const openCount = Math.max(0, Number(body.openCount) || 0);
    const completedCount = Math.max(0, Number(body.completedCount) || 0);
    const overdueCount = Math.max(0, Number(body.overdueCount) || 0);
    const dueSoonCount = Math.max(0, Number(body.dueSoonCount) || 0);
    const topOpenTitles = Array.isArray(body.topOpenTitles)
      ? body.topOpenTitles
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .slice(0, 5)
      : [];

    const triggerSource: DispatchTriggerSource =
      caller.isAdmin && body.triggerSource === 'admin_console'
        ? 'admin_console'
        : 'user_test';

    const origin =
      req.headers.get('origin') ||
      `${req.nextUrl.protocol}//${req.headers.get('host') || 'localhost:3000'}`;

    const result = await deliverDigestEmail({
      recipientEmail,
      recipientName,
      churchName,
      defaultDepartment,
      cadence,
      reminderDay,
      openCount,
      completedCount,
      overdueCount,
      dueSoonCount,
      topOpenTitles,
      appBaseUrl: origin,
      triggerSource,
    });

    return NextResponse.json({
      uid: targetUid,
      recipientEmail,
      triggerSource,
      ...result,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Unable to dispatch accountability digest email.',
      },
      { status: 500 }
    );
  }
}
