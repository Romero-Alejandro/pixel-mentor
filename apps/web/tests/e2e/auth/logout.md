# E2E Test Documentation: Logout Flow

## Overview

This document describes the E2E test suite for the logout functionality in Pixel Mentor.

## Test Scope

- **Feature**: User logout from Dashboard
- **Pages Tested**: DashboardPage, LoginPage
- **Test File**: `logout.spec.ts`
- **Page Objects**: `logout-page.ts`

## Test Environment

- **Base URL**: Configured in Playwright config
- **Viewport**: Default (1280x720)
- **Authentication**: Tests assume authenticated session

## Test Cases

### LOGOUT-E2E-001: Clicking logout button shows loading state

**Priority**: Critical

**Description**: Verifies logout button displays loading state while logging out.

**Steps**:
1. Navigate to `/dashboard`
2. Click logout button

**Assertions**:
- Loading button "Saliendo..." is visible

---

### LOGOUT-E2E-002: Logout redirects to login page

**Priority**: Critical

**Description**: Verifies redirect to login page after successful logout.

**Steps**:
1. Navigate to `/dashboard`
2. Click logout button
3. Wait for navigation

**Assertions**:
- URL contains `/login`
- Login form is visible

---

### LOGOUT-E2E-003: Success toast appears after logout

**Priority**: Critical

**Description**: Verifies success toast notification displays.

**Steps**:
1. Navigate to `/dashboard`
2. Click logout button

**Assertions**:
- Toast with "¡Sesión cerrada!" message is visible
- Toast subtitle "Hasta pronto" is visible

---

### LOGOUT-E2E-004: Unauthenticated users redirected to login

**Priority**: High

**Description**: Verifies unauthenticated users cannot access dashboard.

**Steps**:
1. Navigate to `/dashboard` without authentication
2. Wait for redirect

**Assertions**:
- URL contains `/login`

---

### LOGOUT-E2E-005: Logout clears local storage on error

**Priority**: High

**Description**: Verifies logout clears token even if network fails.

**Steps**:
1. Navigate to `/dashboard`
2. Click logout button

**Assertions**:
- URL contains `/login`

---

### LOGOUT-E2E-006: Cannot access dashboard after logout

**Priority**: Security

**Description**: Verifies session is invalidated after logout.

**Steps**:
1. Perform logout
2. Navigate to `/dashboard`
3. Wait for redirect

**Assertions**:
- URL contains `/login`

## Selectors Used

| Element | Selector | Priority |
|---------|---------|---------|
| Logout button | `getByRole('button', { name: /Salir/i })` | getByRole |
| Loading button | `getByRole('button', { name: /Saliendo/i })` | getByRole |
| Toast message | `getByText(/¡Sesión cerrada!/)` | getByText |
| Login form | `page.locator('form')` | CSS |
| Email input | `getByLabel('Correo electrónico...')` | getByLabel |

## Test Tags

- `@e2e` - General E2E tests
- `@logout` - Logout feature tests
- `@critical` - Critical path tests
- `@error` - Error handling tests
- `@security` - Security tests

## Running Tests

```bash
# Run all logout tests
pnpm --filter @pixel-mentor web test:e2e -- --grep "logout"

# Run critical path only
pnpm --filter @pixel-mentor web test:e2e -- --grep "@critical"
```

## Related Files

- `/apps/web/src/pages/DashboardPage.tsx` - Logout button implementation
- `/apps/web/src/features/auth/hooks/useAuth.ts` - Logout logic
- `/apps/web/src/pages/LoginPage.tsx` - Redirect destination