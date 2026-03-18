## Functional Requirements

- Progressive text reveal synchronized with audio playback.
- Support audio element from useVoice (single file or streaming chunks).
- Support repeat: reset sync and start over.
- Support variable playbackRate (speakingRate setting).
- Fallback: if audio element not ready, use time-based estimation.

## Non-Functional Requirements

- Update visible text ≤ every 50ms but only when word count changes.
- Use requestAnimationFrame for smooth UI.
- Clean up listeners on unmount or audio change.
- No memory leaks: revoke object URLs not needed here.
- Work in both streaming and HTTP modes.

## API Specification

```typescript
interface UseTextSyncOptions {
  fullText: string;
  audioElement?: HTMLAudioElement | null;
  playbackRate?: number;
  wordsPerSecond?: number; // default 2.5
  onUpdate?: (state: TextSyncState) => void;
}

interface TextSyncState {
  visibleText: string;
  currentWordIndex: number;
  progress: number; // 0..1
  isSynced: boolean;
}

export function useTextSync(opts: UseTextSyncOptions): TextSyncState & {
  reset: () => void;
  forceSync: () => void; // e.g., on repeat
};
```

## Algorithm Details

- Split fullText into words array (preserve spaces behavior).
- If audioElement is available and playing:
  - Use audioElement.currentTime.
  - Estimate wordIndex = floor( currentTime _ (wordsPerSecond _ playbackRate) ).
- If audioElement not playing but we have a start timestamp (e.g., after repeat but before play), we could use Date.now() - startTime. Simpler: only sync when audio is ready; else visibleText = '' or fullText fallback.
- Clamp wordIndex between 0 and words.length.
- Compute visibleText = words.slice(0, wordIndex).join(' ') + (if wordIndex < words.length ? '...' : '').
- On audio 'ended' event: set visibleText = fullText, isSynced = false.

## Edge Cases

- Streaming: audioElement is the current playing chunk; total duration may be unknown. Use word-based estimation; when 'ended' on current chunk and queue empty, we consider overall end.
- Repeat: when repeat initiated, reset wordIndex=0, set a flag to restart counting when audio begins playing.
- Pause: handle audio 'pause' event by pausing sync loop; on 'play', resume.
- Rate change: audio.playbackRate may change; recalc effective wordsPerSecond = baseWPS \* playbackRate.
- Text changes: when fullText prop changes (new step), reset sync.

## Integration

- In useVoice: add `getCurrentAudioElement(): HTMLAudioElement | null` that returns the currently playing audio (either currentAudioRef.element for streaming or httpAudioRef for HTTP).
- In LessonPage: inside uiState === 'concentration', call useTextSync with contentText and voice.getCurrentAudioElement().
- In ConcentrationPanel: prop `visibleText` replaces `text`. Show a blinking cursor at end when not finished.
- On repeat button click: call textSync.reset() then speakContent().

## Testing Scenarios

- Given fullText "Hola mundo esto es una prueba", playbackRate 1.0, after 1 sec of audio, visibleText should have ~2 words (if WPS=2.5 => 2.5 words/sec -> after 1 sec ~2 words).
- When repeat clicked, visibleText becomes "" immediately.
- When user changes voiceSettings.speakingRate to 0.8, visibleText growth slows accordingly.

=== SPEC END ===
