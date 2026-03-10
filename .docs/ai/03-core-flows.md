# Core Flows: Voice Tutor & RAG Pipeline

## Visión y Alcance (MVP)

Sistema backend robusto para orquestar un tutor conversacional interactivo (niños 6–12). Guía lecciones y resuelve dudas contextuales mediante RAG.

- **In-Scope:** Gestión de sesiones, pipeline RAG sobre texto, integración Gemini LLM, validación estricta de payloads. Soporte Chromium (Web Speech API).

## Requisitos Funcionales (RF)

### RF1: Procesamiento de Interrupciones

- **RF1.1:** Recibir transcripciones de texto (`transcript`) exclusivamente desde el cliente a través del endpoint de interacciones.
- **RF1.2:** Evaluar la intención y el nivel de confianza de la transcripción utilizando un clasificador LLM.
- **RF1.3:** Ejecutar acciones deterministas basadas en el nivel de confianza:
  - Alta confianza (Pregunta): Iniciar el flujo de resolución de duda.
  - Confianza media (Ambigüedad): Solicitar clarificación al cliente a través de la interfaz.
  - Baja confianza (Ruido): Descartar la transcripción y continuar la lección.

### RF2: Pipeline RAG y Generación de Respuesta

- **RF2.1:** Recuperar el contexto relevante de la `Lesson` activa combinando búsqueda de texto completo (Full-Text Search) y similitud vectorial (KNN).
- **RF2.2:** Construir y enviar un prompt estructurado al LLM que incluya el contexto recuperado, el historial de interacciones recientes y las directrices de seguridad adaptadas a la edad.
- **RF2.3:** Forzar y validar la respuesta del LLM contra un esquema JSON estricto (Zod) que garantice la inclusión de la explicación, las citas de soporte y una micro-pregunta de validación.

### RF3: Ciclo de Verificación de Comprensión

- **RF3.1:** Evaluar la respuesta del alumno a la micro-pregunta generada para verificar su nivel de comprensión.
- **RF3.2:** Ejecutar el flujo de transición correspondiente según la evaluación:
  - Éxito: Reanudar la lección activa.
  - Parcial: Emitir una pista (hint) pedagógica y permitir un único reintento.
  - Fallo: Reformular la explicación con un enfoque distinto.
