-- Gamification audit rows now belong to the user they describe.
--
-- Before this constraint, deleting a user left its audit rows behind with a
-- `userId` that pointed at nothing: no FK to cascade, no way to find them, and
-- personal data retained for an account that no longer exists.
--
-- Existing rows are purged first: any row whose user is already gone is orphaned
-- test residue from a deleted account and can never be read again.

DELETE FROM "gamification_audit_logs" l
WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = l."userId");

-- AddForeignKey
ALTER TABLE "gamification_audit_logs" ADD CONSTRAINT "gamification_audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
