-- Unique attempt numbering per (user, atom): concurrent attempts for the same
-- atom now fail with a unique violation instead of persisting a duplicate
-- attemptNo (which would corrupt first/last-attempt accuracy calculations).
-- Safe on an empty table; if legacy duplicates exist, deduplicate before applying.
CREATE UNIQUE INDEX "activity_attempts_userId_atomId_attemptNo_key" ON "activity_attempts"("userId", "atomId", "attemptNo");
