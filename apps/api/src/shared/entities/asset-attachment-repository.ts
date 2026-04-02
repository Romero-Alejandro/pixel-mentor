import type { AssetAttachment } from '../entities/asset-attachment';

export interface AssetAttachmentRepository {
  findById(id: string): Promise<AssetAttachment | null>;
  findByAssetId(assetId: string): Promise<AssetAttachment[]>;
  findByAtomId(atomId: string): Promise<AssetAttachment[]>;
  findByRecipeId(recipeId: string): Promise<AssetAttachment[]>;
  create(attachment: Omit<AssetAttachment, 'createdAt'>): Promise<AssetAttachment>;
  delete(id: string): Promise<void>;
  deleteByAssetId(assetId: string): Promise<void>;
}
