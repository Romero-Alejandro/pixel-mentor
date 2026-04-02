/**
 * PrismaBaseRepository - Generic base class for Prisma repositories
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

export type MapperFn<TPrismaModel, TEntity> = (prismaModel: TPrismaModel) => TEntity;

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

  async findById(id: string): Promise<TEntity | null> {
    const result = await this.delegate.findUnique({ where: { id } });
    return result ? this.mapper(result) : null;
  }

  async findAll(options?: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, 'asc' | 'desc'>;
    skip?: number;
    take?: number;
  }): Promise<TEntity[]> {
    const results = await this.delegate.findMany(options);
    return results.map(this.mapper);
  }

  async create(data: TCreateInput): Promise<TEntity> {
    const result = await this.delegate.create({ data });
    return this.mapper(result);
  }

  async update(id: string, data: TUpdateInput): Promise<TEntity> {
    const result = await this.delegate.update({ where: { id }, data });
    return this.mapper(result);
  }

  async delete(id: string): Promise<void> {
    await this.delegate.delete({ where: { id } });
  }

  async count(where?: Record<string, unknown>): Promise<number> {
    return this.delegate.count(where ? { where } : undefined);
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.delegate.count({ where: { id } });
    return count > 0;
  }

  protected prepareUpdateData<T extends Record<string, unknown>>(data: Partial<T>): Partial<T> {
    const updateData: Partial<T> = {};

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        (updateData as Record<string, unknown>)[key] = value;
      }
    }

    return updateData;
  }

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
