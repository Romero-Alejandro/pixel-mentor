import argon2 from 'argon2';

import type { IHashingService } from '@/features/auth/domain/ports/hashing.service.port.js';

/**
 * Argon2 implementation of the hashing service port.
 */
export class Argon2HashingService implements IHashingService {
  async hash(password: string): Promise<string> {
    return argon2.hash(password);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }
}
