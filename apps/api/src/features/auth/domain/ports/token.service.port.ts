/**
 * Port for JWT token operations.
 * Allows swapping implementations (e.g., jsonwebtoken, jose, etc.).
 */
export interface ITokenService {
  /**
   * Generate a JWT token with the given payload.
   */
  generateToken(payload: object): string;

  /**
   * Verify and decode a JWT token.
   * @throws Error if token is invalid or expired
   */
  verifyToken(token: string): object;
}
