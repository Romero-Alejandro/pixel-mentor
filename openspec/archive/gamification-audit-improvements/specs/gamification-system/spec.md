# Gamification System Specification

## Purpose

This document specifies the behavior of the gamification system, including experience points (XP) calculation, badge awarding, and real-time notifications. It addresses issues identified in a system-wide audit.

## Requirements

### Critical Fixes

#### Requirement: CRIT-1: Prevent Race Conditions in Frontend State
The system MUST ensure that concurrent updates from API calls and SSE events do not corrupt the client-side gamification state (Zustand store).

- **Scenario: SSE event arrives before API response for the same action**
  - GIVEN a user completes a lesson and the client calls `POST /api/activity`.
  - AND an SSE event `user-progress` is received for that activity *before* the API call resolves.
  - WHEN the `user-progress` event is processed, updating the user's XP and badges.
  - AND THEN the `POST /api/activity` call returns a success response.
  - THEN the client-side store MUST reflect the state from the SSE event and IGNORE the now-stale API response data to prevent rollbacks. The final state must be consistent.

- **Scenario: API response arrives before SSE event**
  - GIVEN a user completes a lesson and the client calls `POST /api/activity`.
  - AND the API call resolves successfully.
  - WHEN the client processes the API response, provisionally updating the UI.
  - AND THEN a `user-progress` SSE event for the same activity is received.
  - THEN the client-side store MUST apply the SSE event as the source of truth, replacing the provisional state.

#### Requirement: CRIT-2: Process All Awarded Badges
The system MUST correctly process and award multiple badges earned from a single activity.

- **Scenario: User earns multiple badges simultaneously**
  - GIVEN a user completes a lesson that qualifies them for both a "First Lesson" badge and a "Perfect Score" badge.
  - WHEN the `recordActivity` service processes this activity.
  - THEN the system MUST create two separate `UserBadge` records.
  - AND the API response and subsequent SSE event MUST include data for both badges.

#### Requirement: CRIT-3: Ensure Real-time XP Calculations Use Fresh Data
The system MUST use the most up-to-date user profile data when calculating XP bonuses and multipliers via SSE-triggered processes.

- **Scenario: XP calculation after profile update**
  - GIVEN a user has an XP multiplier of 1.5x.
  - AND the user updates their profile to qualify for a new multiplier of 2.0x.
  - WHEN the user immediately completes a lesson earning 10 base XP.
  - THEN the SSE `user-progress` event handler MUST fetch the latest user profile (with the 2.0x multiplier).
  - AND the calculated XP MUST be 20 (10 * 2.0), not 15 (10 * 1.5).

#### Requirement: CRIT-4: Return Transaction-Aware Data from Endpoints
The system MUST ensure that API endpoints subject to asynchronous processing do not return stale data before the transaction is complete.

- **Scenario: /xp/add returns latest state**
  - GIVEN an activity is being processed asynchronously to calculate XP and award badges.
  - WHEN a client calls `POST /api/xp/add`.
  - THEN the API response SHOULD NOT be sent until the background processing is complete.
  - AND the returned user profile data (XP, level, badges) MUST reflect the final state of the transaction.

#### Requirement: CRIT-5: Ensure Transactional Integrity for Core Activities
The system MUST use database transactions to ensure that recording an activity and awarding corresponding XP and badges is an atomic operation.

- **Scenario: Badge awarding fails during lesson completion**
  - GIVEN a user completes a lesson, which should grant 50 XP and a "Lesson Complete" badge.
  - WHEN the system processes the activity.
  - AND the XP is successfully added to the user's account.
  - BUT the badge creation fails due to a database constraint or error.
  - THEN the entire transaction MUST be rolled back, including the 50 XP addition.
  - AND the system MUST return an error response to the client.

### Important Fixes

#### Requirement: IMP-1: Centralize Hardcoded XP Values
The system MUST NOT use hardcoded magic numbers for XP calculations. All XP values must be sourced from a central configuration.

- **Scenario: Calculating a perfect score bonus**
  - GIVEN a user achieves a perfect score (100% accuracy).
  - WHEN the system calculates XP.
  - THEN it MUST retrieve the `PERFECT_BONUS` value from `packages/shared/src/gamification-constants.ts` instead of using a hardcoded `20`.

#### Requirement: IMP-2: Populate `xpReward` in `UserBadge` Responses
The system MUST populate the `xpReward` field in `UserBadge` objects returned by the API.

- **Scenario: API returns badge with XP reward**
  - GIVEN a badge, "Code Novice", grants a 100 XP reward upon being awarded.
  - WHEN a user earns this badge.
  - THEN the `UserBadge` object in the API response MUST have `xpReward` set to `100`.

#### Requirement: IMP-3: Process Queued Toasts
The system MUST display pending notifications (`pendingToasts`) stored in client-side state.

- **Scenario: Displaying toasts after navigation**
  - GIVEN a user earns a badge, but the notification is queued as a `pendingToast` because another modal is open.
  - WHEN the user closes the active modal.
  - THEN the frontend application MUST check for and display the `pendingToast` immediately.

#### Requirement: IMP-4: Consolidate Notification Modals
The system MUST use a single, reusable component for displaying both level-up and badge-earned notifications.

- **Scenario: Displaying a level-up notification**
  - GIVEN a user reaches a new level.
  - WHEN the notification is triggered.
  - THEN the application MUST use a generic `NotificationModal` component, configured with "Level Up" title, level number, and associated icon.

- **Scenario: Displaying a badge-earned notification**
  - GIVEN a user earns a new badge.
  - WHEN the notification is triggered.
  - THEN the application MUST use the same `NotificationModal` component, configured with "Badge Earned" title, badge name, and badge icon.

#### Requirement: IMP-5: Enforce Consistent Zod Validation
The system MUST apply strict Zod schema validation to all gamification-related API endpoint inputs.

- **Scenario: Invalid data sent to `recordActivity`**
  - GIVEN a client sends a `POST` request to `/api/activity` with a `progress` value of `150` (where max is 100).
  - WHEN the server receives the request.
  - THEN the Zod schema validation MUST reject the request.
  - AND the server MUST return a `400 Bad Request` response with a descriptive error message.

#### Requirement: IMP-6: Handle SSE Reconnection Gracefully
The system's frontend MUST manage SSE connection state and handle disconnections and reconnections without losing user notifications.

- **Scenario: SSE connection drops and reconnects**
  - GIVEN the client has an active SSE connection.
  - AND the connection is lost temporarily.
  - WHEN the client detects the disconnection.
  - THEN it MUST attempt to reconnect with an exponential backoff strategy.
  - AND upon reconnection, it MUST fetch the latest gamification state to ensure consistency.

#### Requirement: IMP-7: Prevent Duplicate Badge Awards
The system MUST NOT award the same unique badge to a user more than once.

- **Scenario: Re-completing an action for a unique badge**
  - GIVEN a user has already earned the "First Lesson Completed" badge.
  - WHEN the user completes another lesson.
  - THEN the badge awarding logic MUST check for the existing badge.
  - AND the system MUST NOT create a duplicate "First Lesson Completed" `UserBadge` record.

#### Requirement: IMP-8: Ensure Consistent Timestamp Handling
The system MUST use UTC for all date and time operations and store timestamps in a consistent format (`ISO 8601`).

- **Scenario: Awarding a badge across timezones**
  - GIVEN a user in timezone `GMT+8` earns a badge at `10:00 PM` local time.
  - WHEN the `createdAt` timestamp is stored in the database.
  - THEN it MUST be stored in UTC (e.g., `14:00Z`).

#### Requirement: IMP-9: Implement Correct Error Boundaries in UI
The system's frontend MUST use error boundaries around gamification components to prevent UI crashes.

- **Scenario: Gamification widget fails to load**
  - GIVEN the gamification widget encounters a fatal error while fetching data.
  - WHEN the error occurs.
  - THEN the React error boundary MUST catch the error.
  - AND it MUST display a fallback UI (e.g., "Could not load profile") instead of crashing the entire page.

#### Requirement: IMP-10: Remove Redundant API Calls
The system's frontend MUST avoid making redundant API calls to fetch gamification state that is already available or delivered via SSE.

- **Scenario: Navigating to the profile page**
  - GIVEN the user's gamification state (XP, level, badges) is already present in the Zustand store.
  - WHEN the user navigates to their profile page.
  - THEN the page MUST use the existing state from the store and NOT trigger a new API call to re-fetch the same data.

### Minor Fixes

#### Requirement: MIN-1: Use Plural Nouns for Array Fields in API Responses
The system's API responses MUST use plural nouns for fields that contain arrays (e.g., `badges` instead of `badge`).

#### Requirement: MIN-2: Standardize Enum Casing
The system MUST use `PascalCase` for all TypeScript enum members (e.g., `ActivityType.LessonCompleted`).

#### Requirement: MIN-3: Add `aria-labels` to Interactive Gamification Elements
The system's frontend MUST include descriptive `aria-labels` on all interactive gamification elements for accessibility.

#### Requirement: MIN-4: Remove `console.log` Statements
The system MUST NOT contain any `console.log` statements in the production frontend or backend code.

#### Requirement: MIN-5: Ensure Consistent Icon Sizing
The system's frontend MUST use a consistent size for all badge and level icons displayed in the UI.

#### Requirement: MIN-6: Optimize Badge Image Assets
The system MUST serve optimized (e.g., compressed, correctly sized) image assets for badges to reduce load times.

#### Requirement: MIN-7: Centralize API Route Constants
The system MUST define all API routes (e.g., `/api/activity`) in a central file in `packages/shared/` to be used by both frontend and backend.

#### Requirement: MIN-8: Add Comments for Complex Logic
The system's code MUST include comments explaining the "why" behind complex business logic, such as the XP multiplier calculation.
