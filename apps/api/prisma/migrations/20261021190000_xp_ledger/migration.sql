-- CreateEnum
CREATE TYPE "XpSource" AS ENUM ('LESSON', 'BADGE', 'STREAK_DAILY', 'STREAK_MILESTONE', 'ADMIN_ADJUSTMENT');

-- CreateTable
CREATE TABLE "xp_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "source" "XpSource" NOT NULL,
    "sourceRef" VARCHAR(255) NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "xp_transactions_userId_createdAt_idx" ON "xp_transactions"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "xp_transactions_userId_source_sourceRef_key" ON "xp_transactions"("userId", "source", "sourceRef");

-- AddForeignKey
ALTER TABLE "xp_transactions" ADD CONSTRAINT "xp_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one ledger entry per existing balance so SUM(amount) = totalXP.
-- Users with totalXP = 0 need no entry.
INSERT INTO "xp_transactions" ("id", "userId", "amount", "source", "sourceRef", "balanceAfter", "createdAt")
SELECT gen_random_uuid()::text, ug."userId", ug."totalXP", 'ADMIN_ADJUSTMENT'::"XpSource", 'migration/f1-backfill', ug."totalXP", NOW()
FROM "user_gamification" ug
WHERE ug."totalXP" > 0;

-- AlterTable
ALTER TABLE "user_gamification" DROP COLUMN "level";
