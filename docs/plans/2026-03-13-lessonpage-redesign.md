# LessonPage Redesign - Interactive Class Interface

**Date:** 2026-03-13
**Status:** Draft - Pending Approval

---

## 1. Vision

**What is this?** An interactive classroom space where a robot tutor teaches, students can ask questions, and interactive activities reinforce learning.

**Not:** A chat interface with message bubbles.

---

## 2. Domain Concepts

- **Tutor (Robot):** Animated character that teaches, explains, asks questions
- **Question Hand:** Physical metaphor for asking doubts (raise hand)
- **Activity Card:** Multiple choice exercise during class
- **Content Panel:** Where lesson content appears
- **Response Zone:** Where student answers

---

## 3. Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER: Class Title + Progress Bar + State Indicator       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────┐  ┌────────────────────────────┐  │
│  │                      │  │                            │  │
│  │    MASCOT AREA      │  │    CONTENT PANEL           │  │
│  │   (Robot + States)  │  │  - Explanation text        │  │
│  │                     │  │  - OR Question             │  │
│  │                     │  │  - OR Activity Card        │  │
│  │                     │  │                            │  │
│  └──────────────────────┘  └────────────────────────────┘  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              CONTROLS ZONE                            │  │
│  │  [🤚 Raise Hand]  |  [🎤 Voice] [✏️ Type]  | Status │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Component States

### 4.1 Pedagogical States → UI

| State               | Mascot Animation   | Content Panel                | Controls            |
| ------------------- | ------------------ | ---------------------------- | ------------------- |
| **ACTIVE_CLASS**    | Teaching (talking) | Explanation text             | Voice ready         |
| **RESOLVING_DOUBT** | Thinking           | "Tell me your doubt" prompt  | Voice + Type        |
| **CLARIFYING**      | Curious            | Clarifying question          | Voice + Type        |
| **QUESTION**        | Asking             | Multiple choice options      | Select option       |
| **EVALUATION**      | Happy/Celebrate    | Feedback (correct/incorrect) | Continue            |
| **EXPLANATION**     | Explaining         | Additional explanation       | Voice ready         |
| **COMPLETED**       | Celebration        | Mission complete             | Return to dashboard |

### 4.2 Question Hand States

| State           | Visual                  | Behavior           |
| --------------- | ----------------------- | ------------------ |
| **Idle**        | Gray hand outline       | Tap to raise       |
| **Raised**      | Animated raised hand    | Tutor pauses       |
| **Doubt Input** | Pulsing hand            | Voice input active |
| **Resolved**    | Green checkmark → faded | Resume class       |

---

## 5. Key Interactions

### 5.1 Raise Hand Flow

```
1. Student taps "Raise Hand" button
2. Mascot PAUSES (stops speaking, animation changes to "waiting")
3. Voice input activates: "I'm listening..."
4. Student speaks their doubt (OR types in text input)
5. Mascot responds: "Good question! Let me explain..."
6. Content panel shows explanation
7. Student confirms: "Understood" (button or voice)
8. Mascot RESUMES: "Let's continue..."
```

### 5.2 Answer Question Flow (Multiple Choice)

```
1. Mascot asks question (animation: "asking")
2. Content panel shows question + 3-4 options as buttons
3. Student taps option
4. Mascot evaluates: "Correct! 🎉" or "Not quite, try again"
5. If correct → move to next step
6. If incorrect → try again (max 3 attempts)
```

### 5.3 Voice Input Behavior

- **Primary:** Tap mic → speaks → auto-sends
- **Visual feedback:** Waveform or pulsing indicator while listening
- **Fallback:** Text input always available
- **Confirmation:** Brief play of what was understood before sending

---

## 6. Mascot States (Rive)

| State       | Animation Name      | When           |
| ----------- | ------------------- | -------------- |
| Idle        | Idle                | Waiting        |
| Speaking    | normal smile + arms | Explaining     |
| Listening   | surprised_face      | Hearing doubt  |
| Thinking    | super happy_face    | Processing     |
| Asking      | pointing_arms       | Question state |
| Correct     | celebration         | Right answer   |
| Encouraging | gentle_wave         | Try again      |
| Waiting     | hand_up             | Hand raised    |

---

## 7. Visual Design

### Color Palette

| Purpose    | Color              | Usage                  |
| ---------- | ------------------ | ---------------------- |
| Primary    | Sky Blue (#0EA5E9) | Brand, primary buttons |
| Secondary  | Slate (#64748B)    | Secondary elements     |
| Success    | Emerald (#10B981)  | Correct answers        |
| Warning    | Amber (#F59E0B)    | Try again              |
| Error      | Rose (#F43F5E)     | Wrong answer           |
| Background | Sky 50 (#F0F9FF)   | Page background        |
| Surface    | White (#FFFFFF)    | Cards, panels          |

### Typography

- **Headings:** Bold, friendly (no harsh weights)
- **Content:** Readable, 18px minimum for child accessibility
- **Buttons:** Medium weight, clear labels

### Spacing

- Base unit: 4px
- Content padding: 24px (6 units)
- Card padding: 16px (4 units)
- Button padding: 12px 24px

---

## 8. Changes from Current Implementation

### Current (Chat-Based)

- Message bubbles (tutor/student)
- Single input at bottom
- No raise hand concept
- Mascot only shows in sidebar

### New (Class-Based)

- Content panel with explanation/questions
- Question Hand button
- Activity cards (multiple choice)
- Mascot as main character (center-left)
- State-aware controls

---

## 9. Implementation Priority

### Phase 1: Core Structure (COMPLETED)

- [x] Restructure layout (content panel + mascot + controls)
- [x] Add Question Hand button (always visible, disabled during activities)
- [x] Add Rate Limit / Cooldown for question hand (30 seconds)
- [x] Add Activity Card component (multiple choice, max 5 options)
- [x] Wire up pedagogical states to UI

### Phase 2: Interactions

- [ ] Raise hand flow implementation
- [ ] Voice input enhancement
- [ ] Mascot state transitions

### Phase 3: Polish

- [ ] Animations
- [ ] Loading states
- [ ] Error handling

---

## 10. Design Decisions (Approved)

1. **Raise Hand Button:** Always visible, disabled during activities
2. **Rate Limit:** Configurable cooldown between questions (default: 30s)
3. **Max Options:** 5 multiple choice options
4. **Progress Bar:** Not needed

---

**Status: Approved - Ready for Implementation**
**Implementation: Phase 1 (Core Structure)**
