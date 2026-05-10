export interface RefreshToken {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly revoked: boolean;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
}
