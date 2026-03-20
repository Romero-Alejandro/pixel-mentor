-- AlterTable
ALTER TABLE "users" ADD COLUMN     "cohort" VARCHAR(100) NOT NULL DEFAULT 'default';

-- CreateIndex
CREATE INDEX "users_cohort_idx" ON "users"("cohort");
