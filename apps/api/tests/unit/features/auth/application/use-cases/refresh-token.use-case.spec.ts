import type { IUserRepository } from '@/features/auth/domain/ports/user.repository.port.js';
import type { IRefreshTokenRepository } from '@/features/auth/domain/ports/refresh-token.repository.port.js';
import type { IHashingService } from '@/features/auth/domain/ports/hashing.service.port.js';
import type { ITokenService } from '@/features/auth/domain/ports/token.service.port.js';
import { RefreshTokenUseCase } from '@/features/auth/application/use-cases/refresh-token.use-case.js';
import type { RefreshToken } from '@/features/auth/domain/entities/refresh-token.entity.js';

describe('RefreshTokenUseCase', () => {
  let useCase: RefreshTokenUseCase;
  let mockUserRepository: jest.Mocked<IUserRepository>;
  let mockRefreshTokenRepo: jest.Mocked<IRefreshTokenRepository>;
  let mockHashingService: jest.Mocked<IHashingService>;
  let mockAccessTokenService: jest.Mocked<ITokenService>;
  let mockRefreshTokenService: jest.Mocked<ITokenService>;

  beforeEach(() => {
    mockUserRepository = {
      findById: jest.fn(),
      findByIdentifierWithPassword: jest.fn(),
    } as unknown as jest.Mocked<IUserRepository>;

    mockRefreshTokenRepo = {
      create: jest.fn(),
      findByTokenHash: jest.fn(),
      findByUserId: jest.fn(),
      revoke: jest.fn(),
      delete: jest.fn(),
      deleteByUserId: jest.fn(),
    } as unknown as jest.Mocked<IRefreshTokenRepository>;

    mockHashingService = {
      hash: jest.fn(),
      compare: jest.fn(),
    } as unknown as jest.Mocked<IHashingService>;

    mockAccessTokenService = {
      generateToken: jest.fn(),
      verifyToken: jest.fn(),
    } as unknown as jest.Mocked<ITokenService>;

    mockRefreshTokenService = {
      generateToken: jest.fn(),
      verifyToken: jest.fn(),
    } as unknown as jest.Mocked<ITokenService>;

    useCase = new RefreshTokenUseCase(
      mockUserRepository,
      mockRefreshTokenRepo,
      mockAccessTokenService,
      mockRefreshTokenService,
      mockHashingService,
    );
  });

  describe('execute()', () => {
    const validUserId = 'user-123';
    const validJti = 'abc123def456';
    const validRefreshToken = 'some-jwt-token';

    const mockUser = {
      id: validUserId,
      email: 'test@example.com',
      role: 'STUDENT' as const,
      name: 'Test User',
      username: 'testuser',
      quota: 100,
      cohort: 'default',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockStoredToken: RefreshToken = {
      id: 'token-1',
      userId: validUserId,
      tokenHash: 'hashed-jti-value',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      revoked: false,
      revokedAt: null,
      createdAt: new Date(),
    };

    it('should succeed with valid JTI', async () => {
      // Arrange
      mockRefreshTokenService.verifyToken.mockReturnValue({
        userId: validUserId,
        jti: validJti,
      });
      mockRefreshTokenRepo.findByUserId.mockResolvedValue(mockStoredToken);
      mockHashingService.compare.mockResolvedValue(true);
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockAccessTokenService.generateToken.mockReturnValue('new-access-token');
      mockRefreshTokenService.generateToken.mockReturnValue('new-refresh-token');
      mockHashingService.hash.mockResolvedValue('new-hashed-token');
      mockRefreshTokenRepo.create.mockResolvedValue({ ...mockStoredToken, id: 'new-token-id' });

      // Act
      const result = await useCase.execute({ refreshToken: validRefreshToken });

      // Assert
      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(mockRefreshTokenRepo.revoke).toHaveBeenCalledWith(mockStoredToken.id);
      expect(mockRefreshTokenRepo.create).toHaveBeenCalled();
    });

    it('should fail with invalid JTI', async () => {
      // Arrange
      mockRefreshTokenService.verifyToken.mockReturnValue({
        userId: validUserId,
        jti: 'wrong-jti',
      });
      mockRefreshTokenRepo.findByUserId.mockResolvedValue(mockStoredToken);
      mockHashingService.compare.mockResolvedValue(false);

      // Act & Assert
      await expect(useCase.execute({ refreshToken: validRefreshToken })).rejects.toThrow(
        'Invalid refresh token: JTI mismatch',
      );

      expect(mockRefreshTokenRepo.deleteByUserId).toHaveBeenCalledWith(validUserId);
    });

    it('should fail when no stored token found for user', async () => {
      // Arrange
      mockRefreshTokenService.verifyToken.mockReturnValue({
        userId: validUserId,
        jti: validJti,
      });
      mockRefreshTokenRepo.findByUserId.mockResolvedValue(null);

      // Act & Assert
      await expect(useCase.execute({ refreshToken: validRefreshToken })).rejects.toThrow(
        'Invalid refresh token',
      );

      expect(mockRefreshTokenRepo.deleteByUserId).toHaveBeenCalledWith(validUserId);
    });

    it('should fail when token is revoked', async () => {
      // Arrange
      const revokedToken = { ...mockStoredToken, revoked: true };

      mockRefreshTokenService.verifyToken.mockReturnValue({
        userId: validUserId,
        jti: validJti,
      });
      mockRefreshTokenRepo.findByUserId.mockResolvedValue(revokedToken);
      mockHashingService.compare.mockResolvedValue(true);

      // Act & Assert
      await expect(useCase.execute({ refreshToken: validRefreshToken })).rejects.toThrow(
        'Refresh token has been revoked',
      );
    });

    it('should fail when token is expired', async () => {
      // Arrange
      const expiredToken = {
        ...mockStoredToken,
        expiresAt: new Date(Date.now() - 1000), // expired
      };

      mockRefreshTokenService.verifyToken.mockReturnValue({
        userId: validUserId,
        jti: validJti,
      });
      mockRefreshTokenRepo.findByUserId.mockResolvedValue(expiredToken);
      mockHashingService.compare.mockResolvedValue(true);

      // Act & Assert
      await expect(useCase.execute({ refreshToken: validRefreshToken })).rejects.toThrow(
        'Refresh token has expired',
      );
    });
  });
});