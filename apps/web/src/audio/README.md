# Audio System

This project uses a dual-audio approach for UI and game feedback:

1.  **MicroAudio**: Short, procedurally generated sounds using ZzFX, ideal for immediate interaction feedback (clicks, hovers).
2.  **SpriteAudio**: Longer, pre-recorded audio assets handled as a single audio sprite file using `use-sound`.

## Catalog of AudioEvents

### MicroAudioEvent

- `Click`: General click interaction
- `ClickSecondary`: Secondary interaction click
- `ToggleOn`: Checkbox or toggle switch on
- `ToggleOff`: Checkbox or toggle switch off
- `Focus`: Item focus
- `InputFocus`: Input field focus
- `InputBlur`: Input field blur
- `CheckboxCheck`: Checkbox checked
- `RadioSelect`: Radio button selected
- `HoverOption`: Item hover
- `DropdownToggle`: Dropdown menu toggle
- `SelectOption`: Option selected in dropdown
- `ModalOpen`: Modal window opened
- `ModalClose`: Modal window closed

### SpriteAudioEvent

- `BadgeEarned`: Badge rewarded to user
- `LevelUp`: User leveled up
- `StreakMaintained`: Streak count increased/maintained
- `AnswerCorrect`: Correct answer feedback (positive)
- `AnswerIncorrect`: Incorrect answer feedback (reserved but NOT used - policy: positive sounds only)
- `VoiceRecordingStart`: Voice recording started
- `VoiceRecordingStop`: Voice recording stopped
- `VoiceResponseReceived`: Voice response processed
- `ToastSuccess`: Success toast displayed
- `ToastInfo`: Info toast displayed
- `ToastWarning`: Warning toast displayed
- `ActivityStart`: Activity initiated
- `ActivityComplete`: Activity completed
- `LessonStart`: Lesson session started
- `LessonComplete`: Lesson completed successfully
- `XPGain`: XP rewarded
- `ErrorSubtle`: Subtle error indication (rarely used)
- `Congrats`: General celebration

## Usage

### `useMicroAudio()`

For immediate UI sounds:

```tsx
const { playMicro } = useMicroAudio();
playMicro(MicroAudioEvent.Click);
```

### `useSpriteAudioEvents()`

For feedback and game events:

```tsx
const { playSprite } = useSpriteAudioEvents();
playSprite(SpriteAudioEvent.BadgeEarned);
```

## Adding New Sounds

### Adding Micro Sounds

1.  Add new entry to `apps/web/src/audio/types/audio-events.ts` in `MicroAudioEvent` enum.
2.  Add a mapping in `apps/web/src/audio/micro/index.ts` within the `playMicroSound` function's `switch` block using `zzfx`.

### Adding Sprite Sounds

1.  Add new entry to `apps/web/src/audio/types/audio-events.ts` in `SpriteAudioEvent` enum.
2.  Update `spriteMap` in `apps/web/src/audio/sprites/index.ts` with new timing/sprite coordinates.

## Assets

- **Sprite File**: `apps/web/public/audio/sprites/sfx-sprite.mp3`.
- **Requirements**: Should follow naming conventions and sprite map timings exactly.

## Design Policy

- **Positive-only sounds**: No negative/error sounds are played to maintain a welcoming, gamified experience suitable for children.
- Error states rely on visual feedback only.
- Sounds are subtle, short, and non-intrusive.
- All audio respects the global mute toggle and persists user preferences.

## Known Limitations

- iOS/Safari autoplay policies may prevent sounds from playing until a user interaction has occurred.
- Mute persistence is handled via `zustand`'s `audio-storage` (local storage).
