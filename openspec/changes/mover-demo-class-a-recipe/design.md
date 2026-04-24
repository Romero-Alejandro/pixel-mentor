# Diseño Técnico: Migrar función DEMO de Class a Recipe

## Technical Approach

La migración se realizará en tres fases principales: (1) Eliminar la funcionalidad de demo existente de `ClassEditorPage` y su store asociado `useClassStore`. (2) Introducir la nueva funcionalidad de demo en `RecipeEditorPage` y su store `useRecipeStore`, conectándola a un nuevo endpoint de API. (3) Refactorizar los hooks `useLessonQueries` y `useLessonSession` que tienen dependencias ocultas con la funcionalidad de demo de clases que se va a eliminar, para que utilicen el nuevo flujo de recetas.

## Architecture Decisions

### Decisión: Centralizar la lógica de inicio de sesión en `useRecipeStore`
- **Choice**: La lógica para llamar a la API, manejar los estados de carga/error y la redirección se implementará dentro de una nueva acción `startRecipeDemo` en el store de Zustand `useRecipeStore`.
- **Alternatives considered**:
    1.  Manejar la lógica directamente en el componente `RecipeEditorPage.tsx` con `useMutation` de React Query.
    2.  Mantener la lógica en los hooks `useLessonSession` o `useLessonQueries`.
- **Rationale**: Centralizar la lógica en el store de Zustand (`useRecipeStore`) es consistente con el patrón de manejo de estado existente en la aplicación. Desacopla la lógica de negocio del componente de la UI y de los hooks de fetching, facilitando el mantenimiento y las pruebas. Los hooks `useLessonSession` y `useLessonQueries` demostraron ser un punto de confusión y dependencias ocultas.

## Data Flow

El flujo de datos para iniciar una demo de receta será el siguiente:

```
Usuario
   │
   ├─> 1. Clic en "Start Demo"
   │
RecipeEditorPage.tsx
   │
   ├─> 2. Llama a useRecipeStore.startRecipeDemo(recipeId)
   │
useRecipeStore (Zustand)
   │
   ├─> 3. Pone isStartingDemo = true
   │
   ├─> 4. Llama a api.startRecipeDemo(recipeId)
   │
api.ts
   │
   ├─> 5. POST /api/student/recipes/:recipeId/start
   │
Backend API
   │
   ├─> 6. Devuelve { sessionId, ... }
   │
api.ts
   │
   ├─> 7. Retorna la respuesta
   │
useRecipeStore
   │
   ├─> 8. Pone isStartingDemo = false
   │
   └─> 9. Usa el router para navegar a `/lesson/${sessionId}`
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/web/src/pages/ClassEditorPage.tsx` | Modify | Eliminar el botón "Start Demo" y la llamada al store `useClassStore.startClassDemo`. |
| `apps/web/src/pages/RecipeEditorPage.tsx` | Modify | Añadir el nuevo botón "Start Demo", su lógica condicional (deshabilitado si no hay pasos), el tooltip y la llamada a `useRecipeStore.startRecipeDemo`. |
| `apps/web/src/features/class-management/stores/class.store.ts` | Modify | Eliminar la acción `startClassDemo` y cualquier estado relacionado. |
| `apps/web/src/features/recipe-management/stores/recipe.store.ts` | Modify | Añadir la acción `startRecipeDemo(recipeId)` y el estado `isStartingDemo`. |
| `apps/web/src/services/api.ts` | Modify | Crear la función `startRecipeDemo(recipeId)` que llama al nuevo endpoint. Eliminar `startClassDemo`. |
| `apps/web/src/features/lesson/hooks/useLessonQueries.ts` | Modify | Eliminar la exportación `useStartClassDemo` y su alias `useStartLesson`. |
| `apps/web/src/features/lesson/hooks/useLessonSession.ts` | Modify | Refactorizar el `startMutation` dentro de `useLessonSession` para que use `api.startRecipeDemo` y acepte `recipeId` en lugar de `classId`. |
| `apps/api/src/student/recipes/recipes.controller.ts` | Create/Modify | Implementar el nuevo endpoint `POST /:recipeId/start`. (Asumido, tarea del backend). |
| `apps/web/src/features/recipe-management/stores/recipe.store.spec.ts`| Create/Modify | Añadir pruebas unitarias para la nueva acción `startRecipeDemo`. |

## Interfaces / Contracts

### Store `useRecipeStore` State
```typescript
interface RecipeState {
  // ... existing state
  isStartingDemo: boolean;
  startRecipeDemo: (recipeId: string) => Promise<{ sessionId: string } | void>;
}
```

### API Client `api.ts`
```typescript
// Nuevo método
async startRecipeDemo(recipeId: string): Promise<{ sessionId: string; recipeId: string; title: string }> {
  const response = await apiClient.post(`/student/recipes/${recipeId}/start`);
  return response.data;
}

// Método a eliminar
// async startClassDemo(...)
```

### Respuesta del Endpoint
Definida en las especificaciones.
```typescript
interface StartDemoResponse {
  sessionId: string;
  recipeId: string;
  title: string;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `useRecipeStore.startRecipeDemo` | Mockear `api.startRecipeDemo`. Verificar que `isStartingDemo` se establece a `true` y luego `false`. Verificar que la función de navegación se llama con la URL correcta en caso de éxito. Verificar el manejo de errores. |
| Integration | `RecipeEditorPage` | Montar el componente con un mock del store. Simular un clic en el botón "Start Demo" y verificar que la acción del store es llamada. Probar los estados `disabled` y de carga del botón. |
| E2E | Flujo completo de "Start Demo" | Usar Playwright. Navegar a la página de edición de una receta. Hacer clic en "Start Demo". Verificar que la URL cambia a `/lesson/...` y que la página de la lección se carga correctamente. |

## Risks and Mitigations

- **Riesgo 1: Breaking Changes por dependencias ocultas.**
  - **Descripción**: La función `api.startClassDemo` es usada no solo en el store, sino también en los hooks `useLessonQueries` y `useLessonSession`. Eliminarla sin más rompería otras partes de la aplicación.
  - **Mitigación**: El plan de implementación incluye el refactor de estos hooks. Se deberá modificar `useLessonSession` para que utilice el nuevo `api.startRecipeDemo` y se eliminará la exportación `useStartClassDemo` de `useLessonQueries`, forzando a los consumidores a usar el nuevo flujo. Se realizará una búsqueda global de `startClassDemo` antes de finalizar para asegurar que no queden referencias.

- **Riesgo 2: Endpoint del backend no disponible.**
  - **Descripción**: El frontend depende del nuevo endpoint `POST /api/student/recipes/:recipeId/start` que debe ser implementado por el equipo de backend.
  - **Mitigación**: Coordinar con el equipo de backend para asegurar la disponibilidad del endpoint. Mientras tanto, se puede desarrollar y probar el frontend contra un servidor de API mockeado (e.g., usando MSW - Mock Service Worker) que simule las respuestas esperadas.

- **Riesgo 3: Inconsistencia en el manejo de estado de sesión.**
  - **Descripción**: El hook `useLessonSession` parece ser una implementación antigua que gestiona el estado de la sesión de una manera diferente a los hooks más nuevos. Modificarlo podría introducir regresiones.
  - **Mitigación**: Las pruebas E2E son cruciales aquí. Se debe crear un test E2E que valide el flujo de inicio de lección de principio a fin antes de realizar el refactor, y asegurarse de que siga pasando después. Esto actuará como una red de seguridad contra regresiones.

## Open Questions

- [ ] ¿El hook `useLessonSession` está siendo utilizado activamente o es código obsoleto que puede ser reemplazado completamente por los hooks más granulares como `useStartLesson` y `useInteractLesson`? Se necesita investigar su uso en la codebase.
