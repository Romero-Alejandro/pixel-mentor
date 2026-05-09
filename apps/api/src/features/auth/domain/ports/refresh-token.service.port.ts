export interface IRefreshTokenService {
  generateRefreshToken(payload: object): string;
  verifyRefreshToken(token: string): object;
}
