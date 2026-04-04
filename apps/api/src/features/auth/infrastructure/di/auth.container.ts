import type pino from 'pino';

import { RegisterUseCase } from '@/features/auth/application/use-cases/register.use-case.js';
import { LoginUseCase } from '@/features/auth/application/use-cases/login.use-case.js';
import { VerifyTokenUseCase } from '@/features/auth/application/use-cases/verify-token.use-case.js';
import { AdminUserService } from '@/features/auth/application/services/admin-user.service.js';
import { RefreshTokenUseCase } from '@/features/auth/application/use-cases/refresh-token.use-case.js';
import { PrismaUserRepository } from '@/features/auth/infrastructure/persistence/user.repository.js';
import { PrismaApiKeyRepository } from '@/features/auth/infrastructure/persistence/api-key.repository.js';
import { PrismaParentalConsentRepository } from '@/features/auth/infrastructure/persistence/parental-consent.repository.js';
import { PrismaRefreshTokenRepository } from '@/features/auth/infrastructure/persistence/refresh-token.repository.js';
import { Argon2HashingService } from '@/features/auth/infrastructure/hashing.adapter.js';
import {
  JwtAccessTokenService,
  JwtRefreshTokenService,
} from '@/features/auth/infrastructure/token.adapter.js';

export interface AuthContainer {
  registerUseCase: RegisterUseCase;
  loginUseCase: LoginUseCase;
  verifyTokenUseCase: VerifyTokenUseCase;
  refreshTokenUseCase: RefreshTokenUseCase;
  adminUserService: AdminUserService;
  userRepository: PrismaUserRepository;
  apiKeyRepository: PrismaApiKeyRepository;
  parentalConsentRepository: PrismaParentalConsentRepository;
  refreshTokenRepository: PrismaRefreshTokenRepository;
  hashingService: Argon2HashingService;
  accessTokenService: JwtAccessTokenService;
  refreshTokenService: JwtRefreshTokenService;
}

export function buildAuthContainer(_logger: pino.Logger): AuthContainer {
  const userRepository = new PrismaUserRepository();
  const apiKeyRepository = new PrismaApiKeyRepository();
  const parentalConsentRepository = new PrismaParentalConsentRepository();
  const refreshTokenRepository = new PrismaRefreshTokenRepository();
  const hashingService = new Argon2HashingService();
  const accessTokenService = new JwtAccessTokenService();
  const refreshTokenService = new JwtRefreshTokenService();

  return {
    registerUseCase: new RegisterUseCase(userRepository, hashingService, accessTokenService),
    loginUseCase: new LoginUseCase(userRepository, hashingService, accessTokenService),
    verifyTokenUseCase: new VerifyTokenUseCase(userRepository, accessTokenService),
    refreshTokenUseCase: new RefreshTokenUseCase(
      userRepository,
      refreshTokenRepository,
      accessTokenService,
      refreshTokenService,
    ),
    adminUserService: new AdminUserService(userRepository, hashingService),
    userRepository,
    apiKeyRepository,
    parentalConsentRepository,
    refreshTokenRepository,
    hashingService,
    accessTokenService,
    refreshTokenService,
  };
}
