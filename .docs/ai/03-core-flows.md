# Core Flows: Voice Tutor & RAG Pipeline

Orquestación del tutor conversacional. El cliente envía las transcripciones y el backend decide si es una pregunta válida (RAG) o ruido.

---

<ai_invariants>
[INPUT_CONTRACT]

- Endpoint: `/api/leccion/interact`
- Payload validation via Zod: `{ session_id: string(uuid), transcript: string, confidence_score: float }`.

[RAG_EXECUTION_FLOW]

1. INTENT_CLASSIFICATION:
   - High Confidence -> Trigger RAG retrieval.
   - Medium Confidence -> Trigger Clarification UI event.
   - Low Confidence (Noise) -> Drop silently.
2. RETRIEVAL:
   - Match `Lesson` context combining Full-Text Search and KNN (numeric[] vector).
3. LLM_GENERATION:
   - Construct prompt with: Retrieved context, recent history, child-safety guidelines.
   - Force output JSON Schema: `{ explanation: string, support_quotes: string[], verification_question: string }`.
4. COMPREHENSION_CHECK:
   - Success -> Resume lesson.
   - Partial -> Emit pedagogical hint, allow ONE retry.
   - Fail -> Reformulate explanation.
     </ai_invariants>
