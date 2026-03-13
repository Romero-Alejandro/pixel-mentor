import { prisma } from '../client';
import type { Asset } from '@/domain/entities/asset';
import type { AssetRepository } from '@/domain/ports/asset-repository';

export class PrismaAssetRepository implements AssetRepository {
  async findById(id: string): Promise<Asset | null> {
    const raw = await prisma.asset.findUnique({ where: { id } });
    return raw ? this.mapAsset(raw) : null;
  }

  async findByKey(key: string): Promise<Asset | null> {
    const raw = await prisma.asset.findUnique({ where: { key } });
    return raw ? this.mapAsset(raw) : null;
  }

  async findAll(limit: number = 100): Promise<Asset[]> {
    const raw = await prisma.asset.findMany({ take: limit });
    return raw.map(this.mapAsset);
  }

  async create(asset: Omit<Asset, 'uploadedAt'>): Promise<Asset> {
    const raw = await prisma.asset.create({
      data: {
        key: asset.key,
        url: asset.url,
        mime: asset.mime,
        size: asset.size,
        meta: asset.meta,
      },
    });
    return this.mapAsset(raw);
  }

  async update(id: string, data: Partial<Asset>): Promise<Asset> {
    const raw = await prisma.asset.update({
      where: { id },
      data: {
        key: data.key,
        url: data.url,
        mime: data.mime,
        size: data.size,
        meta: data.meta,
      },
    });
    return this.mapAsset(raw);
  }

  async delete(id: string): Promise<void> {
    await prisma.asset.delete({ where: { id } });
  }

  private mapAsset(raw: any): Asset {
    return {
      id: raw.id,
      key: raw.key,
      url: raw.url,
      mime: raw.mime,
      size: raw.size,
      meta: raw.meta,
      uploadedAt: raw.uploadedAt,
    };
  }
}
