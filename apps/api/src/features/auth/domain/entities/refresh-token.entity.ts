export interface RefreshToken {
  readonly id: string;
  readonly token: string;
  readonly userId: string;
  readonly expiresAt: Date;
  readonly revoked: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
