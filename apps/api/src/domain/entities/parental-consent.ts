export type ConsentStatus = 'PENDING' | 'APPROVED' | 'EXPIRED' | 'REVOKED';

export interface ParentalConsent {
  readonly id: string;
  readonly studentId: string;
  readonly status: ConsentStatus;
  readonly consentedAt: Date;
  readonly parentEmail: string;
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export function createParentalConsent(parameters: {
  id: string;
  studentId: string;
  parentEmail: string;
  expiresAt: Date;
  status?: ConsentStatus;
  ipAddress?: string | null;
  userAgent?: string | null;
}): ParentalConsent {
  const now = new Date();

  return {
    id: parameters.id,
    studentId: parameters.studentId,
    status: parameters.status ?? 'PENDING',
    consentedAt: now,
    parentEmail: parameters.parentEmail,
    ipAddress: parameters.ipAddress ?? null,
    userAgent: parameters.userAgent ?? null,
    expiresAt: parameters.expiresAt,
    createdAt: now,
    updatedAt: now,
  };
}

export function grantConsent(consent: ParentalConsent): ParentalConsent {
  return {
    ...consent,
    status: 'APPROVED',
    consentedAt: new Date(),
    updatedAt: new Date(),
  };
}

export function denyConsent(consent: ParentalConsent): ParentalConsent {
  return {
    ...consent,
    status: 'REVOKED',
    consentedAt: new Date(),
    updatedAt: new Date(),
  };
}

export function isConsentValid(consent: ParentalConsent): boolean {
  const now = new Date();
  return (
    consent.status === 'APPROVED' &&
    consent.expiresAt > now &&
    consent.expiresAt > consent.consentedAt
  );
}
