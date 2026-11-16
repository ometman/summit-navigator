import crypto from 'crypto';

const FALLBACK_SECRET = 'summit-navigator-otp-mfa-dev-secret-key';

function getSecret(): string {
  return process.env.OTP_SECRET || process.env.GEMINI_API_KEY || FALLBACK_SECRET;
}

export function signPayload(payload: object): string {
  const json = JSON.stringify(payload);
  const encoded = Buffer.from(json, 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySignedPayload<T>(token: string | undefined): T | null {
  if (!token || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSecret())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const decoded = Buffer.from(encoded, 'base64url').toString('utf8');
    return JSON.parse(decoded) as T;
  } catch {
    return null;
  }
}

export function hashOtpCode(uid: string, email: string, code: string): string {
  return crypto
    .createHmac('sha256', getSecret())
    .update(`${uid}:${email.toLowerCase()}:${code}`)
    .digest('hex');
}
