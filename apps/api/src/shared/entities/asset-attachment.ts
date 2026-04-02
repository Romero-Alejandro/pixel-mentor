export interface AssetAttachment {
  readonly id: string;
  readonly assetId: string;
  readonly atomId?: string;
  readonly recipeId?: string;
  readonly createdAt: Date;
}

export function createAssetAttachment(parameters: {
  id: string;
  assetId: string;
  atomId?: string;
  recipeId?: string;
}): AssetAttachment {
  return {
    id: parameters.id,
    assetId: parameters.assetId,
    atomId: parameters.atomId,
    recipeId: parameters.recipeId,
    createdAt: new Date(),
  };
}
