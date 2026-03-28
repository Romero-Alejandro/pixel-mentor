# Proposal: Evaluador Pedagógico para Respuestas Abiertas

## Intent

El módulo `LessonEvaluatorUseCase` actual tiene un conflicto arquitectónico: el LLM se configura para evaluar "conceptualmente" pero el código aplica penalizaciones rígidas por palabras clave que contradicen esta evaluación. Esto causa que niños que expresan conceptos correctamente con sus propias palabras reciban calificaciones bajas y feedback desincronizado.

## Scope

### In Scope

- Reemplazar el flujo monolítico (1 LLM + ajustes rígidos) por un flujo de 3 pasos: Extraer Conceptos → Clasificar → Feedback.
- Eliminar la función `applyRubricAdjustments` y su lógica de conteo de palabras clave.
- Expandir el enum `EvaluationOutcome` a 6 categorías pedagógicas.
- Crear 3 nuevos prompts del sistema para cada paso del flujo.
- Garantizar coherencia entre la clasificación final y el feedback.

### Out of Scope

- Modificar la interfaz pública del `LessonEvaluatorUseCase` (mantener compatibilidad).
- Cambiar el cliente LLM subyacente.
- Implementar cacheo de respuestas (futuro).

## Approach

Se implementará un flujo de 3 llamadas secuenciales al LLM:

1. **ExtractConcepts**: Analiza la respuesta del niño y extrae ideas clave.
2. **Classify**: Usa los conceptos extraídos y la configuración del profesor para clasificar en categorías pedagógicas.
3. **GenerateFeedback**: Produce feedback positivo constructivo basado en la clasificación final.

## Affected Areas

| Area                                         | Impact   | Description                                      |
| -------------------------------------------- | -------- | ------------------------------------------------ |
| `apps/api/src/evaluator/lesson.evaluator.ts` | Modified | Refactorización completa del flujo de evaluación |
| `apps/api/src/evaluator/__tests__/`          | Modified | Nuevos casos de prueba para el flujo de 3 pasos  |

## Risks

| Risk                             | Likelihood | Mitigation                                                    |
| -------------------------------- | ---------- | ------------------------------------------------------------- |
| Mayor latencia (3 llamadas vs 1) | Medium     | Aceptable para el valor pedagógico; optimizar si es necesario |
| Inconsistencia entre pasos       | Low        | Validación Zod en cada paso                                   |

## Rollback Plan

Mantener el archivo original como `lesson.evaluator.ts.backup` antes de modificar. Revertir consistiría en renombrar el backup.

## Dependencies

- Ninguna dependencia externa. Es una refactorización interna.

## Success Criteria

- [ ] El evaluador puede clasificar respuestas en 6 categorías (no solo 3)
- [ ] El feedback generado siempre es coherente con la clasificación
- [ ] Las pruebas unitarias pasan con respuestas de niños simuladas
- [ ] No hay penalización por palabras clave en el código
