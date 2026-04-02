export const EXTRACT_CONCEPTS_USER_TEMPLATE = `PREGUNTA DEL EXAMEN:
{{questionText}}

RESPUESTA DEL ESTUDIANTE:
{{studentAnswer}}

ANALIZA LA RESPUESTA Y EXTRAE LOS CONCEPTOS.`;

export const CLASSIFY_USER_TEMPLATE = `PREGUNTA:
{{questionText}}

RESPUESTA DEL ESTUDIANTE:
{{studentAnswer}}

CONCEPTOS EXTRAÍDOS POR EL ESTUDIANTE:
{{extractedConcepts}}

CONTEXTO DE LA LECCIÓN:
- Materia: {{subject}}
- Nivel: {{gradeLevel}}
- Tema: {{topic}}

RÚBRICA DEL DOCENTE:
- Verdad Central: {{centralTruth}}
- Palabras Clave (referencia, NO obligatorio): {{requiredKeywords}}

EJEMPLOS DE REFERENCIA:
{{exemplarsSection}}

CLASIFICA LA RESPUESTA USANDO LAS 6 CATEGORÍAS.`;

export const GENERATE_FEEDBACK_USER_TEMPLATE = `CLASIFICACIÓN DE LA RESPUESTA:
- Outcome: {{outcome}}
- Puntuación: {{score}}/{{maxScore}}
- Justificación: {{justification}}

NOMBRE DEL ESTUDIANTE: {{studentName}}

CONTEXTO:
- Pregunta: {{questionText}}
- Respuesta del estudiante: {{studentAnswer}}

GENERA UN MENSAJE DE RETROALIMENTACIÓN POSITIVO Y CONSTRUCTIVO.`;
