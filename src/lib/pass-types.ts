import type { RegistrationTrack } from '@/lib/registrations';

export const PASS_TOKEN_PREFIX = 'SMNP1:';
export const PASS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const VALID_PASS_ROLES = [
  'Senior Pastor',
  'Ministry Lead',
  'Operations & Strategy',
  'Youth & Outreach',
  'Volunteer Coordinator',
] as const;

export const VALID_PASS_TRACKS: RegistrationTrack[] = [
  'Morning & Afternoon',
  'Morning Track',
  'Afternoon Track',
];

export type PassStatus = 'Confirmed' | 'Checked In';
export type PassCheckInMethod = 'none' | 'self_checkin' | 'organizer_scan';

export interface SignedPassPayload {
  v: 1;
  type: 'summit_pass';
  uid: string;
  passCode: string;
  email: string;
  fullName: string;
  organization: string;
  role: string;
  track: RegistrationTrack;
  mfaVerifiedAt: string;
  issuedAt: number;
  exp: number;
}

export interface SignedPassResponse {
  token: string;
  passCode: string;
  signatureDigest: string;
  issuedAt: number;
  expiresAt: number;
  payload: SignedPassPayload;
}

export interface VerifyPassResponse {
  valid: boolean;
  payload?: SignedPassPayload;
  signatureDigest?: string;
  error?: string;
}
