# Frontend Refactoring Specification

**Domain**: `frontend`
**Change**: `frontend-audit`

## 1. Lesson State Consolidation

This section details the move from a mixed state management approach to a clear separation of concerns, using React Query as the single source of truth for server state and Zustand for ephemeral UI state.

### MODIFIED Requirements

#### Requirement: `lesson.store.ts` (Zustand Store) MUST only manage UI-specific state.

The `lesson.store.ts` file SHALL be refactored to remove all properties that are reflections of server state. Its sole responsibility is to manage state that is local to the user interface and does not need to be persisted on the server or shared globally as server cache.

- **Previous State Properties**: `sessionId`, `lessonId`, `pedagogicalState`, `contentText`, `config`, `studentName`, `wasResumed`, `isRepeat`, `xpEarned`, `accuracy`, `currentStep`, `totalSteps`, `isStarting`, `error`, `retryCount`, `streamingChunks`, `isStreaming`, `streamError`.
- **New State Properties**: `isStarting`, `error`, `retryCount`, `streamingChunks`, `isStreaming`, `streamError`.
- **Reason**: To eliminate state duplication, reduce complexity, and leverage React Query's caching and data synchronization capabilities for server state.

### ADDED Requirements

#### Requirement: A `useLessonSession` hook MUST be the interface for all lesson-related server state.

A new hook, `useLessonSession`, SHALL be created. This hook MUST use React Query's `useQuery` to fetch and manage all lesson data from the backend.

- **Data Managed**: `sessionId`, `lessonId`, `pedagogicalState`, `contentText`, `config`, `studentName`, `wasResumed`, `isRepeat`, `xpEarned`, `accuracy`, `currentStep`, `totalSteps`.
- **Contract**:

  ```typescript
  interface UseLessonSessionReturn {
    data:
      | {
          sessionId: string;
          lessonId: string;
          pedagogicalState: any; // Define specific type
          contentText: string;
          // ... other server state properties
        }
      | undefined;
    isPending: boolean;
    isError: boolean;
    error: Error | null;
    isSuccess: boolean;
  }

  function useLessonSession(sessionId: string): UseLessonSessionReturn;
  ```

### Scenarios

#### Scenario: Start Lesson Flow

- **GIVEN** the user is on a lesson page
- **WHEN** the user clicks the "Start Lesson" button
- **THEN** a React Query mutation (`useMutation`) is triggered to start the session on the server.
- **AND** upon successful mutation, the `useLessonSession` query is invalidated and refetches the initial lesson state.
- **AND** the UI displays a loading state using the `isPending` flag from the `useMutation` or `useLessonSession` hook.
- **AND** the Zustand store (`useLessonStore`) does NOT contain a separate `isStarting` flag for this purpose.

## 2. `useVoice` Refactor

To improve modularity, testability, and separation of concerns, the existing `useVoice` hook will be decomposed into smaller, more focused hooks.

### REMOVED Requirements

#### Requirement: The monolithic `useVoice` hook is removed.

The implementation of the current `useVoice` hook SHALL be deleted. Its functionality will be replaced by the new `useTTS`, `useSTT`, and orchestrator `useVoice` hooks.

### ADDED Requirements

#### Requirement: A `useTTS` hook MUST manage all Text-to-Speech functionality.

This hook is responsible for converting text to audible speech, handling the API interaction (both HTTP and streaming), and managing browser-based fallback synthesis.

- **Contract**:
  ```typescript
  interface UseTTSReturn {
    isSpeaking: boolean;
    speak: (text: string, settings?: VoiceSettings) => Promise<boolean>;
    stopSpeaking: () => void;
    error: string | null;
  }
  ```

#### Requirement: A `useSTT` hook MUST manage all Speech-to-Text functionality.

This hook is responsible for capturing audio from the user's microphone, sending it to the STT service, and returning the transcribed text.

- **Contract**:
  ```typescript
  interface UseSTTReturn {
    isListening: boolean;
    transcript: string;
    confidence: number;
    startListening: () => void;
    stopListening: () => void;
    clearTranscript: () => void;
    error: string | null;
  }
  ```

### MODIFIED Requirements

#### Requirement: The `useVoice` hook MUST be refactored to orchestrate `useTTS` and `useSTT`.

The `useVoice` hook will no longer contain direct implementation details for TTS or STT. It SHALL import and use the `useTTS` and `useSTT` hooks to provide a unified voice interface to the application components.

### Scenarios

#### Scenario: Voice Interaction

- **GIVEN** a student is in a lesson.
- **WHEN** the student clicks the "speak" button.
- **THEN** the `useSTT` hook's `startListening` function is called.
- **AND** as the student speaks, the `transcript` property from `useSTT` is updated in real-time.
- **WHEN** the student finishes speaking, the application uses the final transcript to perform an action (e.g., call a React Query mutation).
- **THEN** upon receiving a text response from the server (via React Query), the `speak` function of the `useTTS` hook is called to read the response aloud.

## 3. Error Handling Unification

To ensure a consistent user experience and simplify development, all asynchronous operations will adopt a standardized error handling pattern.

### ADDED Requirements

#### Requirement: All asynchronous operations MUST use a standard hook for state management.

All async operations (e.g., API calls with React Query, or other async tasks) SHOULD use a consistent pattern for managing loading, data, and error states. The proposal mentions `useAsyncState`, which aligns with the properties returned by React Query's hooks (`isPending`, `isError`, `error`, `data`). React Query's `useQuery` and `useMutation` will be the standard.

#### Requirement: Errors MUST be displayed to the user via a centralized `ToastContext`.

When an error is caught by the standardized async hook (e.g., `isError` is true in a React Query hook), a toast notification SHALL be displayed to the user.

### Scenarios

#### Scenario: API Error during Lesson

- **GIVEN** a student is in a lesson.
- **WHEN** an API call made via a React Query mutation fails due to a network or server issue.
- **THEN** the `isError` flag in the hook's return value becomes `true`.
- **AND** the `error` object contains details of the failure.
- **AND** a global error handler or a component-level effect observes this state change and calls a function from a `ToastContext` to display a user-friendly error message.
- **AND** the UI MAY display a "Retry" button, which, when clicked, calls the `mutate` function again.

## 4. Verification Criteria

1.  **No Duplication**: `contentText` and `pedagogicalState` MUST NOT exist in both `lesson.store.ts` and the data returned by `useLessonSession`.
2.  **Single Source of Truth**: All components that display lesson data (e.g., `currentStep`, `studentName`) MUST source this data from `useLessonSession` (React Query), not from the Zustand store.
3.  **Refactored Hooks**: The `useVoice` hook MUST be refactored and the new `useTTS` and `useSTT` hooks MUST exist and match their specified contracts.
4.  **Zustand Store Size**: The `lesson.store.ts` file MUST contain 15 or fewer properties in its state interface.
5.  **Universal Pattern**: All components initiating server interactions for lessons MUST use React Query's `useQuery` or `useMutation`.
