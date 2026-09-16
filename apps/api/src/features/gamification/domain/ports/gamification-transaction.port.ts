/**
 * Domain-facing transaction port for the gamification engine.
 *
 * The engine awards XP and badges atomically. The concrete implementation
 * (prisma interactive transactions) lives in gamification infrastructure;
 * this file only declares the *shape* of the operations the engine needs,
 * so the application layer never imports prisma types.
 */
import type { RewardResult } from '@/features/gamification/domain/ports/gamification.ports.js';

/** Minimal user-gamification row operations used inside reward transactions. */
export interface UserGamificationTxDelegate {
  update(args: {
    where: { userId: string };
    data: { totalXP?: { increment: number }; level?: number };
  }): Promise<{ totalXP: number; level: number }>;
  findUnique(args: { where: { userId: string } }): Promise<{ id: string } | null>;
  create(args: {
    data: {
      userId: string;
      totalXP: number;
      currentStreak: number;
      longestStreak: number;
      level: number;
    };
  }): Promise<{ id: string }>;
}

/** Minimal badge/user-badge row operations used inside reward transactions. */
export interface BadgeTxDelegate {
  findUnique(args: { where: { code: string } }): Promise<{
    id: string;
    name: string;
    icon: string;
  } | null>;
  /** Batched lookup by code; preserves no particular order. */
  findMany(args: {
    where: { code: { in: string[] } };
  }): Promise<Array<{ id: string; code: string; name: string; icon: string }>>;
}

export interface UserBadgeTxDelegate {
  findUnique(args: {
    where: { userId_badgeId: { userId: string; badgeId: string } };
  }): Promise<{ id: string } | null>;
  /** Batched lookup of the badges the user already owns. */
  findMany(args: {
    where: { userId: string; badgeId: { in: string[] } };
  }): Promise<Array<{ badgeId: string }>>;
  create(args: {
    data: { userId: string; badgeId: string; userGamificationId: string };
  }): Promise<unknown>;
  /** Batched insert; duplicates must not throw (skipDuplicates semantics). */
  createMany(args: {
    data: Array<{ userId: string; badgeId: string; userGamificationId: string }>;
  }): Promise<unknown>;
}

/** Transaction-scoped view of the gamification state stores. */
export interface GamificationTxClient {
  userGamification: UserGamificationTxDelegate;
  badge: BadgeTxDelegate;
  userBadge: UserBadgeTxDelegate;
}

export interface IGamificationTransactionService {
  /** Run the reward transaction; rollback on throw. */
  execute<T>(fn: (tx: GamificationTxClient) => Promise<T>): Promise<T>;
}

export type { RewardResult };
