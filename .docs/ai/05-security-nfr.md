# Security, Resiliency & NFRs

Políticas no funcionales y de seguridad para proteger a los usuarios menores de edad y asegurar la disponibilidad del sistema contra fallos de las APIs de Google.

---

<ai_invariants>
[ZERO_AUDIO_PRIVACY]

- Server-Side: STRICTLY PROHIBITED to receive, process, or store audio blobs.
- Infrastructure: STT/TTS must run entirely client-side.
- Data Retention: Apply strict TTL to stored text transcripts. Provide wipe endpoints.

[LLM_RESILIENCY]

- Routing: ALL Gemini calls MUST route through `ApiKeyRotatorService`.
- Strategy: Balanced Round-Robin.
- Circuit Breaker: Trip after 5 errors in 60 seconds. Isolate degraded keys.
- Health: Periodic latency checks required.

[ESCALATION_FALLBACK]

- Trigger async `teacher_review` ticket creation IF:
  - Pedagogical retry limits are exhausted.
  - LLM Safety Flags detect unsafe content.
  - Zod schema validation fails repetitively.
    </ai_invariants>
