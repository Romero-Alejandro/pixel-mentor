# Design: Gamification Audit & Improvements

## Technical Approach

The core of this design is to eliminate race conditions and data loss by introducing a user-specific locking mechanism and ensuring all state modifications are atomic. A new audit trail will be created to log every gamification event for traceability and debugging. The implementation will focus on refactoring the `GameEngineCore` and repository layers to be more robust and configurable.

## Architecture Decisions

### Decision: Pessimistic Locking Strategy

**Choice**: Per-user, in-process mutex queue. A `MutexManager` will be created to ensure that only one gamification-related operation for a specific user can be processed at a time within a single server instance.
**Alternatives considered**:
- **PostgreSQL Advisory Locks**: Provides distributed locking, but Prisma has no native support, adding complexity.
- **Redis-based Distributed Lock**: The most robust solution for a distributed environment, but adds a new infrastructure dependency (Redis) which is out of scope for this change.
- **Prisma Interactive Transactions with `SELECT ... FOR UPDATE`**: A valid database-level locking approach, but can be complex to manage and prone to errors if not handled carefully.
**Rationale**: The in-process mutex is a significant improvement that solves the immediate race condition problem within a single node. It's a pragmatic and proportionate solution that doesn't require new infrastructure. It provides a foundation that can be extended to a distributed lock if the application scales to multiple nodes in the future.

### Decision: Auditing Strategy

**Choice**: A new append-only table `GamificationAuditLog` will be created in the database using Prisma.
**Alternatives considered**:
- **Logging to a file or a logging service (Pino)**: This is good for debugging but not for transactional auditing. It's difficult to query and correlate with the application's state.
**Rationale**: A dedicated database table ensures that audit records are created atomically with the state changes they describe. This provides a reliable, queryable, and persistent source of truth for all gamification events, which is essential for debugging, reconciliation, and future analytics.

### Decision: Configuration Management

**Choice**: Centralize hardcoded values into a new file: `apps/api/src/features/gamification/config/gamification.config.ts`.
**Alternatives considered**:
- **Database `GamificationConfig` table**: More flexible and allows for dynamic changes without redeploying, but adds overhead for this stage.
**Rationale**: A configuration file is simple, version-controlled, and sufficient for the current needs. It removes magic numbers from the business logic, making the code cleaner and easier to maintain. This can be evolved into a database-backed solution later if needed.

## Data Flow

The data flow for processing a gamification event will be as follows:

```
                  ┌───────────────────┐
Domain Event ──>│  GameEngineCore   │
 (e.g.,         │ (Event Handler)   │
 LESSON_COMPLETED) └───────────────────┘
                       │
                       ▼
                  ┌───────────────────┐
                  │   MutexManager    │
                  │ acquireLock(userId)│
                  └───────────────────┘
                       │ (Serialized Execution)
                       ▼
                  ┌──────────────────────────────────┐
                  │ prisma.$transaction([             │
                  │   1. userGamificationRepo.addXP,   │
                  │   2. badgeRepo.awardBadges,        │
                  │   3. auditRepo.logEvent          │
                  │ ])                               │
                  └──────────────────────────────────┘
                       │
                       ▼
                  ┌───────────────────┐
                  │   MutexManager    │
                  │ releaseLock(userId)│
                  └───────────────────┘
                       │
                       ▼
                  ┌───────────────────┐
                  │     EventBus      │
                  │(Emit UI Events)   │
                  └───────────────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/api/prisma/schema.prisma` | Modify | Add the new `GamificationAuditLog` model. |
| `apps/api/src/features/gamification/config/gamification.config.ts` | Create | Centralize gamification-related constants and configuration. |
| `apps/api/src/features/gamification/application/services/mutex-manager.service.ts` | Create | Implement the per-user, in-process mutex logic. |
| `apps/api/src/features/gamification/domain/ports/gamification.ports.ts` | Modify | Add `IGamificationAuditRepository` port and update method signatures. |
| `apps/api/src/features/gamification/infrastructure/persistence/prisma-audit.repository.ts` | Create | Implement `IGamificationAuditRepository` to write audit logs to the database. |
| `apps/api/src/features/gamification/application/services/game-engine-core.service.ts` | Modify | Wrap event handlers in the mutex. Use a single transaction for all database writes. Log events to the audit trail. Use configuration for values. Fix event source bug. |
| `apps/api/src/features/gamification/infrastructure/persistence/prisma-user-gamification.repository.ts` | Modify | Refactor `addXP` and other state-modifying methods to use atomic Prisma operations (`increment`). Remove read-modify-write patterns. |
| `apps/api/src/features/gamification/infrastructure/persistence/prisma-badge.repository.ts` | Modify | Consolidate badge awarding logic to be more atomic if possible, and ensure it can run within an external transaction. |
| `apps/api/src/features/gamification/infrastructure/di/gamification.container.ts` | Modify | Inject the new `MutexManager` and `PrismaAuditRepository` into `GameEngineCore`. |

## Interfaces / Contracts

### `GamificationAuditLog` Prisma Model

```prisma
// in schema.prisma

model GamificationAuditLog {
  id        String   @id @default(cuid())
  userId    String
  eventType String   // e.g., 'XP_GAINED', 'BADGE_EARNED', 'STREAK_UPDATED'
  details   Json     // { "amount": 10, "source": "LESSON_COMPLETED", "reason": "Perfect score bonus" }
  createdAt DateTime @default(now())

  @@index([userId, createdAt])
}
```

### `IGamificationAuditRepository` Port

```typescript
// in gamification.ports.ts

export interface IAuditLogEntry {
  userId: string;
  eventType: string;
  details: Record<string, unknown>;
}

export interface IGamificationAuditRepository {
  logEvent(entry: IAuditLogEntry, tx?: Prisma.TransactionClient): Promise<void>;
  logEvents(entries: IAuditLogEntry[], tx?: Prisma.TransactionClient): Promise<void>;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | **MutexManager**: Correctly serializes promises for the same user and runs them in parallel for different users. | Jest tests with mock async functions and timers. |
| | **Repositories**: Atomic operations correctly update the database. | Jest tests with a mocked Prisma client to verify that `increment` is used instead of `update` with a calculated value. |
| | **Configuration**: Correctly loads and provides values. | Jest tests to ensure config values are accessible. |
| Integration | **`GameEngineCore`**: Concurrent events for the same user result in a correct final state (no data loss). | Jest integration tests using a real test database. Fire multiple events for the same user concurrently (e.g., using `Promise.all`) and then assert the final state of `UserGamification` and the `GamificationAuditLog`. |
| E2E | No new E2E tests required. Existing tests should continue to pass. | Existing Playwright tests for the gamification features. |

## Migration / Rollout

This change involves adding a new table (`GamificationAuditLog`) and modifying existing tables.

1.  A new Prisma migration will be generated (`pnpm --filter @pixel-mentor/api db:migrate`).
2.  The application code will be deployed.
3.  The changes are backward-compatible at the API level, so no special rollout plan is needed. The existing SSE events will continue to work as before.

## Open Questions

- [ ] Is the in-process mutex sufficient for the current expected load and infrastructure, or should a distributed lock be prioritized now? (Assumption: In-process is sufficient for now).
