export interface Asset {
  readonly id: string;
  readonly key: string;
  readonly url: string;
  readonly mime?: string;
  readonly size?: number;
  readonly meta?: unknown;
  readonly uploadedAt: Date;
}

export function createAsset(parameters: {
  id: string;
  key: string;
  url: string;
  mime?: string;
  size?: number;
  meta?: unknown;
}): Asset {
  return {
    id: parameters.id,
    key: parameters.key,
    url: parameters.url,
    mime: parameters.mime,
    size: parameters.size,
    meta: parameters.meta,
    uploadedAt: new Date(),
  };
}
