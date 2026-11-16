import { NextRequest, NextResponse } from 'next/server';
import { verifySignedPayload } from '@/lib/otp';
import { signAttendeePass } from '@/lib/pass-token';
import type { RegistrationTrack } from '@/lib/registrations';

const MFA_SESSION_COOKIE = 'summit_mfa_session';

interface MfaSessionPayload {
  uid: string;
  email: string;
  verifiedAt: string;
  exp: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const uid = typeof body.uid === 'string' ? body.uid.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const fullName =
      typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const organization =
      typeof body.organization === 'string' ? body.organization.trim() : '';
    const role = typeof body.role === 'string' ? body.role.trim() : '';
    const track =
      typeof body.track === 'string'
        ? (body.track as RegistrationTrack)
        : 'Morning & Afternoon';

    if (!uid || !email) {
      return NextResponse.json(
        { error: 'Authenticated UID and email are required.' },
        { status: 400 }
      );
    }

    const mfaCookie = req.cookies.get(MFA_SESSION_COOKIE)?.value;
    const mfaSession = verifySignedPayload<MfaSessionPayload>(mfaCookie);

    if (
      !mfaSession ||
      mfaSession.uid !== uid ||
      mfaSession.email.toLowerCase() !== email.toLowerCase() ||
      mfaSession.exp < Date.now()
    ) {
      return NextResponse.json(
        {
          error:
            'Active Email OTP MFA verification is required to issue a signed QR pass.',
        },
        { status: 401 }
      );
    }

    const signed = signAttendeePass({
      uid,
      email,
      fullName: fullName || email.split('@')[0] || 'Summit Attendee',
      organization: organization || 'Summit Attendee',
      role,
      track,
      mfaVerifiedAt: mfaSession.verifiedAt,
    });

    return NextResponse.json({
      token: signed.token,
      passCode: signed.passCode,
      signatureDigest: signed.signatureDigest,
      issuedAt: signed.payload.issuedAt,
      expiresAt: signed.payload.exp,
      payload: signed.payload,
    });
  } catch {
    return NextResponse.json(
      { error: 'Unable to sign digital attendee pass.' },
      { status: 500 }
    );
  }
}
