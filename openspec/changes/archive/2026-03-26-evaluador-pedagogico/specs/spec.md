# Delta for Evaluador Pedagógico

## Purpose

Este documento especifica los cambios necesarios para mejorar el evaluador de respuestas abiertas de niños, haciéndolo más inteligente, flexible y pedagógico.

## ADDED Requirements

### Requirement: Flujo de Evaluación en 3 Pasos

El sistema DEBE ejecutar un flujo de evaluación en tres fases secuenciales utilizando el LLM:

1. Extracción de conceptos clave de la respuesta del niño
2. Clasificación en categorías pedagógicas
3. Generación de feedback constructivo

El flujo DEBE ejecutarse en orden secuencial, donde cada paso depende del resultado del anterior.

#### Scenario: Niño responde correctamente con sus propias palabras

- GIVEN un niño responde "¿Por qué flotan los barcos?" con "Porque el agua los empuja hacia arriba"
- WHEN el evaluador procesa la respuesta mediante el flujo de 3 pasos
- THEN el paso de clasificación DEBE reconocer la comprensión conceptual aunque no use términos técnicos
- AND el paso de feedback DEBE elogiar la idea correcta antes de introducir el término técnico

#### Scenario: Niño da respuesta incompleta pero relevante

- GIVEN un niño responde "¿De dónde viene la lluvia?" con "De las nubes"
- WHEN el evaluador procesa la respuesta
- THEN la clasificación DEBE ser "parcialmente_correcta" (no incorrecta)
- AND el feedback DEBE reconocer lo correcto y pedir más detalles amablemente

### Requirement: Categorías Pedagógicas de Clasificación

El sistema DEBE clasificar respuestas en 6 categorías distintas (no solo 3):

- **conceptually_correct**: Respuesta completa y precisa con terminología adecuada
- **intuitive_correct**: Respuesta simple pero con idea central correcta (usando analogías o lenguaje infantil)
- **partially_correct**: Respuesta con algunas ideas correctas pero incompleta
- **relevant_but_incomplete**: Respuesta relacionada con el tema pero que no responde directamente
- **conceptual_error**: Error real en la comprensión del concepto
- **no_response**: No responde o respuesta ininteligible

#### Scenario: Respuesta con limitación expresiva

- GIVEN un niño de 6 años responde "las plantas usan el sol para comer"
- WHEN el evaluador clasifica la respuesta
- THEN DEBE clasificar como "intuitive_correct" (no como incorrecta por no decir "fotosíntesis")

### Requirement: Feedback Coherente y Pedagógico

El sistema DEBE generar feedback que:

- SIEMPRE sea coherente con la clasificación final (no desincronizado)
- SIGA la estructura: Elogiar → Guiar → Animar
- Use tono positivo, amigable y adecuado para niños de 6-12 años
- NUNCA sea punitivo ni递减 el esfuerzo del niño

#### Scenario: Feedback para respuesta parcialmente correcta

- GIVEN la clasificación es "partially_correct"
- WHEN se genera el feedback
- THEN DEBE iniciar con un reconocimiento positivo de lo que sí entendió
- AND debe ofrecer UNA sugerencia específica de mejora (no múltiples)
- AND debe cerrar con ánimo para continuar aprendiendo

### Requirement: Normalización de Respuestas

El sistema DEBE normalizar la respuesta del niño antes de enviarla al LLM:

- Convertir a minúsculas
- Corregir errores ortográficos evidentes (sin informar al niño)
- NO penalizar en la evaluación por falhas de ortografía o sintaxis simple

#### Scenario: Niño con errores ortográficos pero idea correcta

- GIVEN un niño escribe "el sool calienta el aygo" (el sol, el agua)
- WHEN el evaluador procesa la respuesta
- THEN DEBE entender "el sol calienta el agua" correctamente
- AND NO debe marcar como incorrecta por los errores de ortografía

## MODIFIED Requirements

### Requirement: Evaluación de Respuestas (Reemplaza)

(Previously: Evaluación basada en palabras clave y coincidencia literal con "centralTruth")

El evaluador DEBE priorizar la comprensión conceptual sobre la coincidencia literal de palabras. La ausencia de palabras clave técnicas NO DEBE ser penalizada si el concepto está claramente expresado.

#### Scenario: Respuesta conceptualmente correcta sin palabras clave

- GIVEN la respuesta del niño es "es como un globo que se infla en el agua" para explicar flotación
- WHEN el evaluador procesa la respuesta
- THEN NO DEBE penalizar por no contener las palabras "empuje" o "Arquímedes"
- AND DEBE reconocer la analogía como comprensión válida del concepto

## REMOVED Requirements

### Requirement: applyRubricAdjustments

(Reason: Esta función aplica lógica programática rígida (conteo de palabras clave) que contradice la evaluación conceptual del LLM. Su funcionalidad será reemplazada por el flujo de 3 pasos.)

La función `applyRubricAdjustments` y su lógica de:

- `countKeywordMatches`
- `calculateTruthMatch`
- Penalizaciones por palabras clave faltantes

DEBEN ser eliminadas del código.

### Requirement: Conteo de Palabras Clave como Criterio de Evaluación

(Reason: El conteo de palabras clave es demasiado rígido para evaluar respuestas de niños que usan lenguaje natural y propias analogías.)

El sistema NO DEBE usar el conteo de palabras clave como criterio para reducir la puntuación o cambiar la clasificación de una respuesta evaluada por el LLM.

## Acceptance Criteria

- [ ] El flujo de evaluación ejecuta exactamente 3 llamadas al LLM en secuencia
- [ ] Las 6 categorías pedagógicas están implementadas en el enum y validación Zod
- [ ] El feedback generado NUNCA contradice la clasificación
- [ ] No existe código que penalice por palabras clave faltantes
- [ ] Las pruebas unitarias verifican los nuevos flujos con respuestas de niños simuladas
