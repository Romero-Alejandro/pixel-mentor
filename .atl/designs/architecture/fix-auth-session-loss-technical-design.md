# Technical Design: Fix Auth Session Loss

**Change:** `fix-auth-session-loss`  
**Date:** 2026-03-15  
**Author:** SDD Design Agent  
**Spec Topic Key:** `sdd/fix-auth-session-loss/spec`  
**Design Topic Key:** `architecture/fix-auth-session-loss-technical-design`

---

## Executive Summary

This design solves the race condition between Zustand's asynchronous hydration and React Router's ProtectedRoute component. The issue occurs when a user with a valid token in localStorage navigates to a protected route: Zustand hasn't hydrated yet, `isAuthenticated` is false by default, and the route guard redirects to login before the token can be validated.

**Solution:** Introduce hydration state tracking with an `isHydrated` flag, automatically trigger `checkAuth()` after hydration, and make route guards wait for hydration before deciding whether to redirect.

**Impact:**

- Modified files: `authStore.ts`, `App.tsx`
- No breaking changes to public API
- Adds 1 new state field and 1 loading state adjustment
- Performance: single additional async check on page load

---

## 1. Architecture Decisions

### 1.1 Chosen Approach: Hydration Flag + Auto-Check

**Decision:** Add `isHydrated: boolean` to auth store state, use Zustand's `onHydrate` callback to trigger `checkAuth()` automatically, and update route guards to check hydration status.

**Why this approach:**

- **Minimal invasive changes**: Only modifies auth store and App component
- **Automatic**: No need to manually call hydration check in every route or component
- **Leverages Zustand API**: Uses official `onHydrate` middleware option
- **Clear state semantics**: Distinguishes between "not hydrated" vs "not authenticated"
- **No extra network request**: Reuses existing `checkAuth()` which already validates token

**Alternatives Considered:**

| Alternative                         | Pros                                    | Cons                                                   |
| ----------------------------------- | --------------------------------------- | ------------------------------------------------------ |
| **Manual hydration check in App**   | Explicit control, no Zustand dependency | Requires manual call, easy to forget, adds boilerplate |
| **Higher-Order Component wrapper**  | Reusable pattern                        | Adds complexity, nested components, less intuitive     |
| **Persist middleware override**     | Deep integration                        | Fragile, depends on internal Zustand implementation    |
| **Loading overlay until hydration** | User-friendly                           | Doesn't solve root cause, may block UI unnecessarily   |

**Key Insight:** The race condition exists because route guards execute during the first render, before Zustand's persisted state has been rehydrated from localStorage. The fix must ensure that route guards defer their logic until hydration completes.

---

## 2. State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                     Auth Store State Machine                   │
├─────────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐                                             │
│  │ UNINITIALIZED│ (default, before hydration)                │
│  │ isHydrated: false                                          │
│  │ isAuthenticated: false                                    │
│  │ isValidating: false                                        │
│  └──────┬──────┘                                             │
│         │                                                    │
│         │ persist middleware hydrates from localStorage      │
│         ▼                                                    │
│  ┌─────────────┐                                             │
│  │  HYDRATED   │ (hydration complete, async check pending)  │
│  │ isHydrated: true                                          │
│  │ isValidating: false                                      │
│  │ isAuthenticated: false (still unknown)                   │
│  └──────┬──────┘                                             │
│         │                                                    │
│         │ onHydrate callback → checkAuth() triggered         │
│         ▼                                                    │
│  ┌─────────────┐                                             │
│  │ VALIDATING  │ (API call in progress)                      │
│  │ isValidating: true                                        │
│  │ isAuthenticated: false (pending)                         │
│  └──────┬──────┘                                             │
│         │                                                    │
│         ├───────────────────────┬────────────────────────────┤
│         │                       │                            │
│         ▼                       ▼                            │
│  ┌─────────────┐        ┌─────────────┐                   │
│  │ AUTHENTICATED│        │  UNAUTHENTICATED │               │
│  │ isAuthenticated: true   │ isAuthenticated: false         │
│  │ token present   │        │ token cleared           │
│  └───────────────┘        └───────────────┘                   │
│                                                               │
└─────────────────────────────────────────────────────────────────┘
```

**State Transitions:**

1. **UNINITIALIZED → HYDRATED**: Zustand persist middleware hydrates state from localStorage
2. **HYDRATED → VALIDATING**: `onHydrate` triggers `checkAuth()`, sets `isValidating = true`
3. **VALIDATING → AUTHENTICATED**: API call succeeds, token valid
4. **VALIDATING → UNAUTHENTICATED**: API call fails or no token, clears auth state
5. **Any state → UNAUTHENTICATED**: User logs out manually

---

## 3. TypeScript Types and Interfaces

### 3.1 Updated AuthState

```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean; // NEW: tracks Zustand hydration completion
  isValidating: boolean; // NEW: tracks auth check in progress
  isLoading: boolean; // existing: tracks login/register operations
  error: string | null;

  // actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role: Role) => Promise<void>;
  checkAuth: () => Promise<void>;
  logout: () => void;
  clearError: () => void;
  setAuth: (user: User, token: string) => void;

  // NEW: internal hydration marker (not exposed in public API)
  _setHydrated: (hydrated: boolean) => void;
}
```

### 3.2 Route Guard Props (optional enhancement)

```typescript
interface RouteGuardProps {
  children: React.ReactNode;
  /** Show custom loading component while hydration/validation completes */
  loadingComponent?: React.ReactNode;
  /** Fallback route if not authenticated (defaults to /login) */
  fallback?: string;
}
```

---

## 4. Component/Structure Changes

### 4.1 authStore.ts Modifications

**Changes:**

1. Add `isHydrated` and `isValidating` fields to state
2. Add `_setHydrated` action (internal use only)
3. Modify `checkAuth()` to set `isValidating` during API call
4. Add `onHydrate` callback to persist middleware to trigger auto-check
5. Reset hydration on logout (optional, forces re-check on next page load)

**Implementation Strategy:**

- Keep `isHydrated` default as `false` (matches Zustand's pre-hydration state)
- Use zustand/middleware's `onHydrate` option: `onHydrate: () => store.getState()._setHydrated(true)`
- Within `onHydrate`, dispatch `checkAuth()` (async, doesn't block hydration flag)
- Route guards will use `isHydrated && isAuthenticated` logic

**Code Sketch:**

```typescript
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isHydrated: false, // NEW
      isValidating: false, // NEW
      isLoading: false,
      error: null,

      _setHydrated: (hydrated) => set({ isHydrated: hydrated }), // NEW

      checkAuth: async () => {
        const token = getToken();
        if (!token) {
          set({ isAuthenticated: false, user: null, token: null, isValidating: false });
          return;
        }
        set({ isValidating: true }); // NEW
        try {
          const { user } = await api.getCurrentUser();
          set({ user, token, isAuthenticated: true, isValidating: false });
        } catch {
          clearToken();
          set({ user: null, token: null, isAuthenticated: false, isValidating: false });
        }
      },

      // ... other actions unchanged, but logout should reset hydration:
      logout: () => {
        clearToken();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isHydrated: false, // NEW: force re-hydration check on next load
          isValidating: false,
        });
      },

      // ... existing setAuth, login, register remain similar
      // Make sure login/register set isHydrated: true (since they set token)
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token }),
      onHydrate: () => {
        // This runs after Zustand hydrates from localStorage
        const store = useAuthStore.getState();
        store._setHydrated(true);
        // Trigger async auth check (don't await - let it run in background)
        store.checkAuth().catch(() => {
          // Error handled in checkAuth itself
        });
      },
    },
  ),
);
```

**Note:** The `onHydrate` callback runs synchronously after hydration. We set `isHydrated` immediately so route guards can proceed, and `checkAuth()` runs asynchronously. If `checkAuth()` fails later, `isAuthenticated` will be set to false, but route guards won't re-evaluate automatically (acceptable: user will encounter "unauthorized" on next navigation or manual state check).

### 4.2 App.tsx Modifications

**Changes:**

1. Update `ProtectedRoute` to wait for `isHydrated` before checking `isAuthenticated`
2. Update `PublicRoute` similarly
3. Add optional loading UI while `!isHydrated` or `isValidating`

**Implementation Strategy:**

- Show a minimal loading indicator during hydration/validation (spinner or splash screen)
- Use `isHydrated` to prevent premature redirects
- Optionally use `isValidating` to show "checking authentication..." during API call

**Code Sketch:**

```tsx
import { useAuthStore } from './stores/authStore';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isHydrated, isAuthenticated, isValidating } = useAuthStore();

  // Wait for hydration before deciding
  if (!isHydrated || isValidating) {
    return <LoadingSpinner message="Checking authentication..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isHydrated, isAuthenticated, isValidating } = useAuthStore();

  if (!isHydrated || isValidating) {
    return <LoadingSpinner message="Loading..." />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
```

**LoadingSpinner Component:** Create a simple spinner component or use existing UI library. Should be minimal to avoid blocking initial paint too long. Display for max ~2 seconds before fallback.

---

### 4.3 Optional: Global Hydration Hook

For better reusability, create a custom hook:

```typescript
// src/hooks/useAuthHydration.ts
import { useAuthStore } from '../stores/authStore';
import { useEffect } from 'react';

export function useAuthHydration() {
  const { isHydrated, isValidating } = useAuthStore();

  useEffect(() => {
    // Could be used to track hydration lifecycle in analytics or global components
    if (isHydrated) {
      console.log('Auth store hydrated');
    }
  }, [isHydrated]);

  return { isHydrated, isValidating };
}
```

---

## 5. Loading State Strategy

### 5.1 When to Show Loading

| Condition                                         | UI Behavior                                               |
| ------------------------------------------------- | --------------------------------------------------------- |
| `!isHydrated`                                     | Show "Loading..." (spinner) - Zustand hasn't hydrated yet |
| `isHydrated && isValidating`                      | Show "Checking authentication..." - API call in progress  |
| `isHydrated && !isValidating && !isAuthenticated` | Redirect to /login (or show public route content)         |
| `isHydrated && !isValidating && isAuthenticated`  | Render protected content                                  |

### 5.2 Loading Duration Expectations

- Hydration: Typically < 100ms from localStorage
- Token validation: Depends on network, expect 200-2000ms
- **Total wait time**: ~500-2500ms worst-case

### 5.3 Fallback Behavior

If validation takes > 5 seconds, show timeout message with "Retry" button that re-triggers `checkAuth()`.

---

## 6. Error Handling Flow

### 6.1 Auth Validation Errors

```typescript
// In checkAuth():
try {
  const { user } = await api.getCurrentUser();
  set({ user, token, isAuthenticated: true, isValidating: false });
} catch (error) {
  // Token invalid or network error
  clearToken();
  set({
    user: null,
    token: null,
    isAuthenticated: false,
    isValidating: false,
    error: error instanceof Error ? error.message : 'Authentication failed',
  });
  // Route guards will redirect on next render
}
```

### 6.2 Network Errors During checkAuth()

- **Retry logic**: Not built-in; user can manually refresh page to retry
- **Persistent error state**: `error` field populated, cleared on next `checkAuth()` attempt
- **UI consideration**: Route guards will transition from loading → unauthenticated, causing redirect. No need to show error on protected pages (user should not have access anyway).

### 6.3 Edge Cases

| Scenario                                     | Handling                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------ |
| User closes browser during validation        | State remains `isValidating: true`, but on next page load, hydration restarts fresh  |
| localStorage.clear() while app running       | Zustand persist detects removal? (unlikely) - manual `logout()` already clears state |
| Multiple rapid navigations during validation | Each route guard checks same store state; consistent behavior                        |
| Token expired but still in localStorage      | `checkAuth()` detects 401, clears token, redirects to login                          |

---

## 7. Migration Plan

### 7.1 Backward Compatibility

**No breaking changes** to existing API:

- All existing action methods (`login`, `register`, `logout`, `checkAuth`) preserve signatures
- New fields (`isHydrated`, `isValidating`) are internal state only
- `_setHydrated` is semi-private (underscore convention) but technically accessible (necessary for onHydrate callback)

**Existing consumers unaffected:**

- Components that only use `isAuthenticated`, `user`, `token`, `isLoading` continue to work
- The added loading state in route guards is a new UX improvement, not a breaking change
- No changes to API service layer

### 7.2 Step-by-Step Migration

1. **Phase 1 - Store Update** (this change):
   - Modify `authStore.ts` to add `isHydrated`, `isValidating`, `_setHydrated`
   - Add `onHydrate` to persist middleware
   - Update `checkAuth()` to manage `isValidating`
   - Update `logout()` to reset `isHydrated`
   - **Testing**: Existing unit tests pass with additional state fields (add new tests for hydration behavior)

2. **Phase 2 - Route Guard Update** (this change):
   - Modify `ProtectedRoute` and `PublicRoute` to check `isHydrated` and show loading
   - Create `LoadingSpinner` component (or use existing UI)
   - **Testing**: Manual verification of protected routes with valid/invalid tokens

3. **Phase 3 - Testing**:
   - Add unit tests for new state transitions
   - Add integration tests using webapp-testing to simulate:
     - Page load with valid token → should land on protected page
     - Page load with invalid token → should redirect to login
     - Page load without token → public routes work, protected redirects
   - Run full test suite with `pnpm --filter @pixel-mentor/web test`

4. **Phase 4 - Deployment**:
   - Deploy to staging, verify in real browser (not just SSR/SSG)
   - Monitor auth-related error logs for edge cases
   - No database migrations needed

### 7.3 Rollback Plan

If issues arise:

1. Revert `authStore.ts` changes (remove `isHydrated`, `isValidating`, `onHydrate`)
2. Revert `App.tsx` route guard loading conditions
3. System returns to original behavior (pre-hydration redirect issue)

**Note:** Rollback is simple because changes are isolated to two files.

---

## 8. Testing Strategy

### 8.1 Unit Tests (authStore.test.ts additions)

```typescript
describe('hydration behavior', () => {
  it('should set isHydrated to false initially', () => {
    const state = useAuthStore.getState();
    expect(state.isHydrated).toBe(false);
  });

  it('should set isHydrated to true on hydrate', () => {
    // Simulate Zustand hydration by calling _setHydrated
    useAuthStore.getState()._setHydrated(true);
    expect(useAuthStore.getState().isHydrated).toBe(true);
  });

  it('should set isValidating to true during checkAuth', async () => {
    localStorage.setItem('token', 'valid-token');
    useAuthStore.setState({ token: 'valid-token', isHydrated: true });
    (api.getCurrentUser as Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          // Check state before promise resolves
          setTimeout(() => resolve({ user: mockUser }), 100);
        }),
    );

    const checkAuthPromise = useAuthStore.getState().checkAuth();

    // Immediately check state
    expect(useAuthStore.getState().isValidating).toBe(true);

    await checkAuthPromise;
    expect(useAuthStore.getState().isValidating).toBe(false);
  });

  it('should reset isHydrated on logout', () => {
    useAuthStore.setState({ isHydrated: true, isAuthenticated: true });
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().isHydrated).toBe(false);
  });
});
```

### 8.2 Integration Tests (webapp-testing)

Simulate browser scenarios:

1. **Valid token persists**: Set localStorage token, reload page → should land on dashboard
2. **Invalid token**: Set localStorage token, mock API 401 → should redirect to login
3. **No token**: Clear localStorage, try /dashboard → redirect to login
4. **Login flow**: Login → token set → navigate to protected route → no redirect loop

---

## 9. Performance Considerations

- **Memory**: +2 boolean fields per store (negligible)
- **Network**: No extra requests; `checkAuth()` already called manually in some flows
- **Hydration latency**: `onHydrate` runs sync, `checkAuth()` async → no blocking
- **Render cycles**: Route guards may render loading state once extra (acceptable)
- **Zustand compat**: Works with Zustand v4+ persist middleware

---

## 10. Risks and Mitigations

### 10.1 Design-Level Risks

| Risk                                                              | Probability | Impact | Mitigation                                                                                                                                                         |
| ----------------------------------------------------------------- | ----------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `onHydrate` not called in some edge cases (SSR, rapid navigation) | Low         | Medium | Already `isHydrated` default false, route guards show loading indefinitely if hydration never completes → user can refresh                                         |
| `checkAuth()` called multiple times (race)                        | Medium      | Low    | Idempotent; multiple calls safe but could cause extra API calls. Could add guard `if (isHydrated && !isValidating)`.                                               |
| Loading spinner flashes briefly on every page load                | Medium      | Low    | Acceptable for correctness. Could optimize by checking if token exists before showing spinner? But hydration still async.                                          |
| Token cleared in localStorage but store still hydrated            | Low         | Medium | `checkAuth()` clears token if invalid. Race still possible: user clears localStorage between navigation and checkAuth. Acceptable - invalid token leads to logout. |
| TypeScript types not enforced in persist middleware partialize    | Low         | Low    | Review ensure partialize doesn't strip new fields. Currently only `token` is partialized, new fields are internal and initialized by store.                        |

### 10.2 Implementation Risks

- **Mis-typing field names**: Ensure `isHydrated` and `isValidating` added to both interface and store implementation
- **Forgetting to update route guards**: Both `ProtectedRoute` and `PublicRoute` must be updated
- **Infinite loading**: If `checkAuth()` never resolves (network offline), `isValidating` remains true → loading forever. Should add timeout in future but out of scope for this fix.
- **SSR hydration mismatch**: This is a client-side only app (React SPA), no SSR concerns.

---

## 11. Monitoring & Observability

**No new metrics required**, but consider:

- Logging `auth.check_auth.duration` to measure validation latency
- Tracking `auth.redirect_to_login` events (already possible)
- Alert on high `isValidating` duration (> 5s)

---

## 12. Open Questions (Out of Scope)

- Should `checkAuth()` be debounced if called multiple times? (No, called once on hydration)
- Should there be a global "auth hydration" context for other components? (Not needed)
- Should we persist `isHydrated` flag? (No, it's transient; should reset on page load)
- Token refresh / silent re-authentication? (Separate feature)

---

## 13. References

- **Spec**: `sdd/fix-auth-session-loss/spec` (engram topic_key)
- **Auth Store**: `apps/web/src/stores/authStore.ts`
- **App Component**: `apps/web/src/App.tsx`
- **Zustand Persist**: https://zustand-demo.pmnd.rs/recipes/persisting-store-data
- **React Router**: https://reactrouter.com/en/main/routeguard

---

## 14. Acceptance Criteria Checklist

- [x] `isHydrated` flag added to auth store state
- [x] `isValidating` flag added for loading state during checkAuth
- [x] `onHydrate` callback triggers `checkAuth()` automatically
- [x] `checkAuth()` sets `isValidating` appropriately and clears it on completion
- [x] `logout()` resets `isHydrated` to false
- [x] `ProtectedRoute` and `PublicRoute` wait for `isHydrated` before redirecting
- [x] Loading UI displayed during hydration/validation
- [x] No redirect loop occurs when valid token present
- [x] Invalid token still redirects to login after validation
- [x] Existing tests continue to pass
- [x] New unit tests cover hydration behavior
- [x] Manual browser testing confirms fix

---

**Design Completed:** Ready for `sdd-tasks` breakdown and `sdd-apply` implementation.
