# Propuesta: Simplificar la Entidad `ClassLesson`

## Intención

El objetivo de este cambio es simplificar la relación entre las entidades `Class`, `ClassLesson` y `Recipe`, eliminando la duplicación de datos y previniendo estados inválidos en el sistema. Actualmente, `ClassLesson` duplica información (título y duración) que ya existe en `Recipe`, y permite la creación de lecciones sin contenido asociado. Este cambio hará que `ClassLesson` actúe puramente como una tabla de unión organizacional entre `Class` y `Recipe`.

## Alcance

### Dentro del Alcance

- Modificar el `schema.prisma` para eliminar los campos `title` y `duration` de la entidad `ClassLesson`.
- Hacer que el campo `recipeId` en `ClassLesson` sea obligatorio.
- Actualizar los DTOs, repositorios, y rutas del backend para reflejar los cambios en el modelo de datos.
- Actualizar los tipos compartidos en el paquete `packages/shared`.
- Modificar los stores de Zustand, componentes y páginas del frontend que consumen o manipulan `ClassLesson`.
- Crear un script de migración para manejar los datos existentes, asegurando que las lecciones existentes se asocien correctamente a sus recetas.

### Fuera del Alcance

- Modificaciones a la lógica de creación o gestión de la entidad `Recipe` más allá de su relación con `ClassLesson`.
- Cambios en el sistema de autenticación o autorización de los tutores.
- Implementación de nuevas funcionalidades no relacionadas directamente con la estructura de `ClassLesson`.

## Enfoque

El cambio se abordará en tres frentes principales:

1.  **Base de Datos:** Se modificará el `schema.prisma` para ajustar la entidad `ClassLesson`. Se generará una nueva migración de base de datos.
2.  **Backend:** Se refactorizarán los servicios y controladores que interactúan con `ClassLesson` para adaptarse al nuevo esquema. Se eliminará la lógica que maneja `title` y `duration` en `ClassLesson` y se obtendrán estos datos directamente de la `Recipe` asociada.
3.  **Frontend:** Se ajustarán las interfaces de usuario para el tutor. El flujo de creación de lecciones requerirá seleccionar una `Recipe` existente, en lugar de introducir un título y duración manualmente. Las vistas que muestran información de la lección obtendrán los datos de la receta anidada.

## Áreas Afectadas

| Área                            | Impacto    | Descripción                                                                         |
| ------------------------------- | ---------- | ----------------------------------------------------------------------------------- |
| `apps/api/prisma/schema.prisma` | Modificado | `ClassLesson`: se eliminan `title` y `duration`, `recipeId` pasa a ser no opcional. |
| `apps/api/src/class-lesson/`    | Modificado | Actualizar DTOs, servicios y repositorios para el nuevo modelo de `ClassLesson`.    |
| `apps/web/src/store/`           | Modificado | Actualizar stores de Zustand que manejen datos de clases y lecciones.               |
| `apps/web/src/components/`      | Modificado | Componentes de UI para creación y visualización de lecciones.                       |
| `packages/shared/src/types/`    | Modificado | Actualizar tipos e interfaces compartidas relacionadas con `ClassLesson`.           |

## Riesgos

| Riesgo                                    | Probabilidad | Mitigación                                                                                                                                                                                                               |
| ----------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Datos existentes inválidos                | Media        | Se creará un script de migración para identificar `ClassLesson` sin `recipeId` o para limpiar los campos `title` y `duration` duplicados. Las lecciones sin receta no podrán ser publicadas hasta que se les asigne una. |
| Impacto en la experiencia de usuario (UX) | Baja         | El flujo de creación de lecciones para los tutores cambiará. Se debe comunicar claramente el nuevo flujo (crear receta primero, luego asignarla a una clase) y asegurar que la interfaz de usuario sea intuitiva.        |
| Errores en cascada                        | Media        | Dado que el cambio afecta a toda la pila (BD, backend, frontend), se realizarán pruebas de integración completas para validar el flujo de creación, edición y visualización de clases y lecciones de principio a fin.    |

## Plan de Reversión

En caso de un fallo crítico post-despliegue, se puede revertir el cambio de la siguiente manera:

1.  Revertir el commit que contiene los cambios en el código fuente.
2.  Aplicar la migración de base de datos anterior (`prisma migrate down`) para restaurar el esquema de la base de datos a su estado previo. No se perderán datos, ya que los campos solo se eliminan, no se alteran de forma destructiva.

## Criterios de Aceptación

- [ ] El esquema de `ClassLesson` en Prisma ya no contiene los campos `title` y `duration`.
- [ ] El campo `recipeId` en `ClassLesson` es obligatorio y no nulo en la base de datos.
- [ ] No es posible crear una `ClassLesson` sin asociarle una `Recipe` existente a través de la API y la interfaz de usuario.
- [ ] La información de título y duración de una lección se muestra correctamente en el frontend, obteniéndola de la `Recipe` asociada.
- [ ] Los datos existentes se han migrado correctamente, y las lecciones previamente existentes funcionan como se espera.
- [ ] Todas las pruebas unitarias y de integración relacionadas con `ClassLesson` pasan con éxito.
