# Implementation Roadmap: Advanced State Machine Features

## Overview

Este documento detalla las etapas de implementación necesarias para cumplir con los requisitos de la máquina de estados pedagógica de Pixel Mentor, incluyendo prompts desacoplados, JSON estructurado, micro-interacciones, CLARIFY, gestión de contexto, replay, e instrucciones ocultas.

---

## ETAPA 1: Sistema de Prompts Desacoplado (No Hardcoded Schemas) ✅ **COMPLETADA**

**Objetivo**: Mover prompts a recursos externos y usar interfaz abstracta.

**Cambios**:

- [x] Crear `PromptRepository` interface en domain/ports
- [x] Implementar `FileSystemPromptRepository` con renderizado de templates
- [x] Extraer prompts a archivos en `/prompts/` para todos los estados
- [x] Modificar `GeminiAIModelAdapter` para inyectar `PromptRepository`
- [x] Actualizar `index.ts` para componer `promptRepo`
- [x] Añadir estado `CLARIFYING` a `PedagogicalState` y `state-machine.ts`
- [x] Actualizar DTOs para incluir `CLARIFYING`

**Entregables**:

- Prompt templates con placeholders y condicionales (mustache-style)
- Tests unitarios para `FileSystemPromptRepository` (pasando)

**Estado**: ✅ Implementada y probada

---

## ETAPA 2: Structured JSON Output & Parser ✅ **COMPLETADA**

**Objetivo**: Forzar respuesta JSON estructurada del LLM.

**Cambios**:

- [x] Crear `MicroInteraction` type en domain/entities
- [x] Actualizar `AIResponse` interface con campos estructurados
- [x] Crear `gemini-response-schema.ts` con validación Zod
- [x] Modificar `GeminiAIModelAdapter` para:
  - Usar `responseMimeType: 'application/json'`
  - Parsear respuesta JSON
  - Fallback en caso de error de parseo
- [x] Actualizar `orchestrate-lesson.use-case` para construir `voiceText` desde `explanation` + `microInteraction.text`
- [x] Actualizar tests de adapter y use case

**Entregables**:

- Respuesta estructurada: `{ explanation, supportQuotes, verificationQuestion?, microInteraction? }`
- Schema de validación robusto
- Tests de parsing y error handling

**Estado**: ✅ Implementada y probada

---

## ETAPA 3: Micro-Interactions & Gamification ✅ **COMPLETADA**

**Objetivo**: Cada mensaje termina con hook/pregunta simple.

**Cambios realizados**:

- [x] Definido `MicroInteraction` type con variantes HOOK/QUESTION/REINFORCE
- [x] Incluido `microInteraction` en `AIResponse` y schema Zod
- [x] Añadido instrucción en todos los prompts para incluir micro-interacción
- [x] `orchestrate-lesson.use-case` concatena `microInteraction.text` a `voiceText`
- [x] Implementada función `determineMicroInteraction()` en domain/entities/micro-interaction.ts como fallback

**Estado**: ✅ Funcionalidad completa. El LLM genera micro-interacciones a través de prompts; existe función de fallback en dominio para casos derespuesta no estructurada.

---

## ETAPA 4: CLARIFY Event & CLARIFYING State ✅ **COMPLETADA**

**Objetivo**: Manejar confianza media de clasificación.

**Cambios**:

- [x] Añadir `'CLARIFYING'` a `PedagogicalState`
- [x] Actualizar `state-machine.ts` con transición `CLARIFY` y `CLARIFYING` → `ACTIVE_CLASS`
- [x] Implementar en `orchestrate-lesson.use-case` (root & lesson/):
  - `action.type === 'CLARIFY'` dispara evento `CLARIFY`
  - Estado `CLARIFYING` transita a `ACTIVE_CLASS` con `RESUME_CLASS`
- [x] Test de flujo completo: ACTIVE_CLASS → CLARIFYING → ACTIVE_CLASS
- [x] Prompt `clarifying.txt` con instrucciones de aclaración

**Estado**: ✅ Implementada y probada

---

## ETAPA 5: Gestión de Ventana de Contexto ✅ **COMPLETADA**

**Objetivo**: Limitar historial enviado al LLM para evitar overflow y reducir costos.

**Cambios**:

- [x] Crear `ContextWindowService` en application/services/ con:
  - `trimHistory()`: estima tokens (~50/turno) y limita
  - `summarizeOlderTurns()`: resume turnos no recientes
- [x] Inyectar servicio en `OrchestrateLessonUseCase`
- [x] En `interact()`: usar `trimHistory` y `summarizeOlderTurns`
- [x] Añadir `historySummary` a `PromptParams` y a todos los templates de prompts
- [x] Tests unitarios para `ContextWindowService` (4 passed)
- [x] Suite completa: 120 passed

**Estado**: ✅ Implementada y probada

---

## ETAPA 6: Replay & Reset Endpoint ✅ **COMPLETADA**

**Objetivo**: Reiniciar progreso de sesión.

**Cambios**:

- [x] `SessionRepository` port: `resetProgress(sessionId: string): Promise<void>`
- [x] Implementar en `PrismaSessionRepository`
- [x] Crear `ResetSessionUseCase`
- [x] Ruta: `POST /api/sessions/{id}/replay` (auth)
- [x] Response: `{ message: "Session reset to segment 1", sessionId, resetToSegment }`
- [x] Actualizar contenedor DI en `index.ts`
- [x] Actualizar tests de integración (mocks)

**Estado**: ✅ Implementada, probada y type-safe

---

## ETAPA 7: Hidden System Instructions & State Transition Enforcement ✅ **COMPLETADA**

**Objetivo**: Forzar transiciones sin depender del LLM.

**Cambios**:

- [x] En `GeminiAIModelAdapter.buildPrompt`, agregar sección oculta:
  ```
  [HIDDEN INSTRUCTIONS]
  Current state: {{state}}
  After this response, next state will be: {{nextState}}
  If user asks a question with high confidence, suggest pausing.
  [/HIDDEN]
  ```
- [x] Para `RESOLVING_DOUBT`: instrucción oculta "Return to ACTIVE_CLASS after answering"
- [x] Modificar `orchestrate-lesson.use-case.ts` para calcular `nextState` antes de llamar a AI y pasarlo en params
- [x] Actualizar `AIService` interface para incluir `nextState` opcional
- [x] Reestructurar lógica de determinación de estado: pre-AI (puro) vs post-AI (feedback)
- [x] Tests: todos pasan (118 passed)

**Estado**: ✅ Implementada y probada

---

## ETAPA 8: Escalation & Safety Flags ✅ **COMPLETADA**

**Objetivo**: Implementar escalación por seguridad y fuera de tema.

**Cambios**:

- [x] Añadir campos a `Session`: `safetyFlag` (string | null), `outOfScope` (boolean), `failedAttempts` (number)
- [x] Actualizar `createSession` y `mapSessionToDomain` para incluir nuevos campos
- [x] Extender `SessionRepository` con:
  - `updateSafetyFlags(sessionId, safetyFlag, outOfScope)`
  - `incrementFailedAttempts(sessionId)`
- [x] Implementar métodos en `PrismaSessionRepository`
- [x] Modificar `OrchestrateLessonUseCase.interact()`:
  - Chequeo pre-AI usando `requiresEscalation(failedAttempts, safetyFlag, outOfScope)`
  - Si escalación: llamar `sessionRepo.escalate(sessionId)` y retornar respuesta especial
  - En estado `QUESTION`: cuando respuesta es `incorrect`, incrementar `failedAttempts`; si supera threshold, escalar y retornar
- [x] Actualizar schema de Prisma: añadir campos a `Session` y regenerar cliente
- [x] Tests: todos pasan (118)

**Estado**: ✅ Implementada y probada

---

## ETAPA 9: Integration Tests Multi-Segment ✅ **COMPLETADA**

**Objetivo**: E2E coverage para flujos completos.

**Cambios**:

- [x] Creado `orchestrate-lesson.integration.test.ts` con suite completa
- [x] Escenario 1: Lesson con 3 chunks, flujo completo:
  - `start()` → `CONTINUE` x2 (avanza segmentos 0→1→2) → `RAISE_HAND` (duda) → `RESUME_CLASS` → `CONTINUE` → `COMPLETED`
  - Verificación de checkpoints e índices en cada transición
  - Mock de respuestas JSON estructuradas
- [x] Escenario 2: Flujo `CLARIFY` (ACTIVE_CLASS → CLARIFYING → ACTIVE_CLASS)
- [x] Escenario 3: Escalación por `failedAttempts` (QUESTION state, 3 intentos fallidos)
- [x] Mock dinámico de `create` para propagar `sessionId` generado
- [x] Todos los servicios mockeados con respuestas apropiadas
- [x] Tests integrados en suite general: 21 passed, 121 tests

**Estado**: ✅ Implementada y probada

---

## ETAPA 10: Observability & Logging ✅ **COMPLETADA**

**Objetivo**: Debugging y monitoreo estructurado.

**Cambios**:

- [x] `GeminiAIModelAdapter`:
  - Constructor acepta `logger?: pino.Logger` y `maxPromptLogLength`
  - `setLogger()` para inyección tardía
  - Logs estructurados:
    - `debug` con `promptLength`, `promptPreview` (truncado)
    - `error` en parse JSON y excepciones de API
    - `debug` con `rawLength` y `parsedKeys` de respuesta
- [x] `OrchestrateLessonUseCase`:
  - Constructor acepta `logger?: pino.Logger` opcional
  - Logs:
    - `info` en `start()`: `lessonId`, `studentId`, `sessionId`, `pedagogicalState`
    - `debug` en `interact()`: inicio, clasificación (`intent`, `confidence`, `action`)
    - `info` antes de AI: transición `from` → `to`, `action`, `willComplete`, índices
    - `debug` tras `incrementFailedAttempts`: nuevo contador
    - `warn` en escalación (pre-AI o por failed attempts)
    - `info` al finalizar `interact()`: estado final y `sessionCompleted`
- [x] `index.ts`:
  - Inyecta `logger` en `GeminiAIModelAdapter` y `OrchestrateLessonUseCase`
- [x] Todos los logs usan formato estructurado pino (objeto con `msg` y fields)
- [x] Tests: todos pasan (121)

**Estado**: ✅ Implementada y probada

---

## Priorización & Estado Actual

**Completadas**:

- ✅ ETAPA 1 – Prompts desacoplados
- ✅ ETAPA 2 – JSON estructurado
- ✅ ETAPA 3 – Micro-Interactions & Gamification
- ✅ ETAPA 4 – CLARIFY state
- ✅ ETAPA 5 – Context window
- ✅ ETAPA 6 – Replay & Reset Endpoint
- ✅ ETAPA 7 – Hidden System Instructions
- ✅ ETAPA 8 – Escalation & Safety Flags
- ✅ ETAPA 9 – Integration Tests Multi-Segment
- ✅ ETAPA 10 – Observability & Logging

**Estado**: 🎉 **TODAS LAS ETAPAS COMPLETADAS**

**Nota**: Las etapas 1, 2, 4 y 5 cumplen con los requisitos críticos del documento original. Las etapas restantes pueden implementarse en sprint(s) posteriores.

---

_Documento listo para ser guardado en `.docs/ai/07-implementation-roadmap.md`_
