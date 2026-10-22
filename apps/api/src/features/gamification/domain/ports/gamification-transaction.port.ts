/**
 * Domain-facing transaction port for the gamification engine.
 *
 * The engine awards XP and badges atomically. The concrete implementation
 * (prisma interactive transactions) lives in gamification infrastructure;
 * this file only declares the *shape* of the operations the engine needs,
 * so the application layer never imports prisma types.
 */

/** Why an XP transaction happened. Mirrors the Prisma `XpSource` enum. */
export type XpSourceName =
  | 'LESSON'
  | 'BADGE'
  | 'STREAK_DAILY'
  | 'STREAK_MILESTONE'
  | 'ADMIN_ADJUSTMENT';

/** Minimal user-gamification row operations used inside reward transactions. */
export interface UserGamificationTxDelegate {
  update(args: {
    where: { userId: string };
    data: { totalXP?: { increment: number } };
  }): Promise<{ totalXP: number }>;
  findUnique(args: { where: { userId: string } }): Promise<{ id: string; totalXP: number } | null>;
}

/** Minimal XP ledger operations used inside reward transactions. */
export interface XpTransactionTxDelegate {
  findUnique(args: {
    where: {
      userId_source_sourceRef: {
        userId: string;
        source: XpSourceName;
        sourceRef: string;
      };
    };
  }): Promise<{ id: string } | null>;
  create(args: {
    data: {
      userId: string;
      amount: number;
      source: XpSourceName;
      sourceRef: string;
      balanceAfter: number;
    };
  }): Promise<unknown>;
}

/** Minimal badge/user-badge row operations used inside reward transactions. */
export interface BadgeTxDelegate {
  /** Batched lookup by code; preserves no particular order. */
  findMany(args: {
    where: { code: { in: string[] } };
  }): Promise<Array<{ id: string; code: string; name: string; icon: string }>>;
}

export interface UserBadgeTxDelegate {
  /**
   * Batched insert returning only the rows it actually created, so the caller
   * knows which badges it won against a concurrent award.
   */
  createManyAndReturn(args: {
    data: Array<{ userId: string; badgeId: string; userGamificationId: string }>;
    /** Concurrent inserts of the same badge must be a no-op, not a P2002. */
    skipDuplicates?: boolean;
  }): Promise<Array<{ badgeId: string }>>;
}

/** Transaction-scoped view of the gamification state stores. */
export interface GamificationTxClient {
  userGamification: UserGamificationTxDelegate;
  xpTransaction: XpTransactionTxDelegate;
  badge: BadgeTxDelegate;
  userBadge: UserBadgeTxDelegate;
}

export interface IGamificationTransactionService {
  /** Run the reward transaction; rollback on throw. */
  execute<T>(fn: (tx: GamificationTxClient) => Promise<T>): Promise<T>;
}
