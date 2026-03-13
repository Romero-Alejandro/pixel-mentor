import type { ParentalConsent, ConsentStatus } from '@/domain/entities/parental-consent';

export interface ParentalConsentRepository {
  findById(id: string): Promise<ParentalConsent | null>;

  findByStudent(studentId: string): Promise<ParentalConsent | null>;

  create(
    consent: Omit<ParentalConsent, 'consentedAt' | 'createdAt' | 'updatedAt'>,
  ): Promise<ParentalConsent>;

  updateStatus(consentId: string, status: ConsentStatus): Promise<ParentalConsent>;
}

export class ParentalConsentNotFoundError extends Error {
  readonly code = 'CONSENT_NOT_FOUND' as const;
  readonly consentId: string;

  constructor(consentId: string) {
    super(`Parental consent with ID ${consentId} not found`);
    this.name = 'ParentalConsentNotFoundError';
    this.consentId = consentId;
  }
}

export class ConsentAlreadyGrantedError extends Error {
  readonly code = 'CONSENT_ALREADY_GRANTED' as const;
  readonly studentId: string;

  constructor(studentId: string) {
    super(`Consent for student ${studentId} is already granted`);
    this.name = 'ConsentAlreadyGrantedError';
    this.studentId = studentId;
  }
}
