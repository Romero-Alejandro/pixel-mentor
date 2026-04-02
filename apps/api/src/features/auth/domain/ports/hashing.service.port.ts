/**
 * Port for password hashing operations.
 * Allows swapping implementations (e.g., argon2, bcrypt, scrypt).
 */
export interface IHashingService {
  /**
   * Hash a password using the configured algorithm.
   */
  hash(password: string): Promise<string>;

  /**
   * Verify a password against a hash.
   */
  compare(password: string, hash: string): Promise<boolean>;
}
