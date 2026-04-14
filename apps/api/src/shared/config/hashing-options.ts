/**
 * Centralized configuration for hashing options.
 *
 * IMPORTANT: These options MUST match between:
 * - seed-test-data.ts (creating test users)
 * - seed-admin.ts (creating admin users)
 * - hashing.adapter.ts (verifying passwords during login)
 *
 * Using different argon2 options will cause password verification to fail.
 */

import argon2 from 'argon2';

/**
 * Full hashing options for creating new password hashes
 */
export const HASHING_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 2 ** 16, // 65536
  timeCost: 3,
  parallelism: 1,
};

/**
 * Default hash options for new password hashing (registration)
 */
export const DEFAULT_HASH_OPTIONS = HASHING_OPTIONS;

/**
 * Verify options - used when verifying existing hashes
 * Must include the type to match how hashes were created
 */
export const VERIFY_HASH_OPTIONS = {} as any;
