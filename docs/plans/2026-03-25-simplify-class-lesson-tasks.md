# Desglose de tareas: Simplificar ClassLesson

## Contexto

ClassLesson se simplifica: elimina `title` y `duration`, hace `recipeId` obligatorio.

## FASE 1: Base de Datos

### Tarea 1.1: Modificar `schema.prisma` (ClassLesson)

- **Descripción clara:** Eliminar los campos `title` y `duration`, y hacer que `recipeId` sea obligatorio en el modelo `ClassLesson`.
- **Archivo(s) a modificar:** `apps/api/prisma/schema.prisma`
- **Qué cambiar exactamente:**
  - Eliminar la línea `title String?`
  - Eliminar la línea `duration Int?`
  - Cambiar `recipeId String?` a `recipeId String`
- **Criterio de completitud:** `schema.prisma` refleja la nueva estructura de `ClassLesson`.

### Tarea 1.2: Crear migración

- **Descripción clara:** Generar una nueva migración de Prisma para aplicar los cambios en el esquema.
- **Archivo(s) a modificar:** Nuevo archivo de migración bajo `apps/api/prisma/migrations/`
- **Qué cambiar exactamente:** Ejecutar el comando `pnpm --filter @pixel-mentor/api db:migrate dev --name simplify-class-lesson`
- **Criterio de completitud:** Se crea un nuevo archivo de migración con los cambios de esquema.

### Tarea 1.3: Migrar datos existentes (lecciones sin `recipeId`)

- **Descripción clara:** Implementar una migración de datos para manejar los registros de `ClassLesson` existentes que no tienen un `recipeId`. Esto implicará asignar un `recipeId` por defecto, o manejar los datos relacionados si no se puede asociar un `recipeId` válido (ej. eliminación o asignación a una "receta por defecto"). La estrategia exacta debe definirse basada en la criticidad de los datos existentes.
- **Archivo(s) a modificar:** El archivo de migración generado en la Tarea 1.2.
- **Qué cambiar exactamente:** Añadir lógica dentro del archivo de migración para:
  1.  Identificar todos los registros de `ClassLesson` que actualmente no tienen un `recipeId`.
  2.  Para cada uno de estos registros, asignar un `recipeId` válido (ej. a una receta por defecto o a una receta existente relevante). Alternativamente, si los datos sin `recipeId` no son críticos, se pueden eliminar.
- **Criterio de completitud:** La migración se ejecuta correctamente y todos los registros existentes de `ClassLesson` tienen un `recipeId` válido, o se han manejado adecuadamente.

## FASE 2: Backend

### Tarea 2.1: Actualizar DTOs (AddLessonSchema, UpdateLessonSchema)

- **Descripción clara:** Modificar los DTOs para agregar y actualizar `ClassLesson` para eliminar `title` y `duration`, y asegurar que `recipeId` sea un campo requerido en `AddLessonSchema` y opcional en `UpdateLessonSchema`.
- **Archivo(s) a modificar:** `packages/shared/src/schemas/lesson.ts` (o ruta similar en el backend si los DTOs no son compartidos)
- **Qué cambiar exactamente:**
  - Eliminar referencias a `title` y `duration` en `AddLessonSchema` y `UpdateLessonSchema`.
  - Asegurar que `recipeId` sea un campo requerido en `AddLessonSchema` (ej. `z.string()`).
  - Asegurar que `recipeId` sea un campo opcional para actualización en `UpdateLessonSchema` (ej. `z.string().optional()`).
- **Criterio de completitud:** Los DTOs reflejan correctamente la nueva estructura de `ClassLesson`.

### Tarea 2.2: Actualizar repositorio ClassLessonRepository

- **Descripción clara:** Ajustar el `ClassLessonRepository` para reflejar el modelo `ClassLesson` actualizado, específicamente en relación con la eliminación de `title`/`duration` y la obligatoriedad de `recipeId`.
- **Archivo(s) a modificar:** `apps/api/src/modules/class-lesson/class-lesson.repository.ts` (o ruta similar)
- **Qué cambiar exactamente:**
  - Eliminar cualquier referencia a `title` y `duration` en las operaciones de `create`, `update` y `find`.
  - Asegurar que `recipeId` se maneje correctamente para la creación y actualización, asumiendo su presencia.
- **Criterio de completitud:** Los métodos del repositorio interactúan correctamente con el modelo `ClassLesson` simplificado.

### Tarea 2.3: Actualizar rutas HTTP (POST, PATCH lecciones)

- **Descripción clara:** Modificar las rutas de la API para crear y actualizar lecciones, utilizando los DTOs actualizados y manejando la ausencia de `title`/`duration` y la presencia de `recipeId`.
- **Archivo(s) a modificar:** `apps/api/src/modules/class-lesson/class-lesson.controller.ts` (o ruta similar)
- **Qué cambiar exactamente:**
  - Actualizar los controladores para `POST /lessons` y `PATCH /lessons/:id` para usar los nuevos DTOs (ej. `@Body() createLessonDto: AddLessonSchema`).
  - Eliminar cualquier lógica relacionada con `title` y `duration` en los controladores.
  - Asegurar que `recipeId` se pase y procese correctamente.
- **Criterio de completitud:** Los endpoints de la API funcionan correctamente con la nueva estructura de `ClassLesson`.

### Tarea 2.4: Actualizar validación de publicación

- **Descripción clara:** Ajustar cualquier lógica de validación relacionada con la publicación de una clase o lección para asegurar que `recipeId` siempre esté presente para las `ClassLesson`.
- **Archivo(s) a modificar:** `apps/api/src/modules/class-lesson/class-lesson.service.ts` o `apps/api/src/modules/class/class.service.ts` (dependiendo de dónde resida la validación de publicación).
- **Qué cambiar exactamente:** Añadir o modificar las reglas de validación para asegurar que una `ClassLesson` tenga un `recipeId` antes de que se pueda publicar. Esto podría implicar verificar la existencia de `recipeId` en cada `ClassLesson` asociada a una clase antes de marcar la clase como publicable.
- **Criterio de completitud:** La validación de publicación aplica correctamente la presencia de `recipeId`.

## FASE 3: Shared

### Tarea 3.1: Actualizar tipos compartidos (ClassLesson type)

- **Descripción clara:** Actualizar la definición del tipo TypeScript compartido para `ClassLesson` para eliminar `title` y `duration` y hacer que `recipeId` sea no opcional.
- **Archivo(s) a modificar:** `packages/shared/src/types/class-lesson.ts` (o ruta similar)
- **Qué cambiar exactamente:**
  - Eliminar `title?: string;`
  - Eliminar `duration?: number;`
  - Cambiar `recipeId?: string;` a `recipeId: string;`
- **Criterio de completitud:** El tipo `ClassLesson` refleja con precisión el modelo simplificado.

## FASE 4: Frontend

### Tarea 4.1: Actualizar store `classStore` (interfaces y acciones)

- **Descripción clara:** Modificar el `classStore` para reflejar la estructura actualizada de `ClassLesson` en sus interfaces y en cualquier acción que interactúe con objetos `ClassLesson`.
- **Archivo(s) a modificar:** `apps/web/src/stores/classStore.ts` (o ruta similar)
- **Qué cambiar exactamente:**
  - Actualizar la definición de la interfaz `ClassLesson`.
  - Ajustar cualquier acción (ej. `addLesson`, `updateLesson`) para manejar la ausencia de `title`/`duration` y la obligatoriedad de `recipeId`.
- **Criterio de completitud:** `classStore` gestiona correctamente los objetos `ClassLesson` con la nueva estructura.

### Tarea 4.2: Actualizar componente `ClassLessonList`

- **Descripción clara:** Actualizar el componente `ClassLessonList` para que ya no muestre `title` o `duration` y para que maneje correctamente `recipeId`.
- **Archivo(s) a modificar:** `apps/web/src/components/ClassLessonList.tsx` (o ruta similar)
- **Qué cambiar exactamente:**
  - Eliminar cualquier lógica de renderizado o elementos de UI relacionados con `title` y `duration`.
  - Asegurar que `recipeId` se utilice correctamente (ej. para mostrar el nombre de la receta o un enlace a ella).
- **Criterio de completitud:** `ClassLessonList` se renderiza correctamente sin `title`/`duration` y utiliza `recipeId`.

### Tarea 4.3: Actualizar página `ClassEditorPage`

- **Descripción clara:** Modificar la página `ClassEditorPage` para eliminar los campos de entrada de `title` y `duration` para las lecciones, e integrar un `RecipeSelector` para `recipeId`.
- **Archivo(s) a modificar:** `apps/web/src/pages/ClassEditorPage.tsx` (o ruta similar)
- **Qué cambiar exactamente:**
  - Eliminar los campos de entrada para `title` y `duration` en la sección de edición de lecciones.
  - Integrar el componente `RecipeSelector` para permitir al usuario seleccionar y asignar un `recipeId` a una lección.
- **Criterio de completitud:** `ClassEditorPage` permite editar lecciones con el nuevo campo `recipeId` y sin `title`/`duration`.

### Tarea 4.4: Crear/actualizar `RecipeSelector` si es necesario

- **Descripción clara:** Desarrollar un nuevo componente `RecipeSelector` o actualizar uno existente para permitir a los usuarios seleccionar fácilmente un `recipeId` para una lección.
- **Archivo(s) a modificar:** `apps/web/src/components/RecipeSelector.tsx` (o nuevo archivo)
- **Qué cambiar exactamente:** Crear un componente reutilizable que obtenga y muestre una lista de recetas para su selección, devolviendo el `recipeId` seleccionado.
- **Criterio de completitud:** Un componente `RecipeSelector` funcional está disponible y puede ser integrado.

### Tarea 4.5: Actualizar API service

- **Descripción clara:** Actualizar la capa de servicio de la API del frontend para enviar y recibir datos de `ClassLesson` que se ajusten a la nueva estructura del backend.
- **Archivo(s) a modificar:** `apps/web/src/services/api.ts` o `apps/web/src/services/lesson.ts` (o ruta similar)
- **Qué cambiar exactamente:**
  - Modificar las funciones `createLesson` y `updateLesson` para que pasen `recipeId` y no `title`/`duration`.
  - Ajustar el análisis de datos para los objetos `ClassLesson` entrantes.
- **Criterio de completitud:** Las llamadas a la API del frontend interactúan correctamente con los endpoints actualizados del backend.

## FASE 5: Verificación

### Tarea 5.1: Typecheck backend y frontend

- **Descripción clara:** Ejecutar las comprobaciones de tipos de TypeScript tanto para el backend como para el frontend para detectar cualquier error relacionado con tipos introducido por los cambios.
- **Archivo(s) a modificar:** N/A (comprobación de tipos a nivel de proyecto)
- **Qué cambiar exactamente:** Ejecutar `pnpm --filter @pixel-mentor/api typecheck` y `pnpm --filter @pixel-mentor/web typecheck` (o comandos similares).
- **Criterio de completitud:** Ambas comprobaciones de tipos de backend y frontend pasan sin errores.

### Tarea 5.2: Probar flujo completo: crear receta → crear clase → agregar lección → publicar → demo

- **Descripción clara:** Probar manualmente todo el flujo de usuario para asegurar que se puede crear una receta, crear una clase, añadir una lección a la clase con una receta seleccionada, publicar la clase y luego demostrarla.
- **Archivo(s) a modificar:** N/A (pruebas manuales)
- **Qué cambiar exactamente:**
  - Verificar que la creación de una nueva receta funciona.
  - Verificar que la creación de una nueva clase funciona.
  - Verificar que al añadir una lección a una clase ya no se piden `title`/`duration` pero se requiere la selección de una receta.
  - Verificar que la publicación de una clase con lecciones vinculadas a recetas funciona.
  - Verificar que la clase publicada y sus lecciones (con las recetas asociadas) se muestran correctamente.
- **Criterio de completitud:** El flujo completo de extremo a extremo funciona como se espera de acuerdo con la nueva estructura de `ClassLesson`.
