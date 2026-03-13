# Tareas Activas

- [x] [apps/api/src/domain/entities/] - Crear nuevas entidades del nuevo schema: Recipe, Atom, AtomOption, Level, Module, KnowledgeChunk, Competency, UserProgress, ActivityAttempt, EventLog, Asset
- [x] [apps/api/src/domain/entities/] - Refactorizar entidades existentes: Session (cambiar lessonId a recipeId), Interaction (adaptar a nuevo schema)
- [x] [apps/api/src/domain/ports/] - Crear nuevos puertos: RecipeRepository, AtomRepository, ModuleRepository, LevelRepository, KnowledgeChunkRepository, ProgressRepository, EventLogRepository, ActivityAttemptRepository, CompetencyRepository
- [x] [apps/api/src/domain/ports/] - Actualizar puertos existentes: SessionRepository (cambiar lessonId a recipeId), LessonChunkRepository -> KnowledgeChunkRepository
- [x] [apps/api/src/infrastructure/adapters/database/] - Implementar repositorios Prisma para nuevas entidades
- [x] [apps/api/src/infrastructure/adapters/database/] - Actualizar repositorios Prisma existentes: PrismaLessonRepository -> PrismaRecipeRepository, PrismaLessonChunkRepository -> PrismaKnowledgeChunkRepository
- [x] [apps/api/prisma/schema.prisma] - Migrar schema: Renombrar Leccion a Recipe, Pregunta a Atom, LessonChunk a KnowledgeChunk, agregar nuevas tablas
- [x] [apps/api/src/application/use-cases/] - Crear nuevos casos de uso: StartRecipeUseCase, AttemptActivityUseCase, TrackProgressUseCase, LogEventUseCase
- [x] [apps/api/src/application/use-cases/] - Refactorizar OrchestrateLessonUseCase para usar Recipe/Atom en lugar de Lesson/LessonChunk
- [x] [apps/api/src/index.ts] - Actualizar contenedor de dependencias para nuevas instancias de repositorio y casos de uso
- [x] [apps/api/src/domain/services/] - Crear servicios de dominio nuevos: ProgressService, EventService, CompetencyService
- [x] [apps/api/src/domain/state/] - Adaptar state-machine al nuevo flujo basado en RecipeStep

- [x] [apps/api/src/domain/entities/] - Eliminar entidades obsoletas: Lesson, LessonChunk
- [x] [apps/api/src/domain/ports/] - Eliminar puertos obsoletos: LessonRepository, LessonChunkRepository
- [x] [apps/api/src/application/use-cases/index.ts] - Exportar nuevos casos de uso en el barrel index (StartRecipeUseCase, AttemptActivityUseCase, TrackProgressUseCase, LogEventUseCase)
- [x] [apps/api/src/index.ts] - Registrar nuevos repositorios (ActivityAttemptRepository, ProgressRepository, EventLogRepository, CompetencyRepository, etc.)

- [x] [apps/api/src/domain/ports/] - Crear puertos faltantes: TagRepository, RecipeTagRepository, CompetencyMasteryRepository
- [x] [apps/api/src/infrastructure/adapters/database/repositories/] - Implementar repositorios Prisma para Tag, RecipeTag, CompetencyMastery
- [x] [apps/api/src/index.ts] - Registrar estos nuevos repositorios en el contenedor

# Tareas de Alineación Identificadas (Post-migración)

- [x] [apps/api/src/domain/ports/progress-repository.ts] - Interfaz ya alineada: `update(id, data)` y `upsert` presentes. Se añadieron métodos de consulta por campos nuevos: `findByScore`, `findByAttempts`, `findByLastAttemptAt`.
- [x] [apps/api/src/infrastructure/adapters/database/repositories/progress-repository.ts] - Implementación completa con todos los campos (`score`, `attempts`, `lastAttemptAt`). Corregido `create` para incluir `id` y orden en `findByUserId`.
- [x] [apps/api/tests/] - Tests unitarios creados para `PrismaProgressRepository` (14 tests pasando) que cubren todos los métodos y mapeo de campos.
- [x] [apps/api/prisma/] - Prisma Client generado exitosamente.
- [x] [apps/api/src/infrastructure/adapters/database/repositories/] - Todos los repositorios usan `@@map` correctamente (ej: `prisma.user` -> `users`).
- [x] [apps/api/src/infrastructure/adapters/database/repositories/] - `mapProgress` incluye todos los campos (ya estaba completo).
- [x] [apps/api/src/domain/entities/session.ts] - `SessionCheckpoint` y `PedagogicalState` alineados con `stateCheckpoint` JSON.
- [x] [apps/api/src/index.ts] - Repositorios Tag, RecipeTag, CompetencyMastery ya registrados en el contenedor DI.
- [x] [apps/api/src/infrastructure/adapters/database/repositories/] - Verificados todos los repositorios: ActivityAttempt, Asset, AssetAttachment, Atom, Competency, Level, Module, ParentalConsent, ApiKey, TeacherReviewTicket, EventLog, KnowledgeChunk, RecipeTag, Tag, CompetencyMastery, etc. Todos alineados excepto detalle de puerto abajo.

# Tareas Pendientes (Críticas)

- **[x] [apps/api/src/domain/ports/parental-consent-repository.ts** - Corregido nombre de campo en tipo `Omit`: cambiar `'consentDate'` por `'consentedAt'` para coincidir con entidad `ParentalConsent`. La entidad tiene `consentedAt: Date`, no `consentDate`. El repositorio implementación ya está correcto.

# Tareas de Alineación de Capa de Aplicación (Apps Layer)

**Estado:** La capa de aplicación usa terminología "Lesson" obsoleta, mientras que el schema y dominio usan "Recipe". Además hay casts `as any` que rompen la type-safety.

- [ ] **Renombrar clases UseCase de "Lesson" a "Recipe"**:
  - `GetLessonUseCase` → `GetRecipeUseCase` (archivo: `use-cases/lesson/get-lesson.use-case.ts` → `use-cases/recipe/get-recipe.use-case.ts`)
  - `ListLessonsUseCase` → `ListRecipesUseCase` (archivo: `use-cases/lesson/list-lessons.use-case.ts` → `use-cases/recipe/list-recipes.use-case.ts`)
  - `OrchestrateLessonUseCase` → `OrchestrateRecipeUseCase` (archivo: `use-cases/orchestrate-lesson.use-case.ts` → `use-cases/orchestrate-recipe.use-case.ts`)
  - Actualizar todos los imports en `apps/api/src/index.ts`, controladores HTTP, y tests.

- [ ] **Actualizar DTOs en `application/dto/index.ts`**:
  - Renombrar schemas: `StartLessonInputSchema` → `StartRecipeInputSchema` (campo `recipeId` en lugar de `lessonId`).
  - `InteractLessonInputSchema` → `InteractRecipeInputSchema`.
  - `GetLessonInputSchema` → `GetRecipeInputSchema`.
  - `ListLessonsInputSchema` → `ListRecipesInputSchema`.
  - Ajustar tipos exportados correspondientes (`StartLessonInput` → `StartRecipeInput`, etc.).
  - Asegurar que los nombres de campos coincidan con los parámetros de los use-cases (`recipeId`).

- [ ] **Eliminar casts `as any` en `OrchestrateRecipeUseCase`**:
  - Revisar la interfaz `AIService` (puerto) y sus tipos de entrada (`AIResponse`, `AIResponseInput`).
  - Crear/ajustar DTOs de dominio para la petición a AI que usen `Recipe` y `Atom` de forma type-safe.
  - Reemplazar `recipe as any` y `currentSegment as any` por objetos tipados correctamente.
  - Verificar que `currentSegment` tenga la forma `{ chunkText: string; order: number }` sin necesidad de cast.

- [ ] **Actualizar controladores HTTP**:
  - `LeccionController.ts` → `RecipeController.ts`.
  - `leccion.ts` (routes) → `recipe.ts`.
  - Cambiar parámetros de ruta: `:lessonId` → `:recipeId`.
  - Actualizar validación de DTOs en los controladores (usar los nuevos schemas Recipe\*).
  - Ajustar respuestas y nombres de variables internas.

- [ ] **Actualizar barrel index de use-cases** (`application/use-cases/index.ts`):
  - Exportar `GetRecipeUseCase`, `ListRecipesUseCase`, `OrchestrateRecipeUseCase`.
  - Eliminar exports de clases antiguas (`GetLessonUseCase`, etc.).

- [ ] **Actualizar tests de use-cases**:
  - Renombrar archivos: `orchestrate-lesson-flow.test.ts` → `orchestrate-recipe-flow.test.ts`, `orchestrate-lesson.integration.test.ts` → `orchestrate-recipe.integration.test.ts`.
  - Actualizar imports y referencias a clases UseCase.
  - Asegurar que los tests usen `recipeId` en lugar de `lessonId`.

- [ ] **Actualizar contenedor DI en `apps/api/src/index.ts`**:
  - Reemplazar `new OrchestrateLessonUseCase(...)` por `new OrchestrateRecipeUseCase(...)`.
  - Ajustar cualquier import antiguo.

- [ ] **Revisar y alinear interfaces AI-related**:
  - Verificar que `AIService.generateResponse` acepte `lesson: Recipe` (o `lesson: any` temporal) pero con tipos correctos. Idealmente crear un tipo `LessonContext` que represente los datos necesarios para la generación ( Recipe + Step + Atom).
  - Asegurar que los campos `currentState`, `currentSegment`, `totalSegments` estén definidos en los DTOs de entrada del AI.

- [ ] **Migrar seeds y datos de prueba** (si existen) para usar `recipeId` en lugar de `lessonId`.

**Nota**: Todas estas tareas son **posteriores a la migración de schema**, por lo que se debe garantizar que no se rompa la compatibilidad con la base de datos. Los nombres de tablas y columnas ya están correctos (Recipe, etc.). Sólo se cambian nombres de clases y variables en código.

# Tareas de Alineación de Capa de Aplicación

**Estado:** Inconsistencias detectadas entre la capa de aplicación y el dominio/schema actual (basado en el nuevo modelo Recipe/Atom).

- [ ] **Renombrar clases de use-cases de "Lesson" a "Recipe"**:
  - `GetLessonUseCase` → `GetRecipeUseCase` (y actualizar barrel index)
  - `ListLessonsUseCase` → `ListRecipesUseCase` (y actualizar barrel index)
  - `OrchestrateLessonUseCase` → `OrchestrateRecipeUseCase` (y actualizar barrel index)
  - Actualizar todos los imports correspondientes en `index.ts` y en controladores HTTP.

- [ ] **Actualizar DTOs en `application/dto/index.ts`**:
  - `StartLessonInputSchema` → `StartRecipeInputSchema` con campo `recipeId` (actualmente usa `lessonId`).
  - `StartLessonOutputSchema` → `StartRecipeOutputSchema` (o mantener nombre si es API pública pero documentar).
  - `InteractLessonInputSchema` → `InteractRecipeInputSchema` (o mantener si es API pública).
  - `InteractLessonOutputSchema` → `InteractRecipeOutputSchema`.
  - `GetLessonInputSchema` → `GetRecipeInputSchema`.
  - `ListLessonsInputSchema` → `ListRecipesInputSchema`.
  - Asegurar consistencia de nombres en tipos exportados.

- [ ] **Eliminar casts `as any` en `OrchestrateLessonUseCase`**:
  - En `start()`: pasar `recipe` correctamente a `aiService.generateResponse` (definir tipo AIResponseInput o similar que coincida con la entidad Recipe y Atom, sin usar `as any`).
  - En `interact()`: mismo para `currentSegment` y `lesson` (usar tipos fuertes del dominio).
  - Esto requiere revisar la interfaz `AIService` y sus DTOs de entrada para alinearlos con `Recipe` y `Atom`.

- [ ] **Actualizar controladores HTTP**:
  - `LeccionController.ts` → `RecipeController.ts` (y rutas `leccion.ts` → `recipe.ts`).
  - Ajustar endpoints y nombres de parámetros (ej: `/lessons` → `/recipes`, `lessonId` → `recipeId`).
  - Actualizar validación de DTOs en controladores.

- [ ] **Tests de use-cases**:
  - Renombrar archivos de test: `orchestrate-lesson-flow.test.ts` → `orchestrate-recipe-flow.test.ts`, `orchestrate-lesson.integration.test.ts` → `orchestrate-recipe.integration.test.ts`.
  - Actualizar referencias a `GetLessonUseCase`, `ListLessonsUseCase` en tests.
  - Asegurar que los tests usen los nuevos nombres de DTOs.

- [ ] **Barrel index `application/use-cases/index.ts`**:
  - Actualizar exports con los nuevos nombres de clases: `GetRecipeUseCase`, `ListRecipesUseCase`, `OrchestrateRecipeUseCase`.

- [ ] **Verificar integridad de dependencias**:
  - Asegurarse de que `OrchestrateRecipeUseCase` (antiguo OrchestrateLessonUseCase) reciba `RecipeStep` correctamente desde `RecipeRepository` (ya está, pero confirmar).
  - Confirmar que la propiedad `steps` de `Recipe` sea `readonly RecipeStep[]` y que el repositorio la carga correctamente.

**Resumen:** La capa de aplicación aún usa terminología antigua ("Lesson") que no coincide con el schema actual ("Recipe"). Se requiere un refactor de nombres en use-cases, DTOs, controladores y tests, además de eliminar casts any para garantizar type-safety.

- [x] [apps/api/src/infrastructure/__tests__/adapters/http/routes/leccion.test.ts] - Actualizado test de rutas HTTP: renombrado de `leccion` a `recipe`, parámetros `lessonId` → `recipeId`, endpoints `/api/leccion/*` → `/api/recipe/*`.

# Tareas Futuras

- [High-level: Implementar migración de datos de Leccion/LeccionChunk a Recipe/Atom]
- [High-level: Crear seeders para niveles, módulos y recetas de ejemplo]
- [High-level: Implementar sistema de caché para recetas y átomos]
- [High-level: Documentar nuevo flujo pedagógico basado en Recipes]
