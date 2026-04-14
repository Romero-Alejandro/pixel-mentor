import { prisma } from '@/database/client.js';
import { handlePrismaError } from '@/database/error-handler.js';
import type {
  ConsentStatus,
  ParentalConsent,
} from '@/features/auth/domain/entities/parental-consent.entity.js';
import type { IParentalConsentRepository } from '@/features/auth/domain/ports/parental-consent.repository.port.js';

type PrismaConsent = NonNullable<Awaited<ReturnType<typeof prisma.parentalConsent.findUnique>>>;

const mapConsentToDomain = (entity: PrismaConsent): ParentalConsent => ({
  id: entity.id,
  studentId: entity.studentId,
  status: entity.status as ConsentStatus,
  consentedAt: entity.consentedAt as Date,
  parentEmail: entity.parentEmail,
  ipAddress: entity.ipAddress as string,
  userAgent: entity.userAgent as string,
  expiresAt: entity.expiresAt as Date,
  createdAt: entity.createdAt,
  updatedAt: entity.updatedAt,
});

export class PrismaParentalConsentRepository implements IParentalConsentRepository {
  async findById(id: string): Promise<ParentalConsent | null> {
    const consent = await prisma.parentalConsent.findUnique({ where: { id } });
    return consent ? mapConsentToDomain(consent) : null;
  }

  async findByStudent(studentId: string): Promise<ParentalConsent | null> {
    const consent = await prisma.parentalConsent.findUnique({ where: { studentId } });
    return consent ? mapConsentToDomain(consent) : null;
  }

  async create(
    consent: Omit<ParentalConsent, 'consentedAt' | 'createdAt' | 'updatedAt'>,
  ): Promise<ParentalConsent> {
    const created = await prisma.parentalConsent.create({
      data: {
        id: consent.id,
        studentId: consent.studentId,
        parentEmail: consent.parentEmail,
        status: consent.status,
        expiresAt: consent.expiresAt,
        consentedAt: new Date(),
        ipAddress: consent.ipAddress ?? null,
        userAgent: consent.userAgent ?? null,
      },
    });
    return mapConsentToDomain(created);
  }

  async updateStatus(consentId: string, status: ConsentStatus): Promise<ParentalConsent> {
    try {
      const updated = await prisma.parentalConsent.update({
        where: { id: consentId },
        data: { status },
      });
      return mapConsentToDomain(updated);
    } catch (error) {
      handlePrismaError(error, Error, consentId);
    }
  }
}
