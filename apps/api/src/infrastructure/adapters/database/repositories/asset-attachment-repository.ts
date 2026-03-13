import { prisma } from '../client';
import type { AssetAttachment } from '@/domain/entities/asset-attachment';
import type { AssetAttachmentRepository } from '@/domain/ports/asset-attachment-repository';

export class PrismaAssetAttachmentRepository implements AssetAttachmentRepository {
  async findById(id: string): Promise<AssetAttachment | null> {
    const raw = await prisma.assetAttachment.findUnique({ where: { id } });
    return raw ? this.mapAttachment(raw) : null;
  }

  async findByAssetId(assetId: string): Promise<AssetAttachment[]> {
    const raw = await prisma.assetAttachment.findMany({ where: { assetId } });
    return raw.map(this.mapAttachment);
  }

  async findByAtomId(atomId: string): Promise<AssetAttachment[]> {
    const raw = await prisma.assetAttachment.findMany({ where: { atomId } });
    return raw.map(this.mapAttachment);
  }

  async findByRecipeId(recipeId: string): Promise<AssetAttachment[]> {
    const raw = await prisma.assetAttachment.findMany({ where: { recipeId } });
    return raw.map(this.mapAttachment);
  }

  async create(attachment: Omit<AssetAttachment, 'createdAt'>): Promise<AssetAttachment> {
    const raw = await prisma.assetAttachment.create({
      data: {
        assetId: attachment.assetId,
        atomId: attachment.atomId,
        recipeId: attachment.recipeId,
      },
    });
    return this.mapAttachment(raw);
  }

  async delete(id: string): Promise<void> {
    await prisma.assetAttachment.delete({ where: { id } });
  }

  async deleteByAssetId(assetId: string): Promise<void> {
    await prisma.assetAttachment.deleteMany({ where: { assetId } });
  }

  private mapAttachment(raw: any): AssetAttachment {
    return {
      id: raw.id,
      assetId: raw.assetId,
      atomId: raw.atomId,
      recipeId: raw.recipeId,
      createdAt: raw.createdAt,
    };
  }
}
