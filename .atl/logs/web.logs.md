[DEBUG] Skipping concentration state, pedagogicalState requires input: AWAITING_START
logger.ts:10 [API] Starting fetchEventSource for streaming: {sessionId: '46226257-c870-4ce6-b780-2a757a7c4223', studentInput: 'listo'}
logger.ts:10 [API] fetchEventSource started for streaming
api.ts:87
 POST http://localhost:5173/api/recipe/interact/stream 500 (Internal Server Error)
[EDD-PROBE] | frontend-4c0676a2-7b8f-4959-8bd1-0ab7d5a024b0 | 1778131192232 | useAutoStart:onStartClass result |
{ok: false, error: Error: Expected content-type to be text/event-stream, Actual: text/plain
    at defaultOnOpen (http…}
error
:
Error: Expected content-type to be text/event-stream, Actual: text/plain at defaultOnOpen (http://localhost:5173/node_modules/.vite/deps/@microsoft_fetch-event-source.js?v=ef539633:191:11) at create (http://localhost:5173/node_modules/.vite/deps/@microsoft_fetch-event-source.js?v=ef539633:159:15)
message
:
"Expected content-type to be text/event-stream, Actual: text/plain"
stack
:
"Error: Expected content-type to be text/event-stream, Actual: text/plain\n    at defaultOnOpen (http://localhost:5173/node_modules/.vite/deps/@microsoft_fetch-event-source.js?v=ef539633:191:11)\n    at create (http://localhost:5173/node_modules/.vite/deps/@microsoft_fetch-event-source.js?v=ef539633:159:15)"
[[Prototype]]
:
Object
ok
:
false
