# Gamification UX/UI Premium Design

## Context

The gamification system (XP, Levels, Badges, Streaks) has a working backend with event-driven architecture, but the frontend integration is minimal:

- `GamificationHeader` floats between the dashboard header and content (disconnected)
- `MissionReportPage` uses hardcoded stats (`conversation.length * 15`)
- `SessionPage` has zero gamification feedback during lessons
- No real-time notifications when XP/badges are earned
- No dedicated achievements page

This design transforms gamification from a passive stat display into an active, rewarding experience that motivates a 6-8 year old learner throughout their journey.

---

## Target User

**María, 7 years old.** Using Pixel Mentor on a tablet at home after school. She's in the middle of her "Introducción a Variables" lesson, responding to the AI tutor. Connection may be intermittent (home WiFi). She needs immediate, visual feedback that her effort matters.

---

## Domain Exploration

### Concepts

1. **Missions** — Lessons are adventures in a learning journey
2. **Growth journey** — Semilla → Brote → Flor → Árbol → Bosque → Montaña (nature metaphor)
3. **XP as fuel/energy** — Powering the learning rocket
4. **Badges as medals** — Collectible achievements pinned to a sash
5. **Streaks as fire** — Daily consistency flame
6. **Tutor companion** — AI guide through the adventure

### Color World

- **Greens** (growth): `#22C55E`, `#84CC16` — Nature, beginnings
- **Pinks** (blooming): `#EC4899` — Flowering, beauty
- **Blues** (sky/exploration): `#0EA5E9`, `#38BDF8` — Open sky, freedom
- **Ambers** (achievement/gold): `#F59E0B`, `#FBBF24` — Gold, treasure
- **Oranges** (fire/streak): `#F97316`, `#FB923C` — Warmth, energy

### Signature Element

**Floating XP particle system** — When XP is earned, golden particles (✦) float from the interaction point and converge into the XP counter with a satisfying pop. Unique to this gamified learning experience.

### Defaults Rejected

1. Separate gamification sidebar → Integrated mini-bar in lesson header
2. Static stat numbers → Animated particle convergence
3. Modal-based notifications → In-context floating toasts

---

## Design Intent

```
Intent: A 7-year-old must FEEL that every interaction earns something.
        Reward should be instant, visual, and joyful — never interrupting flow.
Palette: Sky blues (#0EA5E9) as primary, ambers (#FBBF24) for XP,
         oranges (#F97316) for fire/streak, level-specific greens→purples.
Depth: Subtle shadows on floating elements, borders-only for structure.
       Higher elevation = more celebration (toasts > inline, modals > toasts).
Surfaces: Light slate-50 base, white cards, warm amber/orange for rewards.
Typography: Inter (existing). Bold for celebrations, medium for labels.
Spacing: 4px base unit. 16px for card padding, 8px for inline elements.
```

---

## Section 1: Live Feedback During Lessons

### 1A. Gamification Mini-Bar in Lesson Header

The session header currently shows: `← Volver | [VoiceSettings] | ● Activo | Reiniciar`

Add a gamification mini-bar between "Volver" and voice settings:

```
┌─ SessionPage Header ──────────────────────────────────────────────┐
│ ← Volver   🌱 Nivel 2: Brote  ████████░░ 120XP  🔥3  🎖️2        │
│                        [VoiceSettings] [● Activo] [Reiniciar]    │
└───────────────────────────────────────────────────────────────────┘
```

**Components:**

- `SessionGamificationBar` — compact, horizontal, 40px height
- Level emoji + title (truncated if long)
- Mini XP progress bar (60px wide, 4px tall) with level color
- XP number
- Streak fire emoji + count
- Badge medal emoji + count

**Behavior:**

- Loads profile on mount via `useGamificationStore.fetchProfile()`
- Updates XP number and progress bar on `XP_EARNED` SSE event
- Badge count increments on `BADGE_EARNED` event

### 1B. Floating XP Particles

When XP is earned (SSE event `XP_EARNED`):

- 3-5 golden particles (✦) spawn from the last tutor message
- Each particle has random delay (0-200ms) and curved trajectory
- Particles converge at the XP counter in the mini-bar
- On arrival: scale pop (1.0→1.3→1.0), number updates with flash
- Progress bar animates (ease-out 700ms)

**Duration:** ~1.2 seconds total. Non-blocking — conversation continues.

**Implementation:**

- `XPParticle` component — absolutely positioned, CSS animation
- `useXPParticles` hook — manages particle state, triggers on SSE event
- CSS keyframes: `float-up`, `converge`, `pop`

### 1C. Badge Earned Toast

When a badge is earned (SSE event `BADGE_EARNED`):

- Toast slides in from bottom-right
- Badge icon (large) with golden glow
- Badge name + XP reward
- Animation: slide-in (300ms) + bounce (600ms) → auto-dismiss (3s)
- Click to dismiss immediately

**Implementation:**

- `BadgeEarnedToast` component — positioned fixed, z-index above content
- Queue system for multiple simultaneous badges

### 1D. Level Up Modal

When level increases (SSE event `LEVEL_UP`):

- Semi-transparent overlay (doesn't block, draws attention)
- Centered content:
  - Previous level emoji → New level emoji (animated transition)
  - "¡Subiste al Nivel 3!" + title: "Flor 🌸"
  - Confetti particles falling (CSS animation)
- "¡Genial!" button to dismiss
- Min display: 2s, auto-dismiss: 4s

---

## Section 2: Mission Report Transformed

### Problem

`MissionReportPage.tsx` uses hardcoded data:

```typescript
const stats = location.state?.stats || {
  xpEarned: 150, // ← Fake
  accuracy: 95, // ← Fake
  conceptsMastered: ['Variables'], // ← Fake
};
```

### Solution

Replace with real gamification data from backend.

### New Backend Endpoint

```
GET /api/gamification/mission-report/:sessionId
Response: {
  xpEarned: 50,
  totalXP: 170,
  currentLevel: 3,
  levelTitle: "Flor",
  xpToNextLevel: 250,
  newBadges: [{ code: "first_lesson", name: "Primera Lección", xpReward: 10 }],
  levelUp: { from: 2, to: 3, title: "Flor" } | null,
  streakDays: 4,
  conceptsMastered: ["Variables", "Tipos de datos", "Asignación"],
}
```

### UI Layout

```
┌─ Mission Report ───────────────────────────────────────────────┐
│                                                                 │
│                      🏆 (bounce-in)                            │
│                ¡Misión Completada!                             │
│           "Introducción a Variables"                            │
│                                                                 │
│  ┌─ Rewards ────────────────────────────────────────────────┐  │
│  │  ⭐ +50 XP (count-up 0→50)                               │  │
│  │  🌱 Nivel 2: Brote  ████████████░░  120/250 XP           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ New Badges (if any) ────────────────────────────────────┐  │
│  │  🎖️ ¡Primera Lección!    +10 XP   (bounce-in, delayed)   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ Level Up (if applicable) ───────────────────────────────┐  │
│  │  🌱 → 🌸   ¡Ahora eres Nivel 3: Flor!   (confetti)       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ Mission Summary ────────────────────────────────────────┐  │
│  │  📊 3 conceptos dominados: Variables, Tipos, Asignación  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [🚀 Continuar Aventura]                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Animation Sequence (in order)

1. Background gradient fades in (500ms)
2. Trophy bounce-in (600ms)
3. Title fades in (300ms)
4. XP count-up animation (800ms)
5. XP progress bar fills (700ms)
6. Each new badge bounce-in (200ms delay between)
7. Level up: confetti + emoji transition (1000ms)
8. Button slides up + fades in (400ms)

### Data Flow

```typescript
// SessionPage completion
const report = await api.getMissionReport(sessionId);
navigate('/mission-report', { state: { report } });

// MissionReportPage reads real data
const { report } = useLocation().state;
```

---

## Section 3: Achievements Page (/achievements)

### Purpose

A "trophy room" where the child can browse all badges, see progress, and feel proud of their collection.

### Layout

#### Profile Hero

```
┌─ Perfil de Aventurero ──────────────────────────────────────────┐
│  🌸            María                                           │
│  Nivel 3       "Flor"                                           │
│                🔥 4 días de racha  │  🎖️ 3 insignias           │
│                                                                    │
│  ████████████████░░░░░░░░  170/250 XP                            │
│  80 XP para Nivel 4: Árbol 🌳                                    │
└──────────────────────────────────────────────────────────────────┘
```

#### Tab Navigation

Three tabs: `🏅 Insignias` | `📊 Progreso` | `🔥 Rachas`

#### Tab 1: Insignias (Badge Grid)

- Grid of badge cards (3 per row on tablet, 2 on mobile)
- **Earned badges:** Full color, checkmark, earned date
- **Unearned badges:** Gray silhouette, lock icon, progress indicator
- **Secret badges:** Question mark icon, hidden until earned
- Click on badge → detail modal with description, XP reward, earned date

#### Tab 2: Progreso (XP History)

- Simple bar chart showing XP earned per day/week
- Total XP, total lessons completed
- Average XP per session

#### Tab 3: Rachas (Streak Calendar)

- GitHub-style heatmap showing active days
- Current streak highlighted in orange
- Longest streak displayed
- Monthly view with navigation

### Backend Endpoints Needed

```
GET /api/gamification/badges          → All badge definitions
GET /api/gamification/badges/user     → User's earned badges
GET /api/gamification/streak-history  → Daily activity for calendar
```

---

## Section 4: Dashboard Integration

### 4A. Compact Header Integration

Move gamification stats INTO the dashboard header (not as a separate block):

```
┌─ Dashboard Header ───────────────────────────────────────────────┐
│ 🚀 Pixel Mentor    Hola, María   🌸 N3  🔥4  🎖️3    [Salir]   │
└──────────────────────────────────────────────────────────────────┘
```

- Remove the separate `<GamificationHeader>` block
- Integrate level badge + XP + streak + badges into the header row
- More compact, more connected to the app identity

### 4B. Module Cards with Gamification Context

Add XP potential, duration, and progress to recipe cards:

```
┌──────────────────────────────┐
│ Introducción a Variables     │
│ Aprende qué son las vars...  │
│                              │
│ ⭐ +50 XP   ⏱️ 15 min       │
│ ✅ Completado                │
│                              │
│ Comenzar →                   │
└──────────────────────────────┘
```

### 4C. Streak Widget

Compact streak visualization below the header:

```
┌─ Tu Racha ───────────────────────────────────────────────────┐
│  🔥 4 días seguidos!                                          │
│  [L] [M] [X] [J] [V] [S] [D]                                 │
│  ✅  ✅  ✅  ✅  ⬜  ⬜  ⬜                                    │
│  Racha más larga: 7 días                                      │
└──────────────────────────────────────────────────────────────┘
```

---

## Section 5: Real-Time Architecture (SSE Channel)

### Why SSE over WebSocket

1. Already used in the app (chat + TTS streaming)
2. Unidirectional (server→client) — exactly what we need
3. Auto-reconnection built into browser EventSource API
4. Auth via cookies (inherited from existing session)
5. HTTP/2 multiplexing — no connection limit

### Architecture

```
Backend:
  Lesson completed
    → EventBus.emit(LESSON_COMPLETED)
      → GameEngineCore processes
        → XP awarded, badges checked, level checked
          → SSE broadcast to user channel

Frontend:
  useGamificationSSE hook
    → new EventSource('/api/gamification/events')
    → On message:
      → XP_EARNED: update store, trigger particles
      → BADGE_EARNED: update store, show toast
      → LEVEL_UP: update store, show modal
      → STREAK_UPDATED: update store, update streak widget
```

### SSE Endpoint

```
GET /api/gamification/events
Auth: Cookie-based (existing session)
Events:
  - xp_earned: { type, amount, newTotal, reason }
  - badge_earned: { type, badge: { code, name, icon, xpReward } }
  - level_up: { type, newLevel, newLevelTitle, previousLevel }
  - streak_updated: { type, currentStreak, longestStreak, isNewRecord }
```

### Frontend Hook

```typescript
// hooks/useGamificationSSE.ts
function useGamificationSSE() {
  const store = useGamificationStore();

  useEffect(() => {
    const es = new EventSource('/api/gamification/events');

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'xp_earned':
          store.addXP(data.amount, data.reason);
          break;
        case 'badge_earned':
          store.showBadgeToast(data.badge);
          break;
        case 'level_up':
          store.showLevelUp(data);
          break;
        case 'streak_updated':
          store.updateStreak(data);
          break;
      }
    };

    return () => es.close();
  }, []);
}
```

---

## Component Architecture

```
components/gamification/
├── SessionGamificationBar.tsx    # Mini-bar for lesson header
├── XPParticle.tsx                # Single floating particle
├── XPParticleSystem.tsx          # Manages particle spawning
├── BadgeEarnedToast.tsx          # Toast notification for badges
├── LevelUpModal.tsx              # (existing, enhance)
├── MissionReport/
│   ├── XPReward.tsx              # XP earned with count-up animation
│   ├── BadgeReward.tsx           # New badge display
│   ├── LevelUpBanner.tsx         # Level up celebration
│   └── MissionSummary.tsx        # Concepts mastered
├── Achievements/
│   ├── ProfileHero.tsx           # Top profile card
│   ├── BadgeGrid.tsx             # (existing, enhance)
│   ├── BadgeDetailModal.tsx      # Badge detail on click
│   ├── StreakCalendar.tsx        # GitHub-style heatmap
│   └── XPChart.tsx               # Simple XP history
├── Dashboard/
│   ├── CompactGamificationHeader.tsx  # Integrated into dashboard header
│   ├── StreakWidget.tsx               # Weekly streak display
│   └── ModuleCard.tsx                 # (enhanced with XP/progress)
└── index.ts
```

---

## Implementation Order

| Phase       | Scope                                     | Impact                           |
| ----------- | ----------------------------------------- | -------------------------------- |
| **Phase 1** | SSE channel + useGamificationSSE hook     | Foundation for all real-time     |
| **Phase 2** | SessionGamificationBar + XPParticleSystem | Live feedback (highest priority) |
| **Phase 3** | MissionReport transformation              | Reward moment                    |
| **Phase 4** | Achievements page                         | Long-term motivation             |
| **Phase 5** | Dashboard integration                     | Daily engagement                 |

---

## Technical Notes

- All animations use CSS keyframes (GPU-accelerated), not JavaScript
- SSE reconnection is automatic via EventSource API
- Particle system uses absolute positioning + CSS transforms (no canvas)
- Streak calendar uses CSS grid (no charting library needed)
- XP count-up uses requestAnimationFrame for smooth animation
- Badge toasts use a queue system (max 1 visible, rest stack)
