# Optimización del Sistema de Prompts - Plan de Acción

## 1. Investigación y Buenas Prácticas en Diseño de Prompts

- **Estructuración de Instrucciones**: Se recomienda separar claramente el rol del sistema (system prompt), el contexto, las reglas/restricciones (guidelines), y el input del usuario (user message).
- **Consistencia y Control de Contexto**: El manejo del historial conversacional y contexto (RAG) debe insertarse ordenadamente mediante bloques delimitadores estructurados (ej. XML tags: `<context>`, `<history>`).
- **"Single Source of Truth" (Fuente Única de Verdad)**: Los prompts no deben estar hardcodeados en el código de dominio de la aplicación ni dispersos en múltiples archivos y formatos. Deben centralizarse en un repositorio o directorio (ej. `prompts/`).
- **Reducción de Ambigüedad y Redundancia**: Las plantillas deben usar variables consistentes. La lógica de reemplazo debe estar estandarizada (ej. usar un motor unificado como Handlebars o Mustache).
- **Seguridad**: Proteger contra inyección de prompts envolviendo el input del usuario (ej. `<student_input>`), escapando delimitadores y utilizando validadores (Length limits, Blacklists).

## 2. Auditoría del Sistema Actual

Durante la revisión del proyecto (`apps/api/src/`), se han identificado las siguientes incidencias:

### Inconsistencias, Duplicaciones y Múltiples Fuentes de Verdad

1. **Prompts Hardcodeados**: En `features/evaluation/domain/constants/evaluation.prompts.ts`, los prompts están hardcodeados como plantillas de strings literales y exportados.
2. **Prompts en Sistema de Archivos**: En `features/prompt/infrastructure/persistence/file-system-prompt-repository.ts`, se cargan plantillas `.txt` desde un directorio de forma dinámica.
3. **Múltiples Motores de Renderizado (Reemplazo Manual)**:
   - `evaluation.prompts.ts` usa funciones `replace` manuales combinadas con regex simple.
   - `file-system-prompt-repository.ts` tiene su propio método `.render` con una mezcla de pseudo-Jinja (`{% if %}`) y placeholders `{{var}}`.

### Problemas de Seguridad y Mantenibilidad

1. **Evasión de Mecanismos de Seguridad**: Existe un servicio robusto `SafePromptBuilder` (`features/prompt/application/services/safe-prompt-builder.service.ts`) diseñado para evitar inyecciones delimitando variables untrusted con `<student_input>`. Sin embargo, tanto `evaluation.prompts.ts` como `file-system-prompt-repository.ts` **no utilizan este servicio**, inyectando los valores de forma insegura.
2. **Escalabilidad Limitada**: La complejidad del motor de plantillas de `file-system-prompt-repository.ts` es alta y frágil (ej. regex global para `{% if %}`). No escalará adecuadamente para prompts complejos.

## 3. Propuestas de Mejora Concretas

1. **Unificación de Almacenamiento**: Migrar todos los prompts (incluyendo los de `evaluation.prompts.ts`) al repositorio de archivos de texto (`.txt` o `.md`) dentro de una carpeta centralizada (ej. `apps/api/src/prompts/` o similar). Así, iterar en los prompts no requiere tocar lógica de dominio.
2. **Estandarización del Renderizado (Templating)**:
   - Reemplazar la lógica regex manual de `.render()` por un motor de plantillas ligero como Mustache o Handlebars, permitiendo condicionales estables.
   - En su defecto, expandir `SafePromptBuilder` de forma estricta para soportar toda la lógica necesaria.
3. **Imponer el Pipeline de Seguridad**: Modificar los puertos e interfaces del repositorio de prompts para obligar a que **todas** las variables insertadas pasen a través del `SafePromptBuilder` (o similar) y el `PromptValidator`, inyectando los wrappers de seguridad (ej. `<student_input>`).
4. **Desacoplar Lógica de Negocio de Prompts**: Eliminar constructores de prompts específicos de dominio como `buildExtractConceptsPrompt` y pasar esa responsabilidad a la inyección de dependencias o un `PromptFactory` genérico.

## 4. Plan de Acción (Implementación)

### Fase 1: Estandarización y Motor de Plantillas

- **Tarea 1.1**: Adoptar/Implementar un motor de plantillas unificado para prompts (ej. Handlebars) o refactorizar el renderizado manual.
- **Tarea 1.2**: Refactorizar `SafePromptBuilder` para integrarse de forma fluida con el motor de plantillas elegido y mantener las medidas de sanitización (`<student_input>`).
- **Dependencias**: Ninguna.
- **Entregable**: `UnifiedPromptRenderer` (o similar) que reemplace los `.render()` y `replace()` aislados.

### Fase 2: Centralización de la Fuente de Verdad

- **Tarea 2.1**: Extraer los prompts de `evaluation.prompts.ts` en archivos físicos (ej. `evaluation-extract.txt`, `evaluation-classify.txt`).
- **Tarea 2.2**: Ampliar el `FileSystemPromptRepository` para soportar la carga estructurada de los nuevos archivos de prompt (ej. por dominio/feature).
- **Dependencias**: Requiere finalizar Fase 1.
- **Entregable**: Directorio `/prompts` actualizado y único, limpiando constantes hardcodeadas del dominio.

### Fase 3: Refactorización e Inyección de Seguridad

- **Tarea 3.1**: Actualizar los Use Cases de Evaluación (`features/evaluation`) para usar el Repositorio de Prompts y el Pipeline de Seguridad, eliminando los helper `buildXPrompt`.
- **Tarea 3.2**: Auditar y adaptar los tests unitarios (`*.spec.ts`) correspondientes.
- **Tarea 3.3**: Garantizar que todo input del usuario a lo largo de la app pasa por `PromptValidator` y/o se inyecta asegurado.
- **Dependencias**: Requiere finalizar Fase 2.
- **Entregable**: Aplicación completamente integrada, sin vías de bypass hacia el LLM.

### Fase 4: Documentación y CI/CD

- **Tarea 4.1**: Documentar las directrices de creación de Prompts (`prompts-guidelines.md`) estableciendo la obligatoriedad del repositorio unificado.
- **Tarea 4.2** (Opcional): Añadir un linter (custom rule) o script que compruebe la ausencia de `replace()` manuales sobre cadenas que vayan a servicios LLM.
- **Dependencias**: Requiere finalizar Fase 3.
- **Entregable**: Documentación técnica lista.
