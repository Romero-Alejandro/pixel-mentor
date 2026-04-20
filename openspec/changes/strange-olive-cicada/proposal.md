# Proposal: Content Control and Room Isolation (strange-olive-cicada)

## Intent
Implementar un control de contenido robusto, escalable y bien aislado en Pixel Mentor.

### 1. Estado Actual del Control de Contenido
Actualmente, el sistema carece de un modelo formal para asignar contenido específico a grupos definidos de estudiantes bajo la tutoría de un profesor. Esto representa un problema de seguridad de datos, ya que podría provocar la exposición no deseada de material.

### 2. Problemas Detectados (P1-P4)
- **P1: Fuga de Información:** Riesgo de que los estudiantes accedan a material que no les fue asignado explícitamente.
- **P2: Falta de Aislamiento:** El contenido de los profesores no está correctamente particionado por sala o grupo de estudio.
- **P3: Multi-tenancy Incompleto:** Un estudiante no puede pertenecer fácilmente a múltiples salas con diferentes niveles y contextos de acceso de forma concurrente.
- **P4: Propiedad Ambivalente:** Los controles de autorización en el backend no verifican de manera estricta la propiedad del contenido frente a la inscripción real del estudiante en un contexto dado.

## Scope

### In Scope
**3. Solución Propuesta:** 
Introducir la entidad `ClassEnrollment` en la base de datos para modelar de forma precisa la relación muchos-a-muchos entre Usuarios (Alumnos) y Salas (Rooms). El backend aplicará validaciones estrictas, asegurando que el contenido solo se entregue si el usuario que realiza la petición es el Propietario (Profesor) o cuenta con una inscripción activa (`ClassEnrollment`) en la sala donde reside dicho contenido.

**4. Alcance del Cambio:**
- Creación de la entidad `ClassEnrollment`.
- Habilitar que un profesor tenga contenido aislado y pueda crear múltiples salas.
- Cada sala agrupará alumnos específicos y asignará el contenido pertinente.
- Un alumno podrá pertenecer a múltiples salas simultáneamente.
- Reglas de visibilidad: El contenido será accesible únicamente para los usuarios asignados explícitamente, basándose en pertenencia, propiedad y permisos.

### Out of Scope
- Monetización o cobros por inscripción a las salas.
- Sistemas de comunicación o chat en tiempo real dentro de las salas.

## Capabilities

### New Capabilities
- `content-isolation`: Aislamiento y control de acceso riguroso a contenido por sala.
- `class-management`: Creación de salas y gestión del ciclo de vida de `ClassEnrollment`.

### Modified Capabilities
- None

## Approach

### 5. Beneficios Esperados
- **Seguridad:** Aislamiento total del contenido del profesor, eliminando las fugas de información.
- **Escalabilidad:** Arquitectura preparada para soportar múltiples instituciones o cohortes en paralelo.
- **Flexibilidad:** Permite a los estudiantes gestionar múltiples inscripciones sin choques de permisos.

### 6. Consideraciones de Implementación
- **Arquitectura Hexagonal (Backend):** Los chequeos de autorización deben ocurrir en la capa de Aplicación (`use-cases`), asegurando que las reglas de negocio sean agnósticas a la red.
- **Base de Datos:** Se debe crear una llave compuesta `[userId, roomId]` en `ClassEnrollment` para garantizar la unicidad de las inscripciones.
- **Filtrado en el Origen:** Las consultas al repositorio deben incorporar de forma nativa los filtros de Ownership (profesor) o Enrollment (alumno).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/database/prisma/schema.prisma` | Modified | Añadir entidad `ClassEnrollment` y relaciones con User/Room. |
| `apps/api/src/features/rooms` | Modified | Lógica de `application/use-cases` para crear salas y gestionar inscripciones. |
| `apps/api/src/features/content` | Modified | Implementar Guard Clauses (verificar autorizaciones) al servir contenido. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Fuga de datos en endpoints no refactorizados | High | Estandarizar y auditar todos los endpoints de contenido usando un middleware o guard clause unificado. |
| Degradación del rendimiento (N+1 queries) | Medium | Usar adecuadamente los `include` de Prisma y definir índices óptimos en BDD. |

## Rollback Plan
- Revertir los cambios en el esquema de Prisma y realizar un *rollback* de las migraciones SQL.
- Revertir los commits del backend para restaurar los controladores y casos de uso a su estado previo.

## Dependencies
- Modificaciones al esquema de Prisma.
- Generación de artefactos de Prisma (`db:generate`) y aplicación en PostgreSQL (`db:migrate`).

## Success Criteria
- [ ] Un profesor puede aislar su contenido y crear múltiples salas para diferentes grupos.
- [ ] Los alumnos solo pueden ver el contenido de las salas en las que están explícitamente inscritos.
- [ ] Intentos de acceso a contenido no autorizado retornan sistemáticamente un error HTTP 403 (Forbidden).