import { NextRequest, NextResponse } from 'next/server';
import { verifyAttendeePassToken } from '@/lib/pass-token';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const qrPayload =
      typeof body.qrPayload === 'string' ? body.qrPayload.trim() : '';

    const result = verifyAttendeePassToken(qrPayload);
    if (!result.valid || !result.payload) {
      return NextResponse.json(
        {
          valid: false,
          error: result.error || 'Invalid QR pass signature.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      payload: result.payload,
      signatureDigest: result.signatureDigest,
    });
  } catch {
    return NextResponse.json(
      { valid: false, error: 'Unable to verify QR pass payload.' },
      { status: 400 }
    );
  }
}
