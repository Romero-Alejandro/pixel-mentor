# Gamification XP — ledger, derived level, declarative badges, real streaks, SSE (F1–F4)

Objective: make XP awarding work for every user (including fresh ones), make the
level derive from XP, guarantee idempotent awards, make badges declarative with
their `xpReward` actually paid, and derive streaks from a real activity calendar.
Branch: main (working tree already has uncommitted Fase 2 changes — not touched).
Delivered on `feat/gamification-xp` as two stacked PRs (#1 core, #2 audit FK).

## Specs

S1. `UserGamification.totalXP` is a cache; `XpTransaction` is the source of truth.
S2. Every award is idempotent per `(userId, source, sourceRef)`; an exact repeat must not
    change `totalXP` or create a second ledger row.
S3. A user with no gamification row must earn XP on the first award (no P2025).
S4. `level` is never stored; it derives from `LevelConfig.minXP` for the current `totalXP`.
    With an empty `level_configs` table, the catalog is the fallback.
S5. Level-up is detected by comparing the level for `totalXP - amount` and `totalXP`.
S6. No code path may write `totalXP` outside `AwardXpService` (badge XP bypass removed).
S7. `XpSource` values: LESSON, BADGE, STREAK_DAILY, STREAK_MILESTONE, ADMIN_ADJUSTMENT.
S8. Migration backfills one ADMIN_ADJUSTMENT row per user with `totalXP > 0`.

F2:
S9. Badges are awarded from the declarative `Badge.rules` in the database. No
    per-badge strategy class, registry, or factory exists.
S10. A badge's `xpReward` is paid through `AwardXpService` with `source: BADGE` and
     `sourceRef: <badge code>`. No other code writes badge XP.
S11. Awarding the same badge twice pays its XP once (ledger key) and creates exactly
     one `UserBadge` row (unique key), including under concurrent requests.
S12. A badge whose rule is unusable (unknown type, or `value <= 0`) is never awarded
     and never shown as progress, instead of appearing permanently unreachable.
S13. Awarding and progress read the same rule evaluator, and all six rule types
     (including `HINT_FREE_PERFECT_LESSONS` and `HIGH_PARTIAL_CREDIT_LESSONS`) work.
S14. The lesson XP formula is unchanged (tiers 50/50/30/10, +20 perfect, +10 assisted,
     +10 partial >= 80) and lives in one pure policy shared by the engine and the routes.
S15. The streak bonus is paid exactly once per login day.
S16. Badge rules are evaluated against the state produced by the event: lesson XP paid,
     streak recorded, lesson marked completed.

F3:
S17. `daily_activities` is the streak source of truth. The current streak is the run of
     consecutive UTC calendar days ending today or yesterday.
S18. `DAILY_LOGIN` is emitted by real touchpoints (login, lesson completion) and is
     idempotent per calendar day: a repeat records no second day and pays no second bonus.
S19. The streak bonus is paid once per calendar day (`STREAK_DAILY`, `sourceRef=YYYY-MM-DD`):
     10 XP from day 5 and 25 XP from day 30.
S20. A missed calendar day resets `currentStreak` to 1 and keeps `longestStreak`.
S21. A cached `currentStreak` whose last activity is older than yesterday reads as 0
     everywhere (profile and badge stats) without a write.
S22. STREAK badges are earned from the recomputed streak (3/7/30 consecutive days).
S23. No streak rule depends on an elapsed 24-hour window; only UTC calendar days count.

F4:
S24. Every SSE frame names its event (`event: <name>`) and repeats the name inside the
     JSON payload (`type`), so a client dispatches on the frame and logs stay readable.
S25. `xp_earned` carries the balance after the award (`newTotal`), not only the delta;
     `badge_earned` carries the badge's real `xpReward`; `level_up` carries the total XP
     that crossed the threshold.
S26. The web client dispatches on the frame's event name and falls back to the payload
     `type` when the frame arrives unnamed.

F5:
S27. `gamification_audit_logs` belongs to its user: a FK with `ON DELETE CASCADE` means
     deleting the account deletes its trail, like `daily_activities` and `user_badges`.
     No audit row may reference a user that does not exist.
S28. The audit repository is write-only: no read method exists on the port unless a
     feature consumes it.

## Tasks

- [x] T1 schema + migration (create XpTransaction, drop user_gamification.level, backfill) — inline
  - commit: uncommitted. `20261021190000_xp_ledger` applied; 7 migrations in sync.
- [x] T2 LevelService derives level from config/catalog — inline
  - `describe()` is the single calculation; async constructor and duplicate thresholds removed.
- [x] T3 AwardXpService + tx port — inline
  - ensure-account upsert, dedupe read, increment, ledger insert, P2002 race handling.
- [x] T4 repository reads derive level; getOrCreate/updateStreak/breakStreak upsert — inline
- [x] T5 GameEngineCore uses AwardXpService; fresh-user fix; events after commit — inline
- [x] T6 remove badge XP writer (BadgeEngine write path + awardBadgeWithXP) — inline
- [x] T7 tests: award idempotency, fresh user, level-up, empty config fallback — inline
- [x] T8 seed badges/levels, verify migration, typecheck + suites — inline

F2:
- [x] T9 `domain/lesson-xp.policy.ts` owns the formula; strategy test cases ported — inline
  - S14. `calculateLessonXp` adapts the event payload; routes/use case import the policy.
- [x] T10 `BadgeRuleEvaluator` interprets `Badge.rules` with one metrics batch — inline
  - S12, S13. All six rule types; unusable rule → `null`.
- [x] T11 `BadgeAwardService` awards satisfied badges and pays `xpReward` via the ledger — inline
  - S10, S11. Pay-then-create so a crash between steps self-heals.
- [x] T12 `GameEngineCore` rewired: no registry, fixed evaluation order, single streak bonus — inline
  - S15, S16.
- [x] T13 delete `application/strategies/**` and prune the tx port to used delegates — inline
  - S9.
- [x] T14 `BadgeProgressCalculator` reuses the evaluator (no N+1, no duplicated rules) — inline
  - S13.
- [x] T15 race-safe account creation + E2E probe + reconcile badge check — inline
  - S11. `getOrCreate` swallows the P2002 of a concurrent insert; the ledger tx no longer creates rows.

F3:
- [x] T16 daily-activity port/repo reads the calendar and records a day race-free — inline
  - S17, S19. `getActivityDates(since)`; `createMany({ skipDuplicates: true })`.
- [x] T17 `StreakService` derives the streak from the calendar; dead read methods removed — inline
  - S17, S20, S23. `isStreakBroken`, `IClock`, `getCurrentStreak`, `isStreakActive`,
    `getStreakInfo`, `getLongestStreak` and `breakStreak` deleted (nothing called them).
- [x] T18 `emitDailyLogin` wired to login and both lesson paths, before `LESSON_COMPLETED` — inline
  - S18, S22. Badge rules read a streak that already includes today.
- [x] T19 repository normalizes a stale cached streak on read — inline
  - S21. `normalizeCurrentStreak` in `mapToProfile` and `getProfileStats`.
- [x] T20 streak + calculator tests and a real-DB E2E probe — inline
  - 22/22 E2E checks.

F4:
- [x] T21 SSE contract: named frames, real balances and badge XP, client dispatch — inline
  - S24, S25, S26. `formatSSEFrame` exported and unit-tested; `BadgeEarnedPayload.xpReward`
    and `LevelUpPayload.newTotalXP` added; vestigial `requestVersion`/`version` guards removed
    from the web store and hook.

F5:
- [x] T22 audit log FK with cascade + orphan purge + dead read methods removed — inline
  - S27, S28. Migration `20261021203000_audit_log_user_fk`. `Risk: item 1` (migration
    that deletes 20 orphan rows and adds a cascade delete).
  - commit: 4dfd063.

## Log

L1 (user): "Vamos con F1"
L2: DB reachable (localhost:5432), 6 migrations applied, 11 users, 3 gamification rows
 (all totalXP=0), 0 level_configs, 0 badges. Gamification seed was never executed.
L3: Chose to keep `UserGamification` as a cached aggregate (totalXP/streak) and drop only
 `level`, because streak fields are still used until F3. Ledger + unique key is the
 source of truth; a reconcile script checks the cache.
L4: Migration generated with `migrate diff` (migrate dev is interactive here), applied with
 `migrate deploy`. `prisma generate` refreshed the checked-in client.
L5: Ran `db:seed:gamification`: 7 badges + 6 levels now exist (the table was empty, which
 on its own made every badge impossible to earn).
L6: End-to-end check against the real DB on a user with no gamification row:
 award 90 → total 90 / level 1; identical repeat → duplicate, total unchanged; +20 →
 total 110 / level 2 "Brote"; ledger sum 110 == cached totalXP 110. State restored afterwards.
L7: Fixed the pre-existing Fase 2 typecheck error by adding the two missing methods to the
 attempt-activity test mock. `HIGH_PARTIAL_CREDIT_MIN_SCORE` disappeared with the removed
 BadgeEngine write path.
L8: Verification — API typecheck clean; 57 suites / 1085 tests pass (1 suite skipped,
 pre-existing); ESLint clean on every touched file; `db:reconcile:xp` reports 3/3 rows match.
L9: Not committed (user has not asked for commits); Fase 2 work left untouched.
L10: Independent verifier (gentle-ai-verify): PASS, no blockers. Advisories closed:
 - badge insert now uses `createMany({ skipDuplicates: true })`, so concurrent awards of the
   same badge are a no-op instead of a P2002 that would lose the badge.
 - `db:reconcile:xp` also flags ledger XP for users without a cached row.
 - added the "starts exactly on a threshold is not a level-up" test.
 Remaining advisory (accepted): `XP_CHANGED.source` now carries `LESSON`/`DAILY_LOGIN`
 instead of the hardcoded `LESSON_COMPLETED`; the only in-repo consumer is the broken SSE
 hook, which ignores the field.
L11: Final verification — API typecheck clean; 57 suites / 1086 tests pass; ESLint clean on
 every F1 file; migration diff against the live DB is empty; reconcile 3/3.

L12 (user): "Vamos con la fase siguiente" → F2 (medallas declarativas + pago real del `xpReward`).
L13: Read the strategy set before deleting it. Two real bugs found and fixed by construction:
 the streak bonus was paid twice (`StreakResult.bonusXP` + an identical `StreakBonusStrategy`),
 and badges were evaluated before `markLessonAsMastered`, so a `LESSON_COUNT` rule was always
 one lesson behind.
L14: Design: rules are data, so awarding is `candidates = active badges - owned`, evaluated
 against one metrics batch. Award order is XP → mark lesson → badges, so every rule sees the
 state the event produced. Badge XP paid before the `UserBadge` row is created: both steps are
 idempotent, so a crash between them heals on the next event; the reverse order would lose XP.
L15: `createManyAndReturn({ skipDuplicates: true })` answers "did I win the race?" from the
 database; a badge lost to a concurrent award is not announced by this request.
L16: Lesson XP moved verbatim to `domain/lesson-xp.policy.ts`; the three dynamic imports in
 `orchestrate-recipe.use-case.ts` and the import in `gamification.routes.ts` now use it.
 `Reward.description` died with the strategies (nothing persisted or displayed it).
L17: E2E against the real DB (throwaway users, deleted afterwards): 21/21 checks. Lesson 70 XP +
 FIRST_LESSON 10 → total 80; repeat is a no-op; streak 7 → STREAK_3 + STREAK_7 (+75) → level 2;
 level 5 → LEVEL_5 (+100); two concurrent awards → one badge row and one payout; ledger sum
 equals the cache at every step.
L18: The E2E exposed a bug unit tests could not: Prisma emulates `upsert` with an empty update,
 so two concurrent first awards for the same user both INSERT and one gets P2002 — which
 `AwardXpService` classified as a duplicate award and silently dropped the XP. Account creation
 now happens before the transaction (`getOrCreate` swallows the race P2002) and the transaction
 only increments + inserts the ledger row. Covered by `data/prisma-error.ts`.
L19: `db:reconcile:xp` now also flags owned badges whose `BADGE` ledger row is missing or has a
 different amount (legacy badges awarded before F2 never paid their XP). Read-only.
L20: Removed `userGamification.upsert`, `badge.findUnique` and the four unused `userBadge`
 delegates from the transaction port.
L21: Verification — API typecheck clean; full suite 60 passed / 1 skipped pre-existing,
 1118 passed / 5 skipped (was 1086); ESLint clean; reconcile 4 rows + 0 unpaid badges;
 DB restored to 11 users / 3 gamification rows / 0 ledger rows / 0 user badges / 7 badges / 6 levels.
L22: Not committed (no commit requested). Open for a later phase: `DAILY_LOGIN` is still never
 emitted (streaks stay 0 in practice), the SSE frame lacks the `event:` line, and existing
 `user_badges` rows (none in this DB) would need a one-off backfill if their XP was never paid.

L23 (user): "yes" → F3 (rachas reales + emitir `DAILY_LOGIN`).
L24: Root cause of the flat streaks: `DailyActivity` was write-only (nothing read it back),
 `calculateStreakFromActivities` was exported but unused, and no production code emitted
 `DAILY_LOGIN`. Absorbed the calendar read/write in `PrismaDailyActivityRepository`.
L25: Design: `daily_activities` is the source of truth and the counter is a cache, same shape
 as XP/level. `recordActivity` recomputes from the calendar, so a missed day, a timezone
 boundary or a duplicated event cannot drift the number. The window is 400 days, growing with
 the user's own record so a long streak is never capped.
L26: Deleted the 24-hour rule (`isStreakBroken`) and `STREAK_CONFIG`: it broke a streak on
 23:59 → 00:01 the next day. Missing a *calendar day* is the only thing that resets it.
L27: `recordActivity` used check-then-create on a unique key; replaced with
 `createMany({ skipDuplicates: true })` so two requests on the same day cannot race into P2002.
L28: `DAILY_LOGIN` is emitted from `LoginUseCase` and, before `LESSON_COMPLETED`, from both
 lesson-completion paths; the event is idempotent per day. Order matters: the streak is fresh
 when the badge rules run, otherwise a streak badge is always one day behind.
L29: Reads now normalize a stale cached streak (`normalizeCurrentStreak`): a row whose last
 activity is older than yesterday reports 0 in the profile and in `getProfileStats`, so a
 broken streak can no longer award a STREAK badge.
L30: Deleted `breakStreak` (service, port and repo) and the unused streak read methods: nothing
 called them, and `breakStreak` would have fought the calendar as source of truth.
L31: E2E against the real DB (throwaway users, deleted afterwards): 22/22. First day → streak 1,
 no bonus; same day twice → one calendar day, no second payout; six seeded days + today →
 streak 7, STREAK_3 + STREAK_7 (+75) plus the 10 daily bonus, ledger sum == cache; a three-day
 gap → streak 1, record 3, no payout; a cached streak 10 days old reads as 0; `emitDailyLogin`
 drives the same path through the global bus.
L32: Verification — API typecheck clean; 62 suites / 1140 tests (5 skipped pre-existing);
 ESLint clean. Not committed (no commit requested).
L33: Known follow-ups: `GamificationAuditLog` has no FK to `User`, so audit rows survive user
 deletion (the E2E deletes them explicitly; whether they should survive is a product call).
 The SSE frame still lacks the `event:` line, so the web never receives these events.
L34: F4 — the SSE stream was structurally broken in three ways, not one. (a) The frame wrote
 only `data:`, so `event.event` was `''` in the client and every message fell into `default`:
 the feature never worked. (b) The client fed `amount` (the delta, e.g. 70) into the store as
 `totalXP`, so even a working dispatch would have shown a balance of 70 instead of 150. (c)
 The route hardcoded `badge.xpReward = 0` and omitted `level_up.totalXP` entirely, because
 `BadgeEarnedPayload`/`LevelUpPayload` did not carry them. Fix: `formatSSEFrame` emits
 `event: <type>` plus a self-describing JSON body; both payloads gained the missing field
 (additive, no consumer breaks); the client dispatches on `frame.event` with the payload
 `type` as fallback. Also deleted the `requestVersion` / `version` "race prevention" in the
 store: `requestVersion` was initialized to 0 and never incremented anywhere, so every guard
 compared against 0 and could never drop an event — dead code that made the contract look
 safer than it was.
L35: Verification — API typecheck, web typecheck and both ESLint runs clean. New tests:
 `formatSSEFrame` (5 cases, asserts the frame starts with `event:`, not `data:`) and the
 `useGamificationSSE` dispatch (5 cases: new-balance vs delta, badge passthrough, unnamed-frame
 fallback, level-up total, unknown event ignored). Full API suite 63 suites / 1145 tests;
 web 20 files / 199 tests. Real SSE E2E over HTTP (`fetch` + stream reader, throwaway user):
 10/10 — content type, four named frames, payload `type` matching the frame name, streak 5,
 badge STREAK_3 with `xpReward: 25`, daily bonus delta 10 / balance 10, badge XP delta 25 /
 balance 35. DB restored to baseline (11 users, 3 gamification rows, 0 ledger, 0 user badges).
 Not committed (no commit requested).

L36 (user): "Aplica lo sugerido" → commits, then F5.
L37: Commit boundary. Slicing F0–F4 apart from the in-flight activity-grading work is not
 possible at hunk level: `lesson-xp.policy.ts` is a new file that already contains that
 work's hint-aware bonus and partial credit, and `gamification.routes.ts` calls it with the
 extended signature. Verified before deciding, so the choice is data-backed: one commit
 (`9ae3a42`, 123 files) carrying both efforts, with a body that enumerates F0–F4 and says why
 the activity-grading work rides along. Branch `feat/gamification-xp` off `main` (`401d49a`),
 nothing pushed.
L38: F5 — audit rows had no FK, so `AdminUserService.deleteUser` (`prisma.user.delete`) left
 rows whose `userId` pointed at nothing: personal data retained, unaddressable, and invisible
 because nothing reads the log. 20 such rows already existed, all written today by my own
 F2/F3 probes (LESSON_COMPLETED 8, DAILY_LOGIN 12, 250 phantom XP). Purged them inside the
 migration (before the constraint, otherwise it cannot be applied) after asking the user, since
 it is an irreversible delete. Also removed `getLogsByUserId`/`getLogsByEventType`: declared on
 the port, implemented, called by nobody.
L39: Verification — migration `20261021203000_audit_log_user_fk` applied; cascade proven
 against the real DB (create user → 2 audit rows → delete user → 0 rows); FK delete rule is
 CASCADE; 0 orphan rows left; API typecheck, ESLint and 63 suites / 1145 tests green.
 Risk: item 1 (migration + cascade delete).
L40: Independent verifier (gentle-ai-verify) on `9ae3a42..4dfd063`: PASS with advisories, no
 blockers. It independently proved the cascade and that the FK rejects a non-existent user
 (P2003), confirmed no drift, and confirmed the audit write path is byte-identical to baseline.
 Advisories accepted: `badgesAwarded` has always been stored double-encoded (a jsonb string)
 and predates this unit — nothing reads it now that the read methods are gone; and the
 migration's orphan purge is irreversible by design (0 rows on this DB). No regression test was
 added: the durable assertions are database-level (the repo only keeps skipped integration
 placeholders) and the two unit tests proposed would pin either an over-fit method list or the
 known double-encoding.
L41: RDD preflight over `401d49a..4dfd063` returned `high_risk` (auth hot path, 125 files,
 12,550 lines). Consent was relayed verbatim and the user declined the review for this
 candidate (`declined_this_candidate`, no review record created). STATUS keeps re-offering the
 same target, which is expected for a candidate-scoped decline; it was not re-asked. Delivery
 stays with ordinary repository policy: two commits on `feat/gamification-xp`, nothing pushed.
L42: Delivery (user: "Limpia, push y PRs"). Scratch from the verifier removed with explicit
 consent. Strategy: stacked PRs to `main`, one honest slicing pass, two slices.
 - `feat/gamification-xp-core` @ 9ae3a42 → PR #1, base `main`, 116 authored files / 9,268
   changed lines (generated Prisma client excluded from the budget).
 - `feat/gamification-xp` @ 021fff4 → PR #2, base `feat/gamification-xp-core`, 5 authored
   files / 136 changed lines.
 PR #1 is far over the 400-line budget and cannot shrink further: the smallest cohesive unit is
 the whole gamification rework plus the activity-grading work its shared policy file belongs to.
 `size:exception` is requested in the PR body with a recommended review order.
