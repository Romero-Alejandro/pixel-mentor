### E2E Tests: Gamification System

**Suite ID:** `GAMIFICATION-E2E`
**Feature:** Gamification UI components — XP progress, level up modals, badges, streaks

---

## Test Case: `GAMIFICATION-E2E-001` - XP progress bar is visible

**Priority:** `critical`

**Tags:**

- type → @e2e
- feature → @gamification
- component → @xp

**Description/Objective:** Verify the XP progress bar renders with correct aria attributes.

**Preconditions:**

- Test page at `/test/gamification` is loaded
- XP progress component is rendered with 250/350 XP (Level 2 "Aprendiz")

### Flow Steps:

1. Navigate to `/test/gamification`
2. Wait for the page to be ready
3. Locate the progress bar by role

### Expected Result:

- Progress bar is visible
- aria-valuemin is "0", aria-valuemax is "100"

### Key verification points:

- `getByRole('progressbar')` finds the element
- aria attributes are set correctly

---

## Test Case: `GAMIFICATION-E2E-006` - Level up modal appears when triggered

**Priority:** `critical`

**Tags:**

- type → @e2e
- feature → @gamification
- component → @level-up

**Description/Objective:** Verify the Level Up modal appears with correct content when triggered.

**Preconditions:**

- Test page loaded
- Level up modal is initially hidden

### Flow Steps:

1. Click the "Show Level Up Modal" button
2. Wait for the modal dialog to appear
3. Verify modal content

### Expected Result:

- Modal is visible with role="dialog"
- Shows "¡Subiste de nivel!" title
- Shows new level title "Explorador"
- Shows level transition from Nivel 2 to Nivel 3

### Key verification points:

- `getByRole('dialog')` finds the modal
- Level transition text is correct
- Dismiss button is present

---

## Test Case: `GAMIFICATION-E2E-010` - Earned badges are visible in grid

**Priority:** `critical`

**Tags:**

- type → @e2e
- feature → @gamification
- component → @badges

**Description/Objective:** Verify earned badges render correctly in the badge grid.

**Preconditions:**

- Test page loaded
- 2 earned badges in test data: "Primera Lección" and "Racha de 3"

### Flow Steps:

1. Navigate to the earned badges section
2. Count badge cards
3. Verify badge names

### Expected Result:

- 2 badge cards are rendered
- "Primera Lección" badge is visible
- "Racha de 3" badge is visible
- Each badge shows earned date

---

## Test Case: `GAMIFICATION-E2E-017` - Badge earned modal dismiss button works

**Priority:** `critical`

**Tags:**

- type → @e2e
- feature → @gamification
- component → @badge-earned

**Description/Objective:** Verify the Badge Earned modal can be dismissed via the dismiss button.

**Preconditions:**

- Test page loaded
- Badge earned modal is triggered

### Flow Steps:

1. Click "Show Badge Earned Modal" button
2. Verify modal is visible
3. Click the dismiss button ("¡Increíble!")
4. Verify modal is hidden

### Expected Result:

- Modal appears with badge "Puntuación Perfecta"
- Shows "+50 XP" reward
- Modal closes after clicking dismiss button

---

## Test Case: `GAMIFICATION-E2E-019` - Streak count is displayed

**Priority:** `critical`

**Tags:**

- type → @e2e
- feature → @gamification
- component → @streak

**Description/Objective:** Verify the streak counter shows the correct count and labels.

**Preconditions:**

- Test page loaded
- Streak counter rendered with 7-day streak

### Flow Steps:

1. Locate the streak counter by role="status"
2. Verify the count number
3. Verify the label text

### Expected Result:

- Streak counter is visible with aria-label "Racha de 7 días"
- Count shows "7"
- Label shows "días" (plural)

### Notes:

- For a streak of 1, the label should be "día" (singular)
- Fire icon (🔥) is always shown, with intensity based on streak length
