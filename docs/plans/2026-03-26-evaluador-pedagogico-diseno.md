# Diseño: Evaluador Pedagógico para Respuestas Abiertas de Niños

**Fecha:** 2026-03-26  
**Proyecto:** pixel-mentor  
**Tipo:** Refactorización del módulo de evaluación

---

## Problema Identificado

El módulo `LessonEvaluatorUseCase` en `apps/api/src/evaluator/lesson.evaluator.ts` tiene un conflicto arquitectónico:

1. **Intención del prompt:** El LLM se configura para evaluar "CONCEPTUALMENTE, no solo por palabras clave" y con un enfoque pedagógico.
2. **Realidad del código:** La función `applyRubricAdjustments` aplica lógica programática rígida (conteo de palabras clave, superposición de palabras con `centralTruth`) que contradice y penaliza la evaluación del LLM.

**Síntomas:**

- Un niño que explica un concepto con sus propias palabras (sin usar términos técnicos) recibe una calificación más baja.
- El `feedback` generado por el LLM puede quedar desincronizado con la calificación final tras los ajustes del código.
- El sistema no distingue entre error conceptual y limitación expresiva (propia de niños pequeños).

---

## Solución Propuesta: Flujo de Evaluación en Múltiples Pasos

### Arquitectura General

Se reemplaza el modelo monolítico (1 llamada LLM + ajuste programático) por un flujo de **3 llamadas al LLM**:

```
[Entrada: Pregunta, Respuesta Niño, teacherConfig]
         │
         ▼
┌─────────────────────────────────────┐
│  Paso 1: Extraer Conceptos          │  ← NUEVO
│  (LLM analiza la respuesta del niño)│
└─────────────────────────────────────┘
         │
         ▼ [Conceptos extraídos]
┌─────────────────────────────────────┐
│  Paso 2: Clasificar y Puntuar      │
│  (LLM clasifica según categorías    │  ← MODIFICADO
│   pedagógicas, usando conceptos)    │
└─────────────────────────────────────┘
         │
         ▼ [Clasificación + Puntuación]
┌─────────────────────────────────────┐
│  Paso 3: Generar Feedback           │  ← NUEVO
│  (LLM genera feedback coherente)     │
└─────────────────────────────────────┘
         │
         ▼
[Resultado: outcome, score, feedback, improvementSuggestion, confidence]
```

### Cambios en el Código

1. **Eliminar `applyRubricAdjustments`**: Se elimina esta función y su lógica de conteo de palabras clave. El LLM es el único responsable de la evaluación.

2. **Nuevo enum `EvaluationOutcome`**: Se expande para incluir categorías más pedagógicas:
   - `conceptually_correct` (Antes: correct)
   - `intuitive_correct` (NUEVO: respuesta simple pero idea correcta)
   - `partially_correct` (Antes: partial)
   - `relevant_but_incomplete` (NUEVO: relacionada pero incompleta)
   - `conceptual_error` (NUEVO: error real de comprensión)
   - `no_response` (NUEVO: no responde o es ininteligible)

3. **Nuevos prompts**:
   - `EXTRACT_CONCEPTS_PROMPT`: Extrae ideas del niño.
   - `CLASSIFY_PROMPT`: Clasifica usando categorías pedagógicas.
   - `FEEDBACK_PROMPT`: Genera feedback positivo y constructivo.

4. **Tono del feedback**: El prompt de generación de feedback enfatizará:
   - Estructura: Elogiar → Guiar → Animar
   - Lenguaje adecuado para niños (7-10 años)
   - Nunca punitivo

---

## Justificación Pedagógica

1. **El LLM es mejor que el código para entender lenguaje natural:** Un niño que dice "las plantas comen sol" expresa la misma idea que "fotosíntesis". El código no puede entender esto; el LLM sí.

2. **Feedback coherente:** Al separar la clasificación del feedback, el mensaje siempre será consistente con la calificación.

3. **Categorías más ricas:** Las 6 categorías propuestas permiten una intervención pedagógica más precisa que el binario "correcto/incorrecto".

---

## Riesgos y Mitigaciones

| Riesgo                                    | Mitigación                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| Mayor consumo de tokens (3 llamadas vs 1) | Es aceptable dado el valor pedagógico; se puede cachear si es necesario. |
| Latencia en la respuesta                  | Las llamadas son paralelizables donde no hay dependencias.               |
| Inconsistencia entre llamadas             | Usar Zod Schema para validar estructura en cada paso.                    |

---

## Referencias

- Archivo original: `apps/api/src/evaluator/lesson.evaluator.ts`
- Skill: brainstorming (validado por el usuario)
