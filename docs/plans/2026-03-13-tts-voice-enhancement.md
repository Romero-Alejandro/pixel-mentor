# TTS & Voice Input Enhancement Design

**Date:** 2026-03-13
**Status:** Draft - Pending Approval

---

## 1. Vision

Improve voice functions to be natural, child-friendly, and reliable:

- **TTS:** Selectable voices, optimized for children
- **Voice Input:** Natural confirmation flow with tutor

---

## 2. Voice Selection (TTS)

### 2.1 Voice Options

| Option | Name    | Description                     |
| ------ | ------- | ------------------------------- |
| 1      | "Sofía" | Female voice, warm and friendly |
| 2      | "Mateo" | Male voice, calm and clear      |
| 3      | "Luna"  | Child voice, playful            |

### 2.2 Configuration

```typescript
interface VoiceConfig {
  voiceName: string;
  rate: number; // 0.8 - 1.2 (slower for children)
  pitch: number; // 1.0 - 1.3 (slightly higher for friendly)
  volume: number; // 0.8 - 1.0
}

// Recommended settings for children
const CHILD_FRIENDLY_VOICE: VoiceConfig = {
  voiceName: 'auto', // Select best available
  rate: 0.85, // Slightly slower
  pitch: 1.1, // Friendly pitch
  volume: 0.9,
};
```

### 2.3 Browser Compatibility

- Use `speechSynthesis.getVoices()` withlang filter `es-ES`
- Fallback to first available Spanish voice
- Cache voices on page load

---

## 3. Voice Input Confirmation Flow

### 3.1 Flow Diagram

```
1. Child speaks doubt
   ↓
2. System processes audio
   ↓
3. TUTOR CONFIRMATION: "Me estás preguntando si [understood text], ¿es correcto?"
   (Selects random from 5 phrases)
   ↓
4. Show 2 buttons: [Sí] [No]
   ↓
   ├── YES → Send to backend
   └── NO → "¿Puedes repetirlo o escribirlo?"
```

### 3.2 Confirmation Phrases (5 variants)

| #   | Phrase                                          |
| --- | ----------------------------------------------- |
| 1   | "Me estás preguntando si {text}, ¿es correcto?" |
| 2   | "Entonces quieres saber sobre {text}, ¿verdad?" |
| 3   | "Dijiste {text}, ¿estoy en lo correcto?"        |
| 4   | "Entendí que preguntas sobre {text}, ¿sí?"      |
| 5   | "Mi interpretación: {text}. ¿Le atino?"         |

### 3.3 Rejection Flow

If child clicks "No":

- TTS: "¡Entendido! ¿Puedes repetirlo o escribirlo?"
- Show text input as fallback
- Child can type or try voice again

---

## 4. Components Design

### 4.1 VoiceSelector Component

```tsx
interface VoiceSelectorProps {
  currentVoice: string;
  onVoiceChange: (voiceId: string) => void;
}

// Shows 3 options with preview button
// Saves selection to localStorage
```

### 4.2 VoiceInputWithConfirmation Component

```tsx
interface VoiceInputProps {
  onConfirm: (text: string) => void;
  onCancel: () => void;
}

// States:
// - listening: "Escuchando..."
// - processing: "Pensando..."
// - confirming: Tutor phrase + [Sí] [No] buttons
// - rejected: Text input fallback
```

---

## 5. Integration with LessonPage

### 5.1 New State

```typescript
type VoiceInputState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'confirming' // NEW: tutor asking confirmation
  | 'rejected'; // NEW: need to retry
```

### 5.2 Updated Question Hand Flow

```
1. Child clicks "Tengo una duda"
2. Voice input activates → listening state
3. Audio captured → processing state
4. Confirmation state:
   - TTS plays random phrase with understood text
   - [Sí] [No] buttons appear
5a. YES → send to backend
5b. NO → show fallback input + "Inténtalo de nuevo"
```

---

## 6. Implementation Priority

### Phase 2a: TTS Improvements ✅ COMPLETED

- [x] Add voice selection (3 options: Sofía, Mateo, Luna)
- [x] Optimize voice settings for children (rate: 0.85, pitch: 1.1)
- [x] Browser compatibility fixes (Spanish voice filter)

### Phase 2b: Voice Input with Confirmation ✅ COMPLETED

- [x] Add confirmation phrases (5 variants)
- [x] Add confirmation UI with [Sí] [No] buttons
- [x] Add rejection flow with fallback input

---

## 7. Design Decisions

1. **Voice Options:** 3 (Sofía, Mateo, Luna)
2. **Confirmation:** Random phrase from 5 variants
3. **Buttons:** [Sí] [No] after tutor speaks
4. **Rejection:** Text input fallback

---

**Awaiting approval to proceed with implementation.**
