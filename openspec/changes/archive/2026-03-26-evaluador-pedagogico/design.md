# Design: Evaluador Pedagógico para Respuestas Abiertas

## Technical Approach

La solución implementa un flujo de evaluación en 3 pasos donde el LLM es el único responsable de evaluar y clasificar respuestas, eliminando por completo la lógica programática de penalización por palabras clave.

## Architecture Decisions

### Decision: Flujo Secuencial de 3 LLMs vs Unificación

**Choice**: 3 llamadas secuenciales al LLM (Extraer → Clasificar → Feedback)
**Alternatives considered**: Mantener 1 llamada y mejorar el prompt
**Rationale**: Separa las responsabilidades y garantiza que el feedback sea coherente con la clasificación final. Evita el conflicto actual donde el código ajusta la evaluación del LLM.

### Decision: Clasificación de 6 Categorías vs 3

**Choice**: Expandir el enum `EvaluationOutcome` a 6 categorías pedagógicas
**Alternatives considered**: Mantener correct/partial/incorrect
**Rationale**: Permite una intervención más precisa. Por ejemplo, distingue entre "intuitiva correcta" (niño entendió pero usa lenguaje simple) de "conceptualmente correcta" (usa términos técnicos).

### Decision: Eliminar applyRubricAdjustments

**Choice**: Eliminar completamente la función de ajustes programáticos
**Alternatives considered**: Mantenerla pero solo para ajustar confianza
**Rationale**: Su lógica de `countKeywordMatches` y `calculateTruthMatch` contradice directamente la intención pedagógica del prompt del sistema.

## Data Flow

```
Request → Normalize Input → [Step 1: ExtractConcepts] → Concepts
                                              ↓
                                    [Step 2: Classify] → Outcome+Score
                                              ↓
                                  [Step 3: GenerateFeedback] → Feedback
                                              ↓
                                        Final Result
```

## File Changes

| File                                                   | Action | Description                                                                                                       |
| ------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/evaluator/lesson.evaluator.ts`           | Modify | Refactorizar flujo interno: eliminar `applyRubricAdjustments`, añadir `normalizeInput`, añadir los 3 pasos nuevos |
| `apps/api/src/evaluator/types.ts`                      | Modify | Crear nuevos tipos para `ExtractedConcepts` y actualizar `EvaluationOutcome`                                      |
| `apps/api/src/evaluator/prompts.ts`                    | Create | Extraer los 3 prompts del sistema a constantes reutilizables                                                      |
| `apps/api/src/evaluator/schemas.ts`                    | Create | Crear Zod Schemas para validar respuestas de cada paso                                                            |
| `apps/api/src/evaluator/__tests__/pedagogical.spec.ts` | Create | Tests para el nuevo flujo                                                                                         |

## Interfaces / Contracts

### Nuevo Enum EvaluationOutcome

```typescript
export type EvaluationOutcome =
  | 'conceptually_correct' // Respuesta completa y precisa
  | 'intuitive_correct' // Idea correcta pero lenguaje simple/analógico
  | 'partially_correct' // Algunas ideas correctas, incompleta
  | 'relevant_but_incomplete' // Relacionada pero no responde directamente
  | 'conceptual_error' // Error real de comprensión
  | 'no_response'; // No responde o ininteligible
```

### Nuevo Tipo para Conceptos Extraídos

```typescript
export interface ExtractedConcepts {
  readonly ideas: readonly string[];
  readonly languageComplexity: 'simple' | 'moderate' | 'advanced';
  readonly hasAnalogies: boolean;
}
```

## Testing Strategy

| Layer       | What to Test                | Approach                                                   |
| ----------- | --------------------------- | ---------------------------------------------------------- |
| Unit        | Lógica de normalización     | Probar con respuestas con errores ortográficos             |
| Unit        | Clasificación de categorías | Simular respuestas de niños y verificar categoría asignada |
| Integration | Flujo completo              | Mock del LLM para verificar secuencia de llamadas          |

## Migration / Rollback

No hay migración de datos. El cambio es interno.
**Rollback**: Mantener backup del archivo original antes de modificar.

## Open Questions

- [ ] ¿El cliente LLM actual soporta llamadas paralelizables para reducir latencia?
- [ ] ¿Necesitamos cacheo a nivel de concepto para preguntas frecuentes?

## Próximos Pasos (sdd-tasks)

1. Crear tipos nuevos y actualizar el enum
2. Extraer prompts a archivo separado
3. Implementar función normalizeInput
4. Implementar paso 1: ExtractConcepts
5. Implementar paso 2: Classify con nuevas categorías
6. Implementar paso 3: GenerateFeedback
7. Eliminar applyRubricAdjustments
8. Crear tests
