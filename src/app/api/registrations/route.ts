import { NextRequest, NextResponse } from 'next/server';
import {
  initialRegistrations,
  type RegistrationSource,
  type RegistrationStatus,
  type RegistrationTrack,
  type UserRegistration,
} from '@/lib/registrations';

const registrationStore: UserRegistration[] = [...initialRegistrations];

export async function GET() {
  const sorted = [...registrationStore].sort(
    (a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime()
  );
  return NextResponse.json({ registrations: sorted });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!fullName || !email) {
      return NextResponse.json(
        { error: 'Full name and email are required.' },
        { status: 400 }
      );
    }

    const existing = registrationStore.find((r) => r.email.toLowerCase() === email);
    if (existing) {
      return NextResponse.json({ registration: existing, duplicate: true }, { status: 200 });
    }

    const newRegistration: UserRegistration = {
      id: `reg-${Date.now()}`,
      fullName,
      email,
      organization:
        typeof body.organization === 'string' && body.organization.trim()
          ? body.organization.trim()
          : 'Summit Attendee',
      role:
        typeof body.role === 'string' && body.role.trim()
          ? body.role.trim()
          : 'Ministry Lead',
      track: (['Morning & Afternoon', 'Morning Track', 'Afternoon Track'].includes(body.track)
        ? body.track
        : 'Morning & Afternoon') as RegistrationTrack,
      source: (['Web Registration', 'Direct Invite', 'Ministry Partner'].includes(body.source)
        ? body.source
        : 'Web Registration') as RegistrationSource,
      status: (['Confirmed', 'Pending Verification', 'Checked In'].includes(body.status)
        ? body.status
        : 'Confirmed') as RegistrationStatus,
      registeredAt: new Date().toISOString(),
    };

    registrationStore.unshift(newRegistration);
    return NextResponse.json({ registration: newRegistration }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const status = body.status as RegistrationStatus;

    if (
      (!id && !email) ||
      !['Confirmed', 'Pending Verification', 'Checked In'].includes(status)
    ) {
      return NextResponse.json(
        { error: 'Valid registration ID or email and status are required.' },
        { status: 400 }
      );
    }

    let target = registrationStore.find(
      (r) =>
        (id && r.id === id) || (email && r.email.toLowerCase() === email)
    );

    if (!target && email) {
      target = {
        id: id || `reg-${Date.now()}`,
        fullName:
          typeof body.fullName === 'string' && body.fullName.trim()
            ? body.fullName.trim()
            : email.split('@')[0] || 'Summit Attendee',
        email,
        organization:
          typeof body.organization === 'string' && body.organization.trim()
            ? body.organization.trim()
            : 'Summit Attendee',
        role:
          typeof body.role === 'string' && body.role.trim()
            ? body.role.trim()
            : 'Ministry Lead',
        track: (['Morning & Afternoon', 'Morning Track', 'Afternoon Track'].includes(
          body.track
        )
          ? body.track
          : 'Morning & Afternoon') as RegistrationTrack,
        source: 'Web Registration',
        status,
        registeredAt: new Date().toISOString(),
      };
      registrationStore.unshift(target);
      return NextResponse.json({ registration: target });
    }

    if (!target) {
      return NextResponse.json(
        { error: 'Registration not found.' },
        { status: 404 }
      );
    }

    target.status = status;
    return NextResponse.json({ registration: target });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request payload.' },
      { status: 400 }
    );
  }
}
