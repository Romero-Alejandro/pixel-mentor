# Tasks: Evaluador Pedagógico para Respuestas Abiertas

## Phase 1: Foundation (Types, Schemas, Prompts)

- [x] 1.1 Crear `apps/api/src/evaluator/types.ts` con el nuevo enum `EvaluationOutcome` de 6 categorías
- [x] 1.2 Crear tipo `ExtractedConcepts` en `types.ts`
- [x] 1.3 Crear `apps/api/src/evaluator/schemas.ts` con Zod schemas para respuestas de cada paso
- [x] 1.4 Crear `apps/api/src/evaluator/prompts.ts` con los 3 prompts del sistema (Extract, Classify, Feedback)

## Phase 2: Core Implementation

- [x] 2.1 Implementar función `normalizeInput()` en `lesson.evaluator.ts` (minúsculas, limpieza básica)
- [x] 2.2 Implementar método privado `extractConcepts()` - Paso 1 del flujo
- [x] 2.3 Implementar método privado `classifyResponse()` - Paso 2 del flujo
- [x] 2.4 Implementar método privado `generateFeedback()` - Paso 3 del flujo
- [x] 2.5 Eliminar método `applyRubricAdjustments()` y sus helpers (`countKeywordMatches`, `calculateTruthMatch`, `isStopWord`)
- [x] 2.6 Actualizar método `evaluate()` para ejecutar el flujo de 3 pasos
- [x] 2.7 Actualizar `buildEvaluationPrompt()` para usar los nuevos prompts

## Phase 3: Testing

- [x] 3.1 Crear `apps/api/src/evaluator/__tests__/pedagogical.spec.ts`
- [x] 3.2 Test: Normalización de respuestas con errores ortográficos
- [x] 3.3 Test: Clasificación de respuesta "intuitive_correct"
- [x] 3.4 Test: Clasificación de respuesta "partially_correct"
- [x] 3.5 Test: Feedback coherente con clasificación

## Phase 4: Cleanup

- [x] 4.1 Crear backup del archivo original: `lesson.evaluator.ts.backup` (no necesario - git history serves as backup)
- [x] 4.2 Actualizar JSDoc del módulo para reflejar el nuevo flujo
- [x] 4.3 Verificar que las pruebas existentes no se rompieron
