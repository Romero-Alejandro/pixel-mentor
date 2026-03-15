# [PRD.md]

## 1. Resumen Ejecutivo

El producto evoluciona hacia un modelo híbrido y sinérgico. El contenido pedagógico central (explicaciones, ejemplos y actividades) será 100% estático y curado previamente para garantizar la estructura curricular y la consistencia en el aprendizaje. En conjunto, el motor de Inteligencia Artificial operará en la nube como un soporte dinámico (Q&A), enriqueciendo la experiencia al responder dudas con un contexto anclado en la lección, pero con la libertad de utilizar conocimiento general adaptado a la edad del menor para fomentar la curiosidad.

## 2. Problema / Oportunidad

El modelo anterior dependía de la generación de IA en tiempo real para dictar la clase, lo cual presentaba el riesgo de inconsistencias, falta de control sobre el currículo y vulnerabilidad ante fallos de latencia. La oportunidad radica en estabilizar el núcleo pedagógico con contenido estático inmutable, mientras se potencia la interacción interactiva utilizando modelos de lenguaje en la nube exclusivamente para la resolución de dudas. Esto permite procesar consultas de voz complejas de forma más eficiente, mantener un diálogo natural y mitigar las limitaciones del procesamiento local sin sacrificar la seguridad ni la calidad educativa.

## 3. Objetivos

- Garantizar el 100% de consistencia, previsibilidad y calidad en la entrega del contenido pedagógico principal.
- Proveer respuestas enriquecidas, dinámicas y amigables a las dudas del estudiante, combinando el material de la clase con el conocimiento general de la IA.
- Mejorar la precisión del reconocimiento y síntesis de voz delegando el procesamiento a la nube.
- Mantener la seguridad y adecuación del contenido para menores (6 a 8 años) mediante lineamientos de moderación estrictos.

## 4. No Objetivos

- Desarrollar una interfaz gráfica o CMS para que los educadores creen o editen el contenido estático en esta fase (se considera fuera del alcance del MVP).
- Limitar artificialmente el conocimiento de la IA exclusivamente al texto literal de la lección (se permite contexto general adaptado a niños).
- Almacenar datos biométricos (archivos de voz) de los menores a largo plazo.

## 5. Usuarios / Actores

- **Estudiante (Primario):** Usuario menor de edad que interactúa con el tutor robot, consume el contenido, realiza actividades y formula preguntas por voz o texto.
- **Padre / Tutor Legal / Profesor (Secundario):** Monitorea el progreso del estudiante, revisa el historial de aprendizaje, consume las métricas de rendimiento y recibe alertas sobre el uso del sistema o incidentes de seguridad.
- **Administrador del Sistema:** Configura parámetros globales de negocio, límites de interacción y políticas de retención de datos.

## 6. Requisitos Funcionales

- **Presentar** el contenido de la lección siguiendo un flujo estricto, secuencial y predefinido por el material pedagógico.
- **Procesar** la entrada y salida de audio del estudiante utilizando servicios externos en la nube para maximizar la fidelidad y precisión del reconocimiento.
- **Responder** a las dudas del estudiante utilizando el material estático de la lección como base, complementado con conocimiento externo de la IA.
- **Filtrar** y moderar en tiempo real las consultas del estudiante y las respuestas generadas en la nube para garantizar que el lenguaje sea apto para menores.
- **Permitir** al estudiante interrumpir la explicación teórica de la lección para formular una duda mediante un mecanismo visual de "levantar la mano".
- **Configurar** un límite máximo de preguntas permitidas por clase por estudiante (con un valor por defecto establecido como "ilimitado").
- **Evaluar** las respuestas del estudiante en las actividades prácticas de opción múltiple, determinando si son correctas o incorrectas.
- **Ofrecer** al estudiante la opción de "saltar y dejar para después" una actividad específica tras registrar exactamente 3 intentos fallidos.
- **Registrar** de forma estructurada todas las interacciones, preguntas formuladas, intentos de actividades y finalizaciones para generar reportes posteriores.

## 7. Reglas de Negocio y Mitigación de Riesgos

- **Inmutabilidad del flujo principal:** El estudiante no puede alterar el orden de los conceptos y actividades de la clase; la progresión es estrictamente lineal para asegurar la pedagogía.
- **Procesamiento de Audio Transitorio (Mitigación de Privacidad):** Se permite el envío de audio a la nube para su transcripción y síntesis bajo la regla estricta de que los fragmentos de voz deben ser procesados en memoria o eliminados inmediatamente tras su conversión (Zero Retention). Queda terminantemente prohibido el uso de este audio para entrenamiento de modelos.
- **Expansión de Conocimiento Controlada (Mitigación de Alucinaciones):** La IA tiene permitido utilizar conocimiento externo a la lección para explicar conceptos o responder dudas, siempre que aplique un filtro de adecuación de edad y reconduzca amablemente la conversación hacia el tema principal si la duda se desvía en exceso.
- **Política de Reintentos Limitados:** El máximo de intentos permitidos por actividad es 3. Una vez alcanzados, el sistema no fuerza la respuesta correcta ni bloquea la clase; delega la decisión de salto al estudiante para evitar frustración.

## 8. Escenarios de Uso

- **Escenario A: Progresión Estándar.** El estudiante inicia la clase. El tutor robot presenta la introducción y el primer concepto utilizando exclusivamente el texto predefinido. Al llegar a una actividad, el estudiante selecciona la respuesta correcta al primer intento, recibe retroalimentación positiva predefinida y avanza al siguiente concepto automáticamente.
- **Escenario B: Resolución de Dudas con IA.** Durante la explicación teórica, el estudiante presiona "levantar la mano". El tutor pausa la lección. El estudiante hace una pregunta por voz sobre el tema. El sistema procesa la voz, genera una respuesta amigable utilizando la IA, reproduce la respuesta y luego retoma el flujo estricto de la lección donde se quedó.
- **Escenario C: Reconducción de Tema.** El estudiante pregunta algo ajeno a la clase (ej. pregunta de matemáticas en una clase de historia). El tutor responde breve y amablemente utilizando su conocimiento general, pero inmediatamente invita al estudiante a volver al tema principal de la lección actual.
- **Escenario D: Frustración y Salto.** El estudiante falla tres veces consecutivas en una misma actividad. El sistema detiene los intentos, ofrece palabras de aliento y presenta un botón de "Saltar y dejar para después". El estudiante lo selecciona, la actividad queda marcada como pendiente y la lección continúa con el siguiente tema.

## 9. Criterios de Aceptación

- **Presentación Estática:** La lección debe reproducir fielmente el contenido predefinido sin variaciones generadas por IA durante el flujo normal.
- **Interrupción Controlada:** Al activar "levantar la mano", la clase debe pausarse inmediatamente y habilitar la entrada de audio o texto del estudiante.
- **Cooldown de Dudas:** Se debe aplicar una restricción de tiempo de espera (30 segundos) entre preguntas para evitar el spam y fomentar la atención.
- **Tono Adecuado:** El 100% de las respuestas generadas por la IA para resolver dudas deben cumplir con un tono infantil, paciente y constructivo.
- **Habilitación de Salto:** La interfaz debe mostrar claramente la opción de omitir una actividad ("Saltar por ahora") solo después de registrar el tercer error consecutivo del estudiante en dicho ejercicio.
- **Trazabilidad:** Toda acción significativa (inicio de clase, pregunta formulada, actividad completada, actividad saltada) debe registrarse en el perfil del estudiante y estar disponible para el tutor legal o profesor.

## 10. Casos Límite y Errores Esperados

- **Detección de Contenido Inseguro (Safety Flag):** Si el estudiante ingresa texto o audio inapropiado, el sistema debe bloquear la consulta, hacer que el tutor emita una respuesta neutral (ej. "Mejor sigamos aprendiendo sobre nuestro tema principal") y crear una alerta o ticket silencioso para el supervisor, sin mostrar mensajes de error alarmantes al menor.
- **Caída del Servicio de IA en la Nube:** Si la IA no responde o hay pérdida de conexión, el tutor debe emitir un mensaje pregrabado o estático (ej. "Uy, me distraje un momento. ¿Podemos seguir con la lección y me preguntas de nuevo más tarde?") y continuar la clase sin bloquear el flujo.
- **Silencio Prolongado (Timeout):** Si el estudiante levanta la mano pero no registra entrada de voz ni texto durante 15 segundos, el tutor debe cancelar la escucha y preguntar amablemente si desea continuar con la clase.
- **Límite de Preguntas Alcanzado:** Si el administrador configura un tope de preguntas y el estudiante llega a este límite, la función de duda se deshabilita visualmente con un mensaje de "por hoy nos enfocaremos en practicar".

## 11. Métricas de Éxito

- **Aumento en la Tasa de Finalización:** Incremento del porcentaje de lecciones completadas hasta el final frente al abandono temprano (comparado con el modelo anterior).
- **Reducción de Respuestas Fuera de Contexto:** Disminución en el volumen de intervenciones donde el tutor se desvía del flujo pedagógico deseado.
- **Eficacia en Actividades Prácticas:** Ratio global de respuestas correctas versus fallidas y medición del éxito general del aprendizaje.
- **Tasa de Abandono por Frustración:** Frecuencia con la que los estudiantes optan por "saltar y dejar para después" tras 3 intentos, lo que ayuda a identificar actividades mal diseñadas o demasiado difíciles en el material estático.

## 12. Restricciones y Supuestos

- **Restricción de Retención (Zero Retention):** Exigencia legal y de negocio; los audios de los estudiantes no pueden persistir en almacenamiento físico más allá de su procesamiento transitorio.
- **Restricción de Adecuación:** Las respuestas de la IA deben orientarse siempre a una edad cognitiva de 6 a 8 años.
- **Supuesto de Conectividad:** Se asume que el estudiante opera en un entorno con conexión a internet suficiente para soportar servicios de voz en la nube con latencia aceptable.
- **Supuesto de Disponibilidad de Contenido:** Se asume que el equipo pedagógico proveerá las lecciones estructuradas (texto, ejemplos, opciones de respuestas múltiples) requeridas para operar este modelo híbrido.

## 13. Preguntas Abiertas

- **Mensajes de Interrupción:** ¿Se deben predefinir y estandarizar a nivel global las frases exactas que usará el tutor robot ante caídas de internet o alertas de seguridad, o permitiremos que la interfaz rote entre varias opciones?
- **Gestión de Saltos:** ¿Las actividades que el estudiante decide "saltar y dejar para después" deberán forzarse en una sesión de repaso posterior, o simplemente se documentan en el reporte del profesor para su seguimiento manual?
- **Umbral de Redirección Temática:** ¿Qué tan estricta debe ser la IA al reconducir temas externos? Si un niño hace tres preguntas seguidas fuera de contexto, ¿el sistema debe bloquear temporalmente las preguntas o simplemente seguir respondiendo y reconduciendo?
