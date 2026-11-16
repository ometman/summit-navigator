import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase-admin';
import {
  computeNextDueAtIso,
  evaluateSubscriptionDueStatus,
  type ReminderSubscriptionSnapshot,
} from '@/lib/reminder-cron';
import {
  deliverDigestEmail,
  getMailTransportStatus,
  verifyAuthenticatedCaller,
} from '@/lib/reminder-mailer';
import type {
  ReminderCadence,
  ReminderChannel,
  ReminderDay,
} from '@/lib/action-plan-templates';

function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function authorizeCronRequest(req: NextRequest): Promise<{
  authorized: boolean;
  actor: 'cron_secret' | 'admin_user' | 'unauthorized';
}> {
  const configuredSecret = process.env.CRON_SECRET?.trim() || '';
  if (configuredSecret) {
    const authHeader = req.headers.get('authorization') || '';
    const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : '';
    const headerSecret = req.headers.get('x-cron-secret')?.trim() || '';
    const candidate = bearerToken || headerSecret;
    if (candidate && timingSafeCompare(candidate, configuredSecret)) {
      return { authorized: true, actor: 'cron_secret' };
    }
  }

  const caller = await verifyAuthenticatedCaller(req);
  if (caller && caller.isAdmin) {
    return { authorized: true, actor: 'admin_user' };
  }

  return { authorized: false, actor: 'unauthorized' };
}

function mapDocToSnapshot(
  docId: string,
  data: Record<string, unknown>
): ReminderSubscriptionSnapshot {
  const rawCadence = String(data.cadence || 'weekly');
  const cadence: ReminderCadence =
    rawCadence === 'biweekly' || rawCadence === 'monthly'
      ? rawCadence
      : 'weekly';
  const rawDay = String(data.reminderDay || 'Monday');
  const reminderDay: ReminderDay =
    rawDay === 'Wednesday' || rawDay === 'Friday' || rawDay === 'Saturday'
      ? rawDay
      : 'Monday';
  const rawChannel = String(data.preferredChannel || 'both');
  const preferredChannel: ReminderChannel =
    rawChannel === 'email_digest' || rawChannel === 'dashboard_banner'
      ? rawChannel
      : 'both';

  const topOpenTitles = Array.isArray(data.topOpenTitles)
    ? data.topOpenTitles
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .slice(0, 5)
    : [];

  return {
    uid: String(data.uid || docId),
    email: String(data.email || ''),
    displayName: String(data.displayName || 'Ministry Lead'),
    enabled: data.enabled !== false,
    cadence,
    reminderDay,
    preferredChannel,
    churchName: String(data.churchName || 'Local Ministry'),
    defaultDepartment: String(data.defaultDepartment || 'Pastoral Leadership'),
    summitDateIso: String(data.summitDateIso || '2026-11-15'),
    lastCheckInIso: String(data.lastCheckInIso || ''),
    lastEmailedAtIso: String(data.lastEmailedAtIso || ''),
    nextDueAtIso: String(data.nextDueAtIso || '2026-11-16'),
    openCount: Math.max(0, Number(data.openCount) || 0),
    completedCount: Math.max(0, Number(data.completedCount) || 0),
    overdueCount: Math.max(0, Number(data.overdueCount) || 0),
    dueSoonCount: Math.max(0, Number(data.dueSoonCount) || 0),
    topOpenTitles,
  };
}

async function runScheduledReminderBatch(
  req: NextRequest,
  options: { force?: boolean; dryRun?: boolean; ignoreDayMatch?: boolean }
) {
  const mailStatus = getMailTransportStatus();
  const { db, credentialSource, error: adminError } = getAdminFirestore();

  if (!db) {
    return NextResponse.json(
      {
        ok: false,
        needsCredentials: true,
        credentialSource,
        mailTransport: mailStatus.mode,
        error:
          adminError ||
          'Firebase Admin credentials unavailable in this runtime. Set FIREBASE_SERVICE_ACCOUNT_JSON or deploy /functions scheduled Cloud Function.',
      },
      { status: 503 }
    );
  }

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const in14DaysIso = new Date(now.getTime() + 14 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  let subSnap;
  try {
    subSnap = await db
      .collection('reminderSubscriptions')
      .where('enabled', '==', true)
      .get();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unable to query Firestore.';
    return NextResponse.json(
      {
        ok: false,
        needsCredentials:
          message.includes('Could not load the default credentials') ||
          message.includes('PERMISSION_DENIED') ||
          message.includes('UNAUTHENTICATED'),
        credentialSource,
        mailTransport: mailStatus.mode,
        error: message,
      },
      { status: 503 }
    );
  }

  const results: Array<{
    uid: string;
    email: string;
    churchName: string;
    status: string;
    deliveryMode?: string;
    reason: string;
  }> = [];

  let sentCount = 0;
  let previewCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    `${req.nextUrl.protocol}//${req.headers.get('host') || 'localhost:3000'}`;

  for (const docSnap of subSnap.docs) {
    const sub = mapDocToSnapshot(
      docSnap.id,
      docSnap.data() as Record<string, unknown>
    );

    // Recompute live counts directly from the user's subcollection when offline
    try {
      const itemsSnap = await db
        .collection('users')
        .doc(sub.uid)
        .collection('actionItems')
        .get();

      if (!itemsSnap.empty) {
        let openCount = 0;
        let completedCount = 0;
        let overdueCount = 0;
        let dueSoonCount = 0;
        const openTitles: string[] = [];

        itemsSnap.docs.forEach((itemDoc) => {
          const d = itemDoc.data() as Record<string, unknown>;
          const status = String(d.status || 'pending');
          const due = String(d.dueDateIso || todayIso);
          if (status === 'completed') {
            completedCount += 1;
          } else {
            openCount += 1;
            if (due < todayIso) overdueCount += 1;
            else if (due <= in14DaysIso) dueSoonCount += 1;
            if (openTitles.length < 5) {
              const horizon = Number(d.horizonDays) || 30;
              const dept = String(d.department || sub.defaultDepartment);
              const title = String(d.title || 'Action item');
              openTitles.push(
                `${horizon}-Day · ${dept}: ${title} (Due ${due})`.slice(0, 240)
              );
            }
          }
        });

        sub.openCount = openCount;
        sub.completedCount = completedCount;
        sub.overdueCount = overdueCount;
        sub.dueSoonCount = dueSoonCount;
        if (openTitles.length > 0) sub.topOpenTitles = openTitles;
      }
    } catch {
      // Keep synced snapshot counts if subcollection lookup is unavailable
    }

    const evaluation = evaluateSubscriptionDueStatus(sub, now, {
      force: options.force,
      ignoreDayMatch: options.ignoreDayMatch,
    });

    if (!evaluation.isDue || !sub.email) {
      skippedCount += 1;
      results.push({
        uid: sub.uid,
        email: sub.email,
        churchName: sub.churchName,
        status: 'skipped',
        reason: !sub.email ? 'Missing verified email address' : evaluation.reason,
      });
      continue;
    }

    if (options.dryRun) {
      results.push({
        uid: sub.uid,
        email: sub.email,
        churchName: sub.churchName,
        status: 'would_send',
        reason: evaluation.reason,
      });
      continue;
    }

    const logId = `cron-${sub.uid.slice(0, 20)}-${Date.now()}`;
    try {
      const delivery = await deliverDigestEmail({
        recipientEmail: sub.email,
        recipientName: sub.displayName,
        churchName: sub.churchName,
        defaultDepartment: sub.defaultDepartment,
        cadence: sub.cadence,
        reminderDay: sub.reminderDay,
        openCount: sub.openCount,
        completedCount: sub.completedCount,
        overdueCount: sub.overdueCount,
        dueSoonCount: sub.dueSoonCount,
        topOpenTitles: sub.topOpenTitles,
        appBaseUrl: origin,
        triggerSource: 'cron_scheduler',
      });

      const nextDueAtIso = computeNextDueAtIso(sub.cadence, sub.reminderDay, now);
      await db.collection('reminderSubscriptions').doc(sub.uid).update({
        lastEmailedAtIso: delivery.sentAtIso,
        nextDueAtIso,
        openCount: sub.openCount,
        completedCount: sub.completedCount,
        overdueCount: sub.overdueCount,
        dueSoonCount: sub.dueSoonCount,
        topOpenTitles: sub.topOpenTitles,
        updatedAt: FieldValue.serverTimestamp(),
      });

      await db
        .collection('reminderDispatchLogs')
        .doc(logId)
        .set({
          id: logId,
          uid: sub.uid,
          recipientEmail: sub.email.slice(0, 254),
          recipientName: sub.displayName.slice(0, 120),
          churchName: sub.churchName.slice(0, 150),
          cadence: sub.cadence,
          triggerSource: 'cron_scheduler',
          deliveryMode: delivery.deliveryMode,
          status: delivery.status,
          openCount: sub.openCount,
          overdueCount: sub.overdueCount,
          dueSoonCount: sub.dueSoonCount,
          subject: delivery.subject.slice(0, 200),
          sentAtIso: delivery.sentAtIso,
          errorMessage: '',
          createdAt: FieldValue.serverTimestamp(),
        });

      if (delivery.status === 'sent') sentCount += 1;
      else previewCount += 1;

      results.push({
        uid: sub.uid,
        email: sub.email,
        churchName: sub.churchName,
        status: delivery.status,
        deliveryMode: delivery.deliveryMode,
        reason: evaluation.reason,
      });
    } catch (err) {
      failedCount += 1;
      const errMsg = (
        err instanceof Error ? err.message : 'Dispatch error'
      ).slice(0, 300);

      await db
        .collection('reminderDispatchLogs')
        .doc(logId)
        .set({
          id: logId,
          uid: sub.uid,
          recipientEmail: sub.email.slice(0, 254),
          recipientName: sub.displayName.slice(0, 120),
          churchName: sub.churchName.slice(0, 150),
          cadence: sub.cadence,
          triggerSource: 'cron_scheduler',
          deliveryMode: mailStatus.mode,
          status: 'failed',
          openCount: sub.openCount,
          overdueCount: sub.overdueCount,
          dueSoonCount: sub.dueSoonCount,
          subject: `Summit Navigator Accountability Digest · ${sub.churchName}`.slice(
            0,
            200
          ),
          sentAtIso: now.toISOString(),
          errorMessage: errMsg,
          createdAt: FieldValue.serverTimestamp(),
        });

      results.push({
        uid: sub.uid,
        email: sub.email,
        churchName: sub.churchName,
        status: 'failed',
        reason: errMsg,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    checkedSubscribers: subSnap.size,
    sentCount,
    previewCount,
    skippedCount,
    failedCount,
    mailTransport: mailStatus.mode,
    credentialSource,
    dryRun: Boolean(options.dryRun),
    executedAtIso: now.toISOString(),
    results,
  });
}

export async function GET(req: NextRequest) {
  const authResult = await authorizeCronRequest(req);

  // Public lightweight health/capabilities check if ?status=1 and no action requested
  if (req.nextUrl.searchParams.get('status') === '1' && !authResult.authorized) {
    const mail = getMailTransportStatus();
    return NextResponse.json({
      endpoint: '/api/reminders/cron',
      cronSecretConfigured: Boolean(process.env.CRON_SECRET),
      serviceAccountConfigured: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
      mailTransportConfigured: mail.configured,
      mailTransportMode: mail.mode,
    });
  }

  if (!authResult.authorized) {
    return NextResponse.json(
      {
        error:
          'Unauthorized cron request. Provide Authorization: Bearer <CRON_SECRET> or Super Admin credentials.',
      },
      { status: 401 }
    );
  }

  if (req.nextUrl.searchParams.get('status') === '1') {
    const mail = getMailTransportStatus();
    const adminStatus = getAdminFirestore();
    return NextResponse.json({
      endpoint: '/api/reminders/cron',
      actor: authResult.actor,
      cronSecretConfigured: Boolean(process.env.CRON_SECRET),
      serviceAccountConfigured: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
      adminCredentialSource: adminStatus.credentialSource,
      mailTransportConfigured: mail.configured,
      mailTransportMode: mail.mode,
    });
  }

  const force = req.nextUrl.searchParams.get('force') === 'true';
  const dryRun = req.nextUrl.searchParams.get('dryRun') === 'true';
  const ignoreDayMatch =
    req.nextUrl.searchParams.get('ignoreDayMatch') === 'true';

  return runScheduledReminderBatch(req, { force, dryRun, ignoreDayMatch });
}

export async function POST(req: NextRequest) {
  const authResult = await authorizeCronRequest(req);
  if (!authResult.authorized) {
    return NextResponse.json(
      {
        error:
          'Unauthorized cron trigger. Provide Authorization: Bearer <CRON_SECRET> or Super Admin credentials.',
      },
      { status: 401 }
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  return runScheduledReminderBatch(req, {
    force: body.force === true,
    dryRun: body.dryRun === true,
    ignoreDayMatch: body.ignoreDayMatch === true,
  });
}
