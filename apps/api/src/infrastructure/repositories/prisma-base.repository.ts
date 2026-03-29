/**
 * PrismaBaseRepository - Generic base class for Prisma repositories
 *
 * Provides common CRUD operations to reduce code duplication across repositories.
 * Each specific repository extends this class and provides its own mapper function.
 *
 * @template TEntity - The domain entity type
 * @template TPrismaModel - The Prisma model type
 * @template TCreateInput - The input type for create operations
 * @template TUpdateInput - The input type for update operations
 *
 * @example
 * ```typescript
 * class PrismaBadgeRepository extends PrismaBaseRepository<
 *   BadgeEntity,
 *   Prisma.BadgeGetPayload<{}>,
 *   Prisma.BadgeCreateInput,
 *   Prisma.BadgeUpdateInput
 * > {
 *   constructor() {
 *     super(prisma.badge, mapPrismaToBadgeEntity);
 *   }
 * }
 * ```
 */

/**
 * Interface for Prisma model delegate with common CRUD methods
 */
export interface PrismaDelegate<T, TCreateInput, TUpdateInput> {
  findUnique(args: { where: { id: string } }): Promise<T | null>;
  findMany(args?: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, 'asc' | 'desc'>;
    skip?: number;
    take?: number;
  }): Promise<T[]>;
  create(args: { data: TCreateInput }): Promise<T>;
  update(args: { where: { id: string }; data: TUpdateInput }): Promise<T>;
  delete(args: { where: { id: string } }): Promise<T>;
  count(args?: { where?: Record<string, unknown> }): Promise<number>;
}

/**
 * Mapper function type to convert Prisma model to domain entity
 */
export type MapperFn<TPrismaModel, TEntity> = (prismaModel: TPrismaModel) => TEntity;

/**
 * Base repository class with common CRUD operations
 */
export abstract class PrismaBaseRepository<
  TEntity extends { id: string },
  TPrismaModel extends { id: string },
  TCreateInput,
  TUpdateInput,
> {
  constructor(
    protected readonly delegate: PrismaDelegate<TPrismaModel, TCreateInput, TUpdateInput>,
    protected readonly mapper: MapperFn<TPrismaModel, TEntity>,
  ) {}

  /**
   * Find a single entity by ID
   */
  async findById(id: string): Promise<TEntity | null> {
    const result = await this.delegate.findUnique({ where: { id } });
    return result ? this.mapper(result) : null;
  }

  /**
   * Find all entities matching the filter
   */
  async findAll(options?: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, 'asc' | 'desc'>;
    skip?: number;
    take?: number;
  }): Promise<TEntity[]> {
    const results = await this.delegate.findMany(options);
    return results.map(this.mapper);
  }

  /**
   * Create a new entity
   */
  async create(data: TCreateInput): Promise<TEntity> {
    const result = await this.delegate.create({ data });
    return this.mapper(result);
  }

  /**
   * Update an existing entity by ID
   */
  async update(id: string, data: TUpdateInput): Promise<TEntity> {
    const result = await this.delegate.update({ where: { id }, data });
    return this.mapper(result);
  }

  /**
   * Delete an entity by ID
   */
  async delete(id: string): Promise<void> {
    await this.delegate.delete({ where: { id } });
  }

  /**
   * Count entities matching the filter
   */
  async count(where?: Record<string, unknown>): Promise<number> {
    return this.delegate.count(where ? { where } : undefined);
  }

  /**
   * Check if an entity exists by ID
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.delegate.count({ where: { id } });
    return count > 0;
  }

  /**
   * Helper to prepare update data by filtering out undefined values
   */
  protected prepareUpdateData<T extends Record<string, unknown>>(data: Partial<T>): Partial<T> {
    const updateData: Partial<T> = {};

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        (updateData as Record<string, unknown>)[key] = value;
      }
    }

    return updateData;
  }

  /**
   * Helper to paginate results
   */
  async findPaginated(
    page: number = 1,
    limit: number = 20,
    options?: {
      where?: Record<string, unknown>;
      orderBy?: Record<string, 'asc' | 'desc'>;
    },
  ): Promise<{ data: TEntity[]; total: number; page: number; limit: number; totalPages: number }> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.findAll({ ...options, skip, take: limit }),
      this.count(options?.where),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
