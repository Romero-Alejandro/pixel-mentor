-- Backfill legacy attemptNo values (audit finding #5).
--
-- Rows written before attempt-activity computed attemptNo as (max + 1) all
-- carry attemptNo = 1, making "first attempt" (bonus XP flag) and "last
-- attempt" (mastery accuracy) indistinguishable in historical data.
--
-- Strategy: only touch (userId, atomId) groups where EVERY row has attemptNo
-- = 1 (idempotent: groups already backfilled or mixed are left untouched).
-- Within a group, renumber 1..n ordered by createdAt (then id as a
-- deterministic tie-breaker for same-timestamp rows).
--
-- The UPDATE re-checks the every-row-equals-1 predicate with EXISTS, so a
-- group mutated between CTE evaluation and the UPDATE is skipped rather than
-- double-numbered. This closes the concurrent-INSERT window; a concurrent
-- attemptNo UPDATE racing the sweep remains possible but no writer updates
-- attemptNo after creation (the use case only ever inserts), so it is
-- effectively unreachable.

DO $$
BEGIN
    -- Guard: only run when the expected columns exist (defensive, e.g. partially
    -- applied baselines or restored schemas). No-op otherwise.
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'activity_attempts'
          AND column_name IN ('userId', 'atomId', 'attemptNo', 'createdAt', 'id')
        HAVING COUNT(*) = 5
    ) THEN
        WITH groups_all_ones AS (
            SELECT "userId", "atomId"
            FROM activity_attempts
            GROUP BY "userId", "atomId"
            HAVING BOOL_AND("attemptNo" = 1) AND COUNT(*) > 1
        ),
        renumbered AS (
            SELECT
                a.id,
                ROW_NUMBER() OVER (
                    PARTITION BY a."userId", a."atomId"
                    ORDER BY a."createdAt", a."id"
                ) AS rn
            FROM activity_attempts a
            JOIN groups_all_ones g
              ON g."userId" = a."userId" AND g."atomId" = a."atomId"
        )
        UPDATE activity_attempts a
        SET "attemptNo" = r.rn
        FROM renumbered r
        WHERE a.id = r.id
          AND EXISTS (
              SELECT 1
              FROM activity_attempts a2
              WHERE a2."userId" = a."userId"
                AND a2."atomId" = a."atomId"
              HAVING BOOL_AND(a2."attemptNo" = 1)
          );
    ELSE
        RAISE NOTICE 'activity_attempts table or expected columns missing; skipping attemptNo backfill';
    END IF;
END $$;
