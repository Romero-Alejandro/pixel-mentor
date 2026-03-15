# Plan de Implementación: Tutor con Contenido Estático + AI Q&A

**Fecha:** 2026-03-13  
**Depende de:** `2026-03-13-tutor-static-content-ai-qa-design.md`

---

## Resumen

Implementar un sistema de tutor donde el contenido pedagógico es 100% estático y el AI solo se usa para responder preguntas de estudiantes.

---

## Fase 1: Schema de Base de Datos

### Tarea 1.1: Agregar modelos Concept y Activity

**Archivos a modificar:**

- `apps/api/prisma/schema.prisma`

**Pasos:**

1. Agregar modelo `Concept`:
   - `id`, `recipeId`, `title`, `order`
   - `introduction` (JSON)
   - `explanation` (JSON)
   - `examples` (JSON)
   - `keyPoints` (JSON)
   - `closure` (JSON)
   - Relación con Recipe

2. Agregar modelo `Activity`:
   - `id`, `conceptId`, `type`, `order`
   - `instruction`
   - `options` (JSON, nullable)
   - `correctAnswer`
   - `feedback` (JSON)
   - Relación con Concept

3. Modificar modelo `RecipeStep`:
   - Agregar `conceptId` (String, nullable)
   - Agregar `activityId` (String, nullable)
   - Agregar `script` (JSON, nullable) - contenido completo del paso

4. Ejecutar `pnpm db:migrate` para crear las tablas

---

## Fase 2: Repositorios

### Tarea 2.1: Crear ConceptRepository

**Archivos a crear:**

- `apps/api/src/domain/ports/concept-repository.ts` - Interfaz
- `apps/api/src/infrastructure/adapters/database/repositories/concept-repository.ts` - Implementación

**Métodos:**

- `findById(id: string): Promise<Concept | null>`
- `findByRecipeId(recipeId: string): Promise<Concept[]>`
- `create(concept: Omit<Concept, 'createdAt'>): Promise<Concept>`
- `update(id: string, data: Partial<Concept>): Promise<Concept>`
- `delete(id: string): Promise<void>`

### Tarea 2.2: Crear ActivityRepository

**Archivos a crear:**

- `apps/api/src/domain/ports/activity-repository.ts` - Interfaz
- `apps/api/src/infrastructure/adapters/database/repositories/activity-repository.ts` - Implementación

**Métodos:**

- `findById(id: string): Promise<Activity | null>`
- `findByConceptId(conceptId: string): Promise<Activity[]>`
- `create(activity: Omit<Activity, 'createdAt'>): Promise<Activity>`
- `update(id: string, data: Partial<Activity>): Promise<Activity>`
- `delete(id: string): Promise<void>`

### Tarea 2.3: Actualizar RecipeRepository

**Archivos a modificar:**

- `apps/api/src/domain/ports/recipe-repository.ts`
- `apps/api/src/infrastructure/adapters/database/repositories/recipe-repository.ts`

**Agregar métodos:**

- `findByIdWithConcepts(recipeId: string): Promise<RecipeWithConcepts>`
- `findStepsWithContent(recipeId: string): Promise<RecipeStepWithContent[]>`

---

## Fase 3: Use Cases

### Tarea 3.1: Refactorizar OrchestrateRecipeUseCase

**Objetivo:** Cambiar de generación AI a contenido estático

**Modificaciones en `apps/api/src/application/use-cases/recipe/orchestrate-recipe.use-case.ts`:**

1. Agregar nuevas dependencias:
   - `conceptRepo: ConceptRepository`
   - `activityRepo: ActivityRepository`

2. Modificar método `start()`:
   - Cargar recipe con concepts y activities
   - Generar response desde contenido estático (no AI)
   - Retornar primer paso del script

3. Modificar método `interact()`:
   - Si es respuesta a actividad → verificar con contenido estático
   - Si es pregunta → usar AI (nuevo flujo)

### Tarea 3.2: Crear QuestionAnsweringUseCase

**Archivos a crear:**

- `apps/api/src/application/use-cases/question/question-answering.use-case.ts`

**Funcionalidad:**

- Clasificar si pregunta es related a la clase actual
- Si NO → retornar mensaje de rechazo
- Si SÍ → usar RAG para buscar en contenido estático + generar respuesta

---

## Fase 4: Controlador

### Tarea 4.1: Agregar endpoint /recipe/question

**Archivos a modificar:**

- `apps/api/src/infrastructure/adapters/http/routes/recipe.ts`

**Nuevo endpoint:**

```
POST /api/recipe/question
Body: { sessionId: string, question: string }
Response: { answer: string, isOnTopic: boolean }
```

### Tarea 4.2: Modificar /recipe/start para retornar contenido estático

**Cambios en respuesta:**

```typescript
{
  sessionId: string,
  voiceText: string,        // Del script estático
  pedagogicalState: string,
  currentStep: {
    stepIndex: number,
    conceptTitle: string,
    script: {
      transition: {...},
      content: {...},
      examples: [...],
      closure: {...}
    }
  }
}
```

---

## Fase 5: Seed con Contenido Rico

### Tarea 5.1: Actualizar seed-test-data.ts

**Modificar `apps/api/prisma/seed-test-data.ts`:**

1. Crear 2 recipes completas:
   - "Matemáticas Básicas: Suma y Resta"
   - "Formas Geométricas"

2. Para cada recipe:
   - Crear concepts (2-3 por recipe)
   - Crear activities (1 por concept)
   - Crear recipeSteps con script completo
   - Crear atoms y knowledgeChunks para contexto del AI

**Estructura del contenido por concepto:**

```typescript
{
  title: "Qué es sumar",
  introduction: {
    text: "¡Hola! Hoy vamos a aprender algo muy divertido: ¡SUMAR! ¿Sabes qué es sumar?",
    duration: 10
  },
  explanation: {
    text: "Sumar es juntar cosas. Cuando tienes algo y agregas más, estás sumando.",
    chunks: [
      { text: "Sumar es juntar cosas.", pauseAfter: 2 },
      { text: "Cuando sumamos, siempre obtenemos un número mayor.", pauseAfter: 2 }
    ]
  },
  examples: [
    { text: "2 + 3 = 5", visual: { type: 'equation' }},
    { text: "1 + 4 = 5", visual: { type: 'equation' }}
  ],
  keyPoints: [
    "Sumar = juntar",
    "El resultado es siempre mayor"
  ],
  closure: {
    text: "¡Muy bien! Ya sabes qué es sumar. Ahora vamos a practicar."
  }
}
```

---

## Fase 6: Frontend

### Tarea 6.1: Actualizar LessonPage para nuevo formato

**Archivos a modificar:**

- `apps/web/src/pages/LessonPage.tsx`
- `apps/web/src/hooks/useLessonQueries.ts`

**Cambios:**

1. Mostrar contenido estático (no generado por AI)
2. Agregar botón para hacer preguntas
3. Mostrar actividades con opciones

### Tarea 6.2: Crear componente QuestionModal

**Archivos a crear:**

- `apps/web/src/components/question-modal/QuestionModal.tsx`

**Funcionalidad:**

- Input de texto para pregunta
- Enviar al endpoint /recipe/question
- Mostrar respuesta del AI

---

## Validación

### Tests a ejecutar:

```bash
# Backend
pnpm --filter @pixel-mentor/api typecheck
pnpm --filter @pixel-mentor/api test

# Frontend
pnpm --filter @pixel-mentor/web typecheck
pnpm --filter @pixel-mentor/web test

# Integration manual:
# 1. Login como estudiante
# 2. Verificar que aparecen las 2 lecciones
# 3. Iniciar lección "Suma y Resta"
# 4. Verificar que el tutor dice contenido estático
# 5. Responder actividad correctamente
# 6. Hacer pregunta sobre el tema → AI responde
# 7. Hacer pregunta fuera del tema → AI rechaza
```

---

## Orden de Implementación Recomendado

1. **Fase 1**: Schema DB (1 día)
2. **Fase 2**: Repositorios (1 día)
3. **Fase 3**: Use Cases + Controlador (1-2 días)
4. **Fase 5**: Seed rico (1 día)
5. **Fase 4**: Ajustes finales (0.5 días)
6. **Fase 6**: Frontend (1 día)

**Total estimado: 5.5 - 6.5 días**
