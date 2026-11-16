import crypto from 'crypto';
import {
  PASS_TOKEN_PREFIX,
  PASS_TTL_MS,
  VALID_PASS_ROLES,
  VALID_PASS_TRACKS,
  type SignedPassPayload,
} from '@/lib/pass-types';
import type { RegistrationTrack } from '@/lib/registrations';

const FALLBACK_SECRET = 'summit-navigator-otp-mfa-dev-secret-key';

function getPassSigningSecret(): string {
  const base =
    process.env.PASS_SECRET ||
    process.env.OTP_SECRET ||
    process.env.GEMINI_API_KEY ||
    FALLBACK_SECRET;
  return `${base}:summit-qr-pass-v1`;
}

export function derivePassCode(uid: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(`passcode:${uid}`)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();
  return `SMN-${hash}`;
}

export function computeSignatureDigest(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 16);
}

export function signAttendeePass(input: {
  uid: string;
  email: string;
  fullName: string;
  organization: string;
  role: string;
  track: RegistrationTrack;
  mfaVerifiedAt: string;
}): {
  token: string;
  passCode: string;
  signatureDigest: string;
  payload: SignedPassPayload;
} {
  const now = Date.now();
  const passCode = derivePassCode(input.uid);
  const cleanName = input.fullName.trim().slice(0, 120);
  const cleanOrg = (input.organization.trim() || 'Summit Attendee').slice(
    0,
    150
  );
  const role = (VALID_PASS_ROLES as readonly string[]).includes(input.role)
    ? input.role
    : 'Ministry Lead';
  const track = VALID_PASS_TRACKS.includes(input.track)
    ? input.track
    : 'Morning & Afternoon';

  const payload: SignedPassPayload = {
    v: 1,
    type: 'summit_pass',
    uid: input.uid,
    passCode,
    email: input.email.trim(),
    fullName: cleanName.length >= 2 ? cleanName : 'Summit Attendee',
    organization: cleanOrg,
    role,
    track,
    mfaVerifiedAt: input.mfaVerifiedAt,
    issuedAt: now,
    exp: now + PASS_TTL_MS,
  };

  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url'
  );
  const sig = crypto
    .createHmac('sha256', getPassSigningSecret())
    .update(encoded)
    .digest('base64url');
  const token = `${PASS_TOKEN_PREFIX}${encoded}.${sig}`;
  const signatureDigest = computeSignatureDigest(token);

  return { token, passCode, signatureDigest, payload };
}

export function extractRawPassToken(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (!trimmed) return '';

  // Support deep-link QR URLs containing ?token=...
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      const queryToken = url.searchParams.get('token');
      if (queryToken) {
        return queryToken.trim();
      }
    } catch {
      // Fallback to raw handling
    }
  }

  return trimmed;
}

export function verifyAttendeePassToken(rawInput: string): {
  valid: boolean;
  payload?: SignedPassPayload;
  signatureDigest?: string;
  error?: string;
} {
  const candidate = extractRawPassToken(rawInput);
  if (!candidate) {
    return { valid: false, error: 'QR pass payload is empty.' };
  }

  const body = candidate.startsWith(PASS_TOKEN_PREFIX)
    ? candidate.slice(PASS_TOKEN_PREFIX.length)
    : candidate;

  const dotIdx = body.indexOf('.');
  if (dotIdx <= 0 || dotIdx === body.length - 1) {
    return { valid: false, error: 'Malformed QR pass token format.' };
  }

  const encoded = body.slice(0, dotIdx);
  const sig = body.slice(dotIdx + 1);

  const expectedSig = crypto
    .createHmac('sha256', getPassSigningSecret())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return { valid: false, error: 'Invalid QR pass signature.' };
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as SignedPassPayload;

    if (
      !parsed ||
      parsed.v !== 1 ||
      parsed.type !== 'summit_pass' ||
      typeof parsed.uid !== 'string' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.passCode !== 'string'
    ) {
      return { valid: false, error: 'Unrecognized QR pass payload.' };
    }

    if (typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
      return { valid: false, error: 'QR pass token has expired. Refresh badge.' };
    }

    const canonicalToken = `${PASS_TOKEN_PREFIX}${encoded}.${sig}`;
    return {
      valid: true,
      payload: parsed,
      signatureDigest: computeSignatureDigest(canonicalToken),
    };
  } catch {
    return { valid: false, error: 'Unable to decode QR pass payload.' };
  }
}
