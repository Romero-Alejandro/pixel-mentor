# Change Proposal: LLM Response Streaming

## Change Name

llm-streaming-response

## Intent

Improve user experience by streaming LLM responses in real-time, reducing perceived latency and providing a more interactive experience.

## Scope

- Backend: Add streaming endpoint GET /api/recipe/interact/stream
- Backend: Extend AI adapters (Gemini, OpenRouter) with streaming methods
- Frontend: Add streaming support with EventSource
- Maintain compatibility with existing POST /api/recipe/interact endpoint
- Add feature flag for streaming control

## Approach

- Implement Server-Sent Events (SSE) for streaming
- Add async generator methods to AI adapters
- Create interactStream() method for use cases
- Build useChatStream hook for frontend
- Update lessonStore with streamingChunks and isStreaming
- Keep synchronous API as fallback

## Non-Goals

- No changes to existing synchronous endpoint
- No modifications to TTS streaming
- No database schema changes
- No implementation of WebSockets

## Proposal Artifact

This proposal is saved following the conventions with the topic key: change/llm-streaming-response/proposal
