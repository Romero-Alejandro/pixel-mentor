import request from 'supertest';
import express from 'express';
import { createAuthRouter } from '@/infrastructure/adapters/http/routes/auth';
import { authMiddleware } from '@/infrastructure/adapters/http/middleware/auth';
import type { UserRepository } from '@/domain/ports/user-repository.js';
import type {
  RegisterUseCase,
  LoginUseCase,
  VerifyTokenUseCase,
} from '@/application/use-cases/auth/index.js';

jest.mock('@/application/use-cases/auth/register.use-case');
jest.mock('@/application/use-cases/auth/login.use-case');
jest.mock('@/application/use-cases/auth/verify-token.use-case');

describe('Auth API Endpoints', () => {
  let mockRegisterUseCase: jest.Mocked<RegisterUseCase>;
  let mockLoginUseCase: jest.Mocked<LoginUseCase>;
  let mockVerifyTokenUseCase: jest.Mocked<VerifyTokenUseCase>;
  let mockUserRepo: jest.Mocked<UserRepository>;
  let app: express.Express;

  beforeEach(() => {
    mockRegisterUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<RegisterUseCase>;

    mockLoginUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<LoginUseCase>;

    mockVerifyTokenUseCase = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<VerifyTokenUseCase>;

    mockUserRepo = {
      findById: jest.fn().mockResolvedValue({
        id: '123e4567-e89b-12d3-a456-426614174001',
        email: 'test@test.com',
        name: 'Test User',
        role: 'STUDENT',
        quota: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      findByEmail: jest.fn(),
      findByEmailWithPassword: jest.fn(),
      create: jest.fn(),
      updateRole: jest.fn(),
      delete: jest.fn(),
      findByIdentifier: jest.fn(),
      findByIdentifierWithPassword: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;

    const protectedMiddleware = authMiddleware(mockUserRepo, mockVerifyTokenUseCase);

    const authRouter = createAuthRouter(
      mockUserRepo,
      mockRegisterUseCase,
      mockLoginUseCase,
      protectedMiddleware,
    );

    app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);

    // Global error handler (mirrors server.ts)
    app.use(
      (err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
        console.error({ url: req.url, method: req.method, err: String(err) });

        if (err instanceof Error && 'httpStatus' in err && 'code' in err) {
          const authErr = err as {
            httpStatus: number;
            code: string;
            message: string;
            details?: unknown;
          };
          res.status(authErr.httpStatus).json({
            error: authErr.message,
            code: authErr.code,
            ...(authErr.details ? { details: authErr.details } : {}),
          });
          return;
        }

        const statusCode =
          err instanceof Error && 'statusCode' in err ? (err as any).statusCode : 500;
        const message = err instanceof Error ? err.message : 'Error interno del servidor';

        res.status(statusCode).json({ error: message });
      },
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      mockRegisterUseCase.execute.mockResolvedValueOnce({
        user: {
          id: 'new-user-id',
          email: 'new@example.com',
          name: 'New User',
          role: 'STUDENT',
          quota: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        token: 'jwt-token-123',
      });

      const response = await request(app).post('/api/auth/register').send({
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe('new@example.com');
    });

    it('should reject duplicate email', async () => {
      const error = new Error('Ya existe un usuario con este email');
      error.httpStatus = 409;
      (error as any).code = 'USER_ALREADY_EXISTS';
      mockRegisterUseCase.execute.mockRejectedValueOnce(error);

      const response = await request(app).post('/api/auth/register').send({
        email: 'existing@example.com',
        password: 'password123',
        name: 'Existing User',
      });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error', 'Ya existe un usuario con este email');
      expect(response.body).toHaveProperty('code', 'USER_ALREADY_EXISTS');
    });

    it('should reject invalid email format', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'not-an-email',
        password: 'password123',
        name: 'Test User',
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Error de validación');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject short password', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: '12345',
        name: 'Test User',
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Error de validación');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject missing fields', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
      });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      mockLoginUseCase.execute.mockResolvedValueOnce({
        user: {
          id: 'user-123',
          email: 'test@test.com',
          name: 'Test User',
          role: 'STUDENT',
          quota: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        token: 'jwt-token-123',
      });

      const response = await request(app).post('/api/auth/login').send({
        identifier: 'test@test.com',
        password: 'password123',
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
    });

    it('should reject invalid credentials', async () => {
      const error = new Error('Credenciales inválidas');
      error.httpStatus = 401;
      (error as any).code = 'INVALID_CREDENTIALS';
      mockLoginUseCase.execute.mockRejectedValueOnce(error);

      const response = await request(app).post('/api/auth/login').send({
        identifier: 'test@test.com',
        password: 'wrongpassword',
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Credenciales inválidas');
      expect(response.body).toHaveProperty('code', 'INVALID_CREDENTIALS');
    });

    it('should reject missing email', async () => {
      const response = await request(app).post('/api/auth/login').send({
        password: 'password123',
      });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      mockVerifyTokenUseCase.execute.mockResolvedValueOnce({
        userId: 'user-123',
        email: 'test@test.com',
        role: 'STUDENT',
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
    });

    it('should reject request without token', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'No se proporcionó token de autenticación');
      expect(response.body).toHaveProperty('code', 'TOKEN_MISSING');
    });

    it('should reject request with invalid token', async () => {
      const error = new Error('Token inválido');
      error.httpStatus = 401;
      (error as any).code = 'TOKEN_INVALID';
      mockVerifyTokenUseCase.execute.mockRejectedValueOnce(error);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Token inválido');
      expect(response.body).toHaveProperty('code', 'TOKEN_INVALID');
    });
  });
});
