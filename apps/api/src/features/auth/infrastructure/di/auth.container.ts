import type pino from 'pino';

import { RegisterUseCase } from '@/features/auth/application/use-cases/register.use-case.js';
import { LoginUseCase } from '@/features/auth/application/use-cases/login.use-case.js';
import { VerifyTokenUseCase } from '@/features/auth/application/use-cases/verify-token.use-case.js';
import { AdminUserService } from '@/features/auth/application/services/admin-user.service.js';
import { PrismaUserRepository } from '@/features/auth/infrastructure/persistence/user.repository.js';
import { PrismaApiKeyRepository } from '@/features/auth/infrastructure/persistence/api-key.repository.js';
import { PrismaParentalConsentRepository } from '@/features/auth/infrastructure/persistence/parental-consent.repository.js';
import { Argon2HashingService } from '@/features/auth/infrastructure/hashing.adapter.js';
import { JwtTokenService } from '@/features/auth/infrastructure/token.adapter.js';

export interface AuthContainer {
  registerUseCase: RegisterUseCase;
  loginUseCase: LoginUseCase;
  verifyTokenUseCase: VerifyTokenUseCase;
  adminUserService: AdminUserService;
  userRepository: PrismaUserRepository;
  apiKeyRepository: PrismaApiKeyRepository;
  parentalConsentRepository: PrismaParentalConsentRepository;
  hashingService: Argon2HashingService;
  tokenService: JwtTokenService;
}

export function buildAuthContainer(_logger: pino.Logger): AuthContainer {
  const userRepository = new PrismaUserRepository();
  const apiKeyRepository = new PrismaApiKeyRepository();
  const parentalConsentRepository = new PrismaParentalConsentRepository();
  const hashingService = new Argon2HashingService();
  const tokenService = new JwtTokenService();

  return {
    registerUseCase: new RegisterUseCase(userRepository, hashingService, tokenService),
    loginUseCase: new LoginUseCase(userRepository, hashingService, tokenService),
    verifyTokenUseCase: new VerifyTokenUseCase(userRepository, tokenService),
    adminUserService: new AdminUserService(userRepository, hashingService),
    userRepository,
    apiKeyRepository,
    parentalConsentRepository,
    hashingService,
    tokenService,
  };
}
