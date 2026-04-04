import jwt from 'jsonwebtoken';

// Mock config before importing token.adapter
jest.mock('@/shared/config/index.js', () => ({
  config: {
    JWT_SECRET: 'test-jwt-secret-that-is-at-least-32-characters-long',
    JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-at-least-32-chars',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  JwtAccessTokenService,
  JwtRefreshTokenService,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
} = require('@/features/auth/infrastructure/token.adapter.js');

const TEST_JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters-long';
const TEST_JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-chars';

describe('JwtAccessTokenService', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let service: any;

  beforeEach(() => {
    service = new JwtAccessTokenService();
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      // Given
      const payload = { userId: 'user-1', email: 'test@example.com', role: 'STUDENT' };

      // When
      const token = service.generateToken(payload);

      // Then
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwt.verify(token, TEST_JWT_SECRET) as jwt.JwtPayload;
      expect(decoded.userId).toBe('user-1');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.role).toBe('STUDENT');
    });

    it('should generate a token with short expiry', () => {
      // Given
      const payload = { userId: 'user-1' };

      // When
      const token = service.generateToken(payload);

      // Then
      const decoded = jwt.verify(token, TEST_JWT_SECRET) as jwt.JwtPayload;
      expect(decoded.exp).toBeDefined();
      // Default is 15 minutes; exp should be roughly 15min from now
      const expiryMs = (decoded.exp! - decoded.iat!) * 1000;
      expect(expiryMs).toBeLessThanOrEqual(15 * 60 * 1000);
      expect(expiryMs).toBeGreaterThan(0);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token and return payload', () => {
      // Given
      const payload = { userId: 'user-1', email: 'test@example.com', role: 'ADMIN' };
      const token = service.generateToken(payload);

      // When
      const result = service.verifyToken(token);

      // Then
      expect(result).toEqual(
        expect.objectContaining({
          userId: 'user-1',
          email: 'test@example.com',
          role: 'ADMIN',
        }),
      );
    });

    it('should throw error for expired token', () => {
      // Given
      const expiredToken = jwt.sign(
        { userId: 'user-1', exp: Math.floor(Date.now() / 1000) - 100 },
        TEST_JWT_SECRET,
      );

      // When / Then
      expect(() => service.verifyToken(expiredToken)).toThrow();
    });

    it('should throw error for tampered token', () => {
      // Given
      const validToken = service.generateToken({ userId: 'user-1' });
      const tamperedToken = validToken.slice(0, -5) + 'XXXXX';

      // When / Then
      expect(() => service.verifyToken(tamperedToken)).toThrow();
    });

    it('should throw error for token signed with different secret', () => {
      // Given
      const wrongSecretToken = jwt.sign(
        { userId: 'user-1' },
        'completely-different-secret-that-is-at-least-32-chars',
      );

      // When / Then
      expect(() => service.verifyToken(wrongSecretToken)).toThrow();
    });

    it('should throw error for completely invalid token string', () => {
      // When / Then
      expect(() => service.verifyToken('not-a-jwt-token-at-all')).toThrow();
    });

    it('should return empty object when decoded is a string', () => {
      // Given — mock jwt.verify to simulate string return
      jest.spyOn(jwt, 'verify').mockReturnValue('some-string' as never);

      // When
      const result = service.verifyToken('any-token');

      // Then
      expect(result).toEqual({});

      // Restore
      (jwt.verify as jest.Mock).mockRestore();
    });
  });
});

describe('JwtRefreshTokenService', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let service: any;

  beforeEach(() => {
    service = new JwtRefreshTokenService();
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      // Given
      const payload = { userId: 'user-1' };

      // When
      const token = service.generateToken(payload);

      // Then
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwt.verify(token, TEST_JWT_REFRESH_SECRET) as jwt.JwtPayload;
      expect(decoded.userId).toBe('user-1');
    });

    it('should generate a token with long expiry (7 days default)', () => {
      // Given
      const payload = { userId: 'user-1' };

      // When
      const token = service.generateToken(payload);

      // Then
      const decoded = jwt.verify(token, TEST_JWT_REFRESH_SECRET) as jwt.JwtPayload;
      expect(decoded.exp).toBeDefined();
      const expiryMs = (decoded.exp! - decoded.iat!) * 1000;
      // Default is 7 days
      expect(expiryMs).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000);
      expect(expiryMs).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token and return payload', () => {
      // Given
      const payload = { userId: 'user-1' };
      const token = service.generateToken(payload);

      // When
      const result = service.verifyToken(token);

      // Then
      expect(result).toEqual(
        expect.objectContaining({
          userId: 'user-1',
        }),
      );
    });

    it('should throw error for expired token', () => {
      // Given
      const expiredToken = jwt.sign(
        { userId: 'user-1', exp: Math.floor(Date.now() / 1000) - 100 },
        TEST_JWT_REFRESH_SECRET,
      );

      // When / Then
      expect(() => service.verifyToken(expiredToken)).toThrow();
    });

    it('should throw error for tampered token', () => {
      // Given
      const validToken = service.generateToken({ userId: 'user-1' });
      const tamperedToken = validToken.slice(0, -5) + 'XXXXX';

      // When / Then
      expect(() => service.verifyToken(tamperedToken)).toThrow();
    });

    it('should use separate refresh secret when configured', () => {
      // Given
      const payload = { userId: 'user-1' };
      const token = service.generateToken(payload);

      // Token signed with refresh secret should NOT verify with main JWT_SECRET
      expect(() => jwt.verify(token, TEST_JWT_SECRET)).toThrow();

      // But should verify with refresh secret
      const decoded = jwt.verify(token, TEST_JWT_REFRESH_SECRET) as jwt.JwtPayload;
      expect(decoded.userId).toBe('user-1');
    });

    it('should fallback to JWT_SECRET when JWT_REFRESH_SECRET is not set', () => {
      // Given — we need to re-mock config without JWT_REFRESH_SECRET
      jest.resetModules();

      jest.mock('@/shared/config/index.js', () => ({
        config: {
          JWT_SECRET: TEST_JWT_SECRET,
          JWT_REFRESH_SECRET: undefined,
          JWT_ACCESS_EXPIRES_IN: '15m',
          JWT_REFRESH_EXPIRES_IN: '7d',
        },
      }));

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const {
        JwtRefreshTokenService: FallbackService,
      } = require('@/features/auth/infrastructure/token.adapter.js');

      const fallbackService = new FallbackService();

      // When
      const token = fallbackService.generateToken({ userId: 'user-1' });

      // Then — should verify with JWT_SECRET
      const decoded = jwt.verify(token, TEST_JWT_SECRET) as jwt.JwtPayload;
      expect(decoded.userId).toBe('user-1');
    });

    it('should return empty object when decoded is a string', () => {
      // Given
      jest.spyOn(jwt, 'verify').mockReturnValue('some-string' as never);

      // When
      const result = service.verifyToken('any-token');

      // Then
      expect(result).toEqual({});

      // Restore
      (jwt.verify as jest.Mock).mockRestore();
    });
  });
});
