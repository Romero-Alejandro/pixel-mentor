# Gamification UX Premium — Implementation Plan

> Based on: `docs/plans/2026-03-20-gamification-ux-design.md`

## Phase 1: SSE Channel Foundation

### GAM-UX-01: Backend SSE Endpoint

**Files:**

- `apps/api/src/infrastructure/adapters/http/routes/gamification-events.ts` (new)
- `apps/api/src/infrastructure/adapters/http/server.ts` (modify)

**Tasks:**

- [ ] Create SSE route `GET /api/gamification/events`
- [ ] Auth via existing cookie middleware
- [ ] Subscribe to EventBus for: `XP_EARNED`, `BADGE_EARNED`, `LEVEL_UP`, `STREAK_UPDATED`
- [ ] Format events as SSE `data:` lines with JSON payload
- [ ] Handle client disconnect (cleanup subscriptions)
- [ ] Heartbeat every 30s to keep connection alive

**SSE Event Format:**

```
data: {"type":"xp_earned","amount":50,"newTotal":170,"reason":"lesson_completed"}

data: {"type":"badge_earned","badge":{"code":"first_lesson","name":"Primera Lección","icon":"🎖️","xpReward":10}}

data: {"type":"level_up","newLevel":3,"newLevelTitle":"Flor","previousLevel":2}

data: {"type":"streak_updated","currentStreak":4,"longestStreak":7}
```

**Verify:** `curl -N -H "Cookie: token=..." http://localhost:3001/api/gamification/events`

---

### GAM-UX-02: Frontend SSE Hook

**Files:**

- `apps/web/src/hooks/useGamificationSSE.ts` (new)
- `apps/web/src/stores/gamification.store.ts` (modify)

**Tasks:**

- [ ] Create `useGamificationSSE()` hook
- [ ] Connect to `/api/gamification/events` via EventSource
- [ ] Parse incoming events and dispatch to Zustand store
- [ ] Auto-reconnect on disconnect (built-in EventSource behavior)
- [ ] Add new store actions: `addXPFromEvent`, `showBadgeToast`, `triggerLevelUp`
- [ ] Add store state: `pendingToasts`, `pendingLevelUp`, `particleTrigger`

**Verify:** Console logs show events arriving when lesson completes

---

## Phase 2: Live Feedback During Lessons

### GAM-UX-03: SessionGamificationBar

**Files:**

- `apps/web/src/components/gamification/SessionGamificationBar.tsx` (new)
- `apps/web/src/pages/SessionPage.tsx` (modify)

**Tasks:**

- [ ] Create compact horizontal bar (40px height)
- [ ] Show: level emoji + title, mini XP bar, XP number, streak, badge count
- [ ] Level-specific colors for XP bar
- [ ] Animate XP number on change (flash + scale)
- [ ] Integrate into SessionPage header between "Volver" and voice settings
- [ ] Initialize with `useGamificationStore.fetchProfile()` on mount

**Verify:** Lesson page shows gamification bar in header with live data

---

### GAM-UX-04: Floating XP Particle System

**Files:**

- `apps/web/src/components/gamification/XPParticle.tsx` (new)
- `apps/web/src/components/gamification/XPParticleSystem.tsx` (new)
- `apps/web/src/index.css` (modify — add keyframes)

**Tasks:**

- [ ] Create `XPParticle` — single golden ✦ particle with CSS animation
- [ ] Create `ParticleSystem` — manages spawning 3-5 particles on trigger
- [ ] Particles spawn from last tutor message, float to XP counter
- [ ] Random delays (0-200ms), curved trajectories via CSS
- [ ] Convergence pop animation (scale 1.0→1.3→1.0)
- [ ] Add CSS keyframes: `float-up`, `converge`, `xp-pop`
- [ ] Trigger on `xp_earned` SSE event via store subscription

**CSS Keyframes:**

```css
@keyframes float-up {
  0% {
    transform: translate(0, 0) scale(0.5);
    opacity: 0;
  }
  20% {
    opacity: 1;
  }
  100% {
    transform: translate(var(--tx), var(--ty)) scale(1);
    opacity: 0;
  }
}
@keyframes xp-pop {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.3);
  }
  100% {
    transform: scale(1);
  }
}
```

**Verify:** Golden particles float when XP is earned, converge at counter

---

### GAM-UX-05: Badge Earned Toast

**Files:**

- `apps/web/src/components/gamification/BadgeEarnedToast.tsx` (new)
- `apps/web/src/components/gamification/BadgeToastQueue.tsx` (new)

**Tasks:**

- [ ] Create toast component — fixed position bottom-right
- [ ] Badge icon (large) with golden glow ring
- [ ] Badge name + XP reward text
- [ ] Animation: slide-in (300ms) + bounce (600ms) → auto-dismiss (3s)
- [ ] Click to dismiss immediately
- [ ] Queue system: max 1 visible, others stack (FIFO)
- [ ] Trigger on `badge_earned` SSE event

**Verify:** Toast appears when badge is earned during lesson

---

## Phase 3: Mission Report Transformation

### GAM-UX-06: Backend Mission Report Endpoint

**Files:**

- `apps/api/src/infrastructure/adapters/http/routes/gamification.ts` (modify)

**Tasks:**

- [ ] Add route `GET /api/gamification/mission-report/:sessionId`
- [ ] Query: XP earned in this session, new badges, level up, streak
- [ ] Return structured response matching design spec

**Response shape:**

```typescript
{
  xpEarned: number;
  totalXP: number;
  currentLevel: number;
  levelTitle: string;
  xpToNextLevel: number;
  newBadges: Array<{ code, name, icon, xpReward }>;
  levelUp: { from: number, to: number, title: string } | null;
  streakDays: number;
  conceptsMastered: string[];
}
```

---

### GAM-UX-07: MissionReportPage Redesign

**Files:**

- `apps/web/src/pages/MissionReportPage.tsx` (rewrite)
- `apps/web/src/components/gamification/MissionReport/` (new directory)

**Tasks:**

- [ ] Remove hardcoded stats, use real report data from route state
- [ ] Create `XPReward` component with count-up animation (0→earned)
- [ ] Create `BadgeReward` component with bounce-in (delayed per badge)
- [ ] Create `LevelUpBanner` with confetti + emoji transition
- [ ] Create `MissionSummary` for concepts mastered
- [ ] Add "Continuar Aventura" button
- [ ] Animation sequence per design spec (trophy→title→XP→badges→level→button)
- [ ] Fallback: if no report data in state, fetch from API

**Verify:** Completing a lesson shows real XP, badges, level in mission report

---

### GAM-UX-08: SessionPage Completion Flow Fix

**Files:**

- `apps/web/src/hooks/useSessionLogic.ts` (modify)
- `apps/web/src/services/api.ts` (modify)

**Tasks:**

- [ ] When `sessionCompleted` is detected, call `api.getMissionReport(sessionId)`
- [ ] Navigate to `/mission-report` with real report data in state
- [ ] Remove hardcoded `xpEarned: conversation.length * 15`

---

## Phase 4: Achievements Page

### GAM-UX-09: Backend Badge & Streak Endpoints

**Files:**

- `apps/api/src/infrastructure/adapters/http/routes/gamification.ts` (modify)

**Tasks:**

- [ ] `GET /api/gamification/badges` — all badge definitions with requirements
- [ ] `GET /api/gamification/badges/user` — user's earned badges with dates
- [ ] `GET /api/gamification/streak-history` — daily activity data (last 90 days)

---

### GAM-UX-10: Achievements Page

**Files:**

- `apps/web/src/pages/AchievementsPage.tsx` (new)
- `apps/web/src/App.tsx` (modify — add route)
- `apps/web/src/components/gamification/Achievements/` (new directory)

**Tasks:**

- [ ] Create `ProfileHero` — level badge, name, streak, badge count, XP bar
- [ ] Create tab navigation: Insignias | Progreso | Rachas
- [ ] Enhance `BadgeGrid` — earned (full color), unearned (gray + progress), secret (?)
- [ ] Create `BadgeDetailModal` — click badge to see full description
- [ ] Create `StreakCalendar` — GitHub-style heatmap with CSS grid
- [ ] Create `XPChart` — simple bar chart (pure CSS, no library)
- [ ] Add route `/achievements` to App.tsx
- [ ] Add navigation link from Dashboard

**Verify:** `/achievements` page loads with badges, streak calendar, XP history

---

## Phase 5: Dashboard Integration

### GAM-UX-11: Compact Dashboard Header

**Files:**

- `apps/web/src/components/gamification/CompactGamificationHeader.tsx` (new)
- `apps/web/src/pages/DashboardPage.tsx` (modify)

**Tasks:**

- [ ] Create inline gamification stats: level emoji + N#, fire + count, medal + count
- [ ] Remove standalone `<GamificationHeader>` block from DashboardPage
- [ ] Integrate compact stats into the existing header row
- [ ] Click on stats → navigate to `/achievements`

---

### GAM-UX-12: Module Cards with Gamification

**Files:**

- `apps/web/src/pages/DashboardPage.tsx` (modify)

**Tasks:**

- [ ] Add XP potential display (`⭐ +50 XP`) to each recipe card
- [ ] Add estimated duration (`⏱️ 15 min`) if available
- [ ] Show session progress bar for in-progress sessions
- [ ] Show completion status with checkmark for completed sessions

---

### GAM-UX-13: Streak Widget

**Files:**

- `apps/web/src/components/gamification/StreakWidget.tsx` (new)
- `apps/web/src/pages/DashboardPage.tsx` (modify)

**Tasks:**

- [ ] Create weekly streak visualization (L M X J V S D)
- [ ] Show current streak days + fire emoji
- [ ] Show longest streak
- [ ] Integrate below dashboard header

---

## Summary

| Phase   | Tasks             | Focus                            |
| ------- | ----------------- | -------------------------------- |
| Phase 1 | GAM-UX-01, 02     | SSE foundation                   |
| Phase 2 | GAM-UX-03, 04, 05 | Live feedback (highest priority) |
| Phase 3 | GAM-UX-06, 07, 08 | Mission report                   |
| Phase 4 | GAM-UX-09, 10     | Achievements page                |
| Phase 5 | GAM-UX-11, 12, 13 | Dashboard polish                 |

**Total:** 13 tasks across 5 phases.
