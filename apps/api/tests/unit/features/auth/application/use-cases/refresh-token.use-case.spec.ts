import { RefreshTokenUseCase } from '@/features/auth/application/use-cases/refresh-token.use-case.js';
import type { IUserRepository } from '@/features/auth/domain/ports/user.repository.port.js';
import type { PrismaRefreshTokenRepository } from '@/features/auth/infrastructure/persistence/refresh-token.repository.js';
import type {
  JwtAccessTokenService,
  JwtRefreshTokenService,
} from '@/features/auth/infrastructure/token.adapter.js';
import type { User } from '@/features/auth/domain/entities/user.entity.js';

const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-123',
  email: 'test@example.com',
  username: 'testuser',
  name: 'Test User',
  role: 'STUDENT',
  age: undefined,
  quota: 0,
  cohort: 'default',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockUserRepository = (): jest.Mocked<IUserRepository> => ({
  findByEmail: jest.fn(),
  findById: jest.fn(),
  findByEmailWithPassword: jest.fn(),
  findByIdentifier: jest.fn(),
  findByIdentifierWithPassword: jest.fn(),
  create: jest.fn(),
  updateRole: jest.fn(),
  updateQuota: jest.fn(),
  delete: jest.fn(),
  findAll: jest.fn(),
});

const createMockRefreshRepo = () =>
  ({
    create: jest.fn(),
    findByToken: jest.fn(),
    revoke: jest.fn(),
    revokeAllForUser: jest.fn(),
    deleteExpired: jest.fn(),
  }) as unknown as jest.Mocked<PrismaRefreshTokenRepository>;

const createMockAccessTokenService = () =>
  ({
    generateToken: jest.fn().mockReturnValue('new-access-token'),
    verifyToken: jest.fn(),
  }) as unknown as jest.Mocked<JwtAccessTokenService>;

const createMockRefreshTokenService = () =>
  ({
    generateToken: jest.fn().mockReturnValue('new-refresh-token'),
    verifyToken: jest.fn(),
  }) as unknown as jest.Mocked<JwtRefreshTokenService>;

describe('RefreshTokenUseCase', () => {
  let userRepository: jest.Mocked<IUserRepository>;
  let refreshRepo: jest.Mocked<PrismaRefreshTokenRepository>;
  let accessTokenService: jest.Mocked<JwtAccessTokenService>;
  let refreshTokenService: jest.Mocked<JwtRefreshTokenService>;
  let useCase: RefreshTokenUseCase;

  beforeEach(() => {
    userRepository = createMockUserRepository();
    refreshRepo = createMockRefreshRepo();
    accessTokenService = createMockAccessTokenService();
    refreshTokenService = createMockRefreshTokenService();
    useCase = new RefreshTokenUseCase(
      userRepository,
      refreshRepo,
      accessTokenService,
      refreshTokenService,
    );
  });

  describe('execute', () => {
    const validRefreshToken = 'valid-refresh-token';
    const userId = 'user-123';

    it('should successfully rotate tokens: verify → lookup → revoke old → issue new → store new', async () => {
      // Given
      const mockUser = createMockUser({ id: userId });
      const storedToken = {
        id: 'rt-1',
        userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revoked: false,
      };

      refreshTokenService.verifyToken.mockReturnValue({ userId });
      refreshRepo.findByToken.mockResolvedValue(storedToken);
      userRepository.findById.mockResolvedValue(mockUser);

      // When
      const result = await useCase.execute({ refreshToken: validRefreshToken });

      // Then
      expect(refreshTokenService.verifyToken).toHaveBeenCalledWith(validRefreshToken);
      expect(refreshRepo.findByToken).toHaveBeenCalledWith(validRefreshToken);
      expect(refreshRepo.revoke).toHaveBeenCalledWith(validRefreshToken);
      expect(userRepository.findById).toHaveBeenCalledWith(userId);
      expect(accessTokenService.generateToken).toHaveBeenCalledWith({
        userId: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
      expect(refreshTokenService.generateToken).toHaveBeenCalledWith({ userId: mockUser.id });
      expect(refreshRepo.create).toHaveBeenCalledWith(
        userId,
        'new-refresh-token',
        expect.any(Date),
      );
      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('should throw error when token signature is invalid (verifyToken throws)', async () => {
      // Given
      refreshTokenService.verifyToken.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      // When / Then
      await expect(useCase.execute({ refreshToken: 'bad-token' })).rejects.toThrow(
        'invalid signature',
      );

      expect(refreshRepo.findByToken).not.toHaveBeenCalled();
    });

    it('should throw error when token is not found in database', async () => {
      // Given
      refreshTokenService.verifyToken.mockReturnValue({ userId });
      refreshRepo.findByToken.mockResolvedValue(null);

      // When / Then
      await expect(useCase.execute({ refreshToken: validRefreshToken })).rejects.toThrow(
        'Invalid refresh token',
      );
    });

    it('should throw error and revoke all user tokens when a revoked token is presented (reuse attack detection)', async () => {
      // Given
      const storedToken = {
        id: 'rt-1',
        userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revoked: true,
      };

      refreshTokenService.verifyToken.mockReturnValue({ userId });
      refreshRepo.findByToken.mockResolvedValue(storedToken);

      // When / Then
      await expect(useCase.execute({ refreshToken: validRefreshToken })).rejects.toThrow(
        'Refresh token has been revoked. Please log in again.',
      );

      expect(refreshRepo.revokeAllForUser).toHaveBeenCalledWith(userId);
      expect(refreshRepo.revoke).not.toHaveBeenCalled();
    });

    it('should throw error and revoke token when stored token is expired', async () => {
      // Given
      const storedToken = {
        id: 'rt-1',
        userId,
        expiresAt: new Date(Date.now() - 1000), // already expired
        revoked: false,
      };

      refreshTokenService.verifyToken.mockReturnValue({ userId });
      refreshRepo.findByToken.mockResolvedValue(storedToken);

      // When / Then
      await expect(useCase.execute({ refreshToken: validRefreshToken })).rejects.toThrow(
        'Refresh token has expired',
      );

      expect(refreshRepo.revoke).toHaveBeenCalledWith(validRefreshToken);
    });

    it('should throw error when user is not found', async () => {
      // Given
      const storedToken = {
        id: 'rt-1',
        userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revoked: false,
      };

      refreshTokenService.verifyToken.mockReturnValue({ userId });
      refreshRepo.findByToken.mockResolvedValue(storedToken);
      userRepository.findById.mockResolvedValue(null);

      // When / Then
      await expect(useCase.execute({ refreshToken: validRefreshToken })).rejects.toThrow(
        'User not found',
      );
    });

    it('should throw error when payload is missing userId', async () => {
      // Given
      refreshTokenService.verifyToken.mockReturnValue({ someOtherField: 'value' });

      // When / Then
      await expect(useCase.execute({ refreshToken: validRefreshToken })).rejects.toThrow(
        'Invalid refresh token: missing userId',
      );
    });

    it('should return new accessToken and refreshToken on success', async () => {
      // Given
      const mockUser = createMockUser({ id: userId });
      const storedToken = {
        id: 'rt-1',
        userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revoked: false,
      };

      refreshTokenService.verifyToken.mockReturnValue({ userId });
      refreshRepo.findByToken.mockResolvedValue(storedToken);
      userRepository.findById.mockResolvedValue(mockUser);

      // When
      const result = await useCase.execute({ refreshToken: validRefreshToken });

      // Then
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
    });
  });
});
