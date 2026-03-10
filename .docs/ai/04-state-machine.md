# Session State Machine & Concurrency

## Orquestación Transaccional

- **Concurrencia:** Garantizar la transaccionalidad en toda mutación de estado de la `Session` mediante bloqueos consultivos (advisory locks) en PostgreSQL para prevenir condiciones de carrera durante interrupciones concurrentes.
- **Idempotencia:** Implementar control de concurrencia optimista (Optimistic Locking) utilizando columnas de versionado o timestamps en los registros críticos.

## Máquina de Estados de la Sesión

Transicionar el estado lógico de la `Session` estrictamente según las siguientes rutas permitidas:

1. `idle` -> (Inicia lección) -> `active`
2. `active` -> (Interrupción clasificada con alta confianza) -> `paused_for_question`
3. `paused_for_question` -> (Respuesta RAG generada y validada) -> `awaiting_confirmation`
4. `awaiting_confirmation` -> (Respuesta de verificación correcta) -> `active`
5. `awaiting_confirmation` -> (Timeout de 30s sin respuesta) -> `paused_idle`
6. `active` -> (Fin de contenido de la lección) -> `completed`
