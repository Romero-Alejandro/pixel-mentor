import type { Asset } from '../entities/asset';

export interface AssetRepository {
  findById(id: string): Promise<Asset | null>;
  findByKey(key: string): Promise<Asset | null>;
  findAll(limit?: number): Promise<Asset[]>;
  create(asset: Omit<Asset, 'uploadedAt'>): Promise<Asset>;
  update(id: string, data: Partial<Asset>): Promise<Asset>;
  delete(id: string): Promise<void>;
}
