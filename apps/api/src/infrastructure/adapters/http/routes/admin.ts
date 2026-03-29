/**
 * Admin User Management Routes
 *
 * REST API endpoints for user management.
 * ALL routes require ADMIN role authentication.
 *
 * Security measures:
 * - requireRole('ADMIN') middleware enforced at server.ts level
 * - Self-deletion prevention
 * - Self-demotion prevention
 * - Input validation with Zod
 * - Rate limiting at mount point
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';

import type { AdminUserService } from '@/application/services/admin-user.service.js';
import type { AuthError } from '@/domain/ports/auth-errors.js';
import { UserAlreadyExistsError, UserNotFoundError } from '@/domain/ports/user-repository.js';
import { DeleteUserParamsSchema, GetUserParamsSchema } from '@/application/dto/index.js';

// ==================== Schemas ====================

const UserRoleSchema = z.enum(['STUDENT', 'TEACHER', 'ADMIN']);

const CreateUserSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  name: z.string().min(1, 'El nombre es requerido').max(100),
  username: z
    .string()
    .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
    .max(30, 'El nombre de usuario no puede exceder 30 caracteres')
    .regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, números y guiones bajos')
    .optional(),
  role: UserRoleSchema,
  age: z.number().int().positive().optional(),
});

const UpdateRoleSchema = z.object({
  role: UserRoleSchema,
});

const ListUsersQuerySchema = z.object({
  role: UserRoleSchema.optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ==================== Types ====================

interface AdminRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

// ==================== Router Factory ====================

export function createAdminRouter(adminUserService: AdminUserService): Router {
  const router = Router();

  /**
   * POST /api/admin/users - Create a new user with any role
   * Auth: ADMIN only
   */
  router.post('/users', async (req: AdminRequest, res: Response, next: NextFunction) => {
    try {
      const validated = CreateUserSchema.parse(req.body);

      const user = await adminUserService.createUser({
        email: validated.email,
        password: validated.password,
        name: validated.name,
        username: validated.username,
        role: validated.role,
        age: validated.age,
      });

      res.status(201).json({ user });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Error de validación',
          code: 'VALIDATION_ERROR',
          details: error.issues,
        });
        return;
      }
      if (error instanceof UserAlreadyExistsError) {
        res.status(409).json({
          error: `Ya existe un usuario con este ${error.email.includes('@') ? 'email' : 'nombre de usuario'}`,
          code: 'USER_ALREADY_EXISTS',
        });
        return;
      }
      next(error);
    }
  });

  /**
   * GET /api/admin/users - List all users with pagination and filters
   * Auth: ADMIN only
   */
  router.get('/users', async (req: AdminRequest, res: Response, next: NextFunction) => {
    try {
      const query = ListUsersQuerySchema.parse(req.query);

      const result = await adminUserService.listUsers({
        role: query.role,
        search: query.search,
        page: query.page,
        limit: query.limit,
      });

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Parámetros de consulta inválidos',
          code: 'VALIDATION_ERROR',
          details: error.issues,
        });
        return;
      }
      next(error);
    }
  });

  /**
   * GET /api/admin/users/:id - Get user details
   * Auth: ADMIN only
   */
  router.get('/users/:id', async (req: AdminRequest, res: Response, next: NextFunction) => {
    try {
      const validated = GetUserParamsSchema.parse(req.params);
      const user = await adminUserService.getUser(validated.id);
      res.json({ user });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Parámetros de ruta inválidos',
          code: 'VALIDATION_ERROR',
          details: error.issues,
        });
        return;
      }
      if (error instanceof UserNotFoundError) {
        res.status(404).json({
          error: 'Usuario no encontrado',
          code: 'USER_NOT_FOUND',
        });
        return;
      }
      next(error);
    }
  });

  /**
   * PATCH /api/admin/users/:id/role - Change user role
   * Auth: ADMIN only
   * Security: Cannot change own role
   */
  router.patch('/users/:id/role', async (req: AdminRequest, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const validated = UpdateRoleSchema.parse(req.body);
      const adminId = req.user!.id;

      const user = await adminUserService.updateUserRole(id, validated.role, adminId);

      res.json({ user });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Error de validación',
          code: 'VALIDATION_ERROR',
          details: error.issues,
        });
        return;
      }
      if (error instanceof UserNotFoundError) {
        res.status(404).json({
          error: 'Usuario no encontrado',
          code: 'USER_NOT_FOUND',
        });
        return;
      }
      if (error instanceof Error && 'code' in error && (error as AuthError).code === 'FORBIDDEN') {
        res.status(403).json({
          error: error.message,
          code: 'FORBIDDEN',
        });
        return;
      }
      next(error);
    }
  });

  /**
   * DELETE /api/admin/users/:id - Delete a user
   * Auth: ADMIN only
   * Security: Cannot delete own account
   */
  router.delete('/users/:id', async (req: AdminRequest, res: Response, next: NextFunction) => {
    try {
      const validated = DeleteUserParamsSchema.parse(req.params);
      const adminId = req.user!.id;

      await adminUserService.deleteUser(validated.id, adminId);

      res.status(204).send();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Parámetros de ruta inválidos',
          code: 'VALIDATION_ERROR',
          details: error.issues,
        });
        return;
      }
      if (error instanceof UserNotFoundError) {
        res.status(404).json({
          error: 'Usuario no encontrado',
          code: 'USER_NOT_FOUND',
        });
        return;
      }
      if (error instanceof Error && 'code' in error && (error as AuthError).code === 'FORBIDDEN') {
        res.status(403).json({
          error: error.message,
          code: 'FORBIDDEN',
        });
        return;
      }
      next(error);
    }
  });

  return router;
}
