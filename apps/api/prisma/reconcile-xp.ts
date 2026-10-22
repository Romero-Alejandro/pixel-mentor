/**
 * XP ledger reconciliation.
 *
 * `UserGamification.totalXP` is a cache of `SUM(XpTransaction.amount)`.
 * This script reports (and fails on) any row where the cache and the ledger
 * disagree. It never writes: fixing is a deliberate decision.
 *
 * Usage:
 *   pnpm db:reconcile:xp
 */

import { PrismaClient } from '../src/database/client.js';

const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.userGamification.findMany({
    select: { userId: true, totalXP: true },
  });

  const grouped = await prisma.xpTransaction.groupBy({
    by: ['userId'],
    _sum: { amount: true },
  });
  const ledgerByUser = new Map(grouped.map((entry) => [entry.userId, entry._sum.amount ?? 0]));

  const mismatches = accounts
    .map((account) => ({
      userId: account.userId,
      cached: account.totalXP,
      ledger: ledgerByUser.get(account.userId) ?? 0,
    }))
    .filter((entry) => entry.cached !== entry.ledger);

  // A user with ledger entries but no cached row would also be a mismatch the
  // forward check cannot see (the ledger's FK points at users, not at the cache).
  const accountUserIds = new Set(accounts.map((account) => account.userId));
  const orphanedLedgerUsers = grouped
    .filter((entry) => !accountUserIds.has(entry.userId))
    .map((entry) => ({ userId: entry.userId, ledger: entry._sum.amount ?? 0 }))
    .filter((entry) => entry.ledger !== 0);

  // Every owned badge with an xpReward must have its BADGE ledger row for exactly
  // that amount. Badges awarded before the ledger existed never paid their XP,
  // and the award path skips badges the user already owns.
  const ownedBadges = await prisma.userBadge.findMany({
    select: { userId: true, badge: { select: { code: true, xpReward: true } } },
  });
  const badgeLedgerRows = await prisma.xpTransaction.findMany({
    where: { source: 'BADGE' },
    select: { userId: true, sourceRef: true, amount: true },
  });
  const paidByKey = new Map(
    badgeLedgerRows.map((row) => [`${row.userId}:${row.sourceRef}`, row.amount]),
  );
  const unpaidBadges = ownedBadges
    .filter((owned) => owned.badge.xpReward > 0)
    .map((owned) => ({
      userId: owned.userId,
      code: owned.badge.code,
      expected: owned.badge.xpReward,
      paid: paidByKey.get(`${owned.userId}:${owned.badge.code}`),
    }))
    .filter((entry) => entry.paid !== entry.expected);

  if (mismatches.length === 0 && orphanedLedgerUsers.length === 0 && unpaidBadges.length === 0) {
    console.log(`✅ ${accounts.length} gamification rows match the XP ledger`);
    console.log(`✅ ${ownedBadges.length} owned badges have their BADGE ledger row`);
    return;
  }

  if (mismatches.length > 0) {
    console.error(`❌ ${mismatches.length} of ${accounts.length} rows differ from the ledger`);
    for (const mismatch of mismatches) {
      console.error(
        `  user=${mismatch.userId} cached=${mismatch.cached} ledger=${mismatch.ledger}`,
      );
    }
  }

  if (orphanedLedgerUsers.length > 0) {
    console.error(`❌ ${orphanedLedgerUsers.length} users have XP in the ledger but no cached row`);
    for (const orphan of orphanedLedgerUsers) {
      console.error(`  user=${orphan.userId} ledger=${orphan.ledger}`);
    }
  }

  if (unpaidBadges.length > 0) {
    console.error(`❌ ${unpaidBadges.length} owned badges are missing their BADGE ledger row`);
    for (const badge of unpaidBadges) {
      console.error(
        `  user=${badge.userId} badge=${badge.code} expected=${badge.expected} paid=${badge.paid ?? 'none'}`,
      );
    }
  }

  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
