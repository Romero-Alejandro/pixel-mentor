# Documento de Diseño Técnico: Control de Contenido por Grupos y Secuencia Gamificada

## ID de Cambio: `feature/classroom-content-control`

Basado en:
- **Especificaciones:** `confidential-purple-scallop` (actualizadas)
- **Propuesta:** `secure-tomato-crab`

## 1. Resumen y Objetivo

Este documento detalla el diseño técnico para implementar un sistema de **Grupos** (cohortes) y **Secuencia Gamificada** en Pixel Mentor. El objetivo es permitir a los profesores:

* Crear uno o más grupos aislados.
* Añadir/eliminar alumnos a un grupo de forma masiva.
* Ordenar una lista de clases (lecciones) dentro de cada grupo, definiendo el camino de aprendizaje.
* Asegurar que solo los usuarios autorizados (profesor propietario, estudiante miembro activo del grupo, o admin) puedan acceder al contenido (recetas) asociado a las clases en su secuencia.
* Prevenir cualquier fuga de información entre diferentes grupos o profesores.

El diseño se adhiere a la arquitectura hexagonal existente del backend, asegurando la separación de responsabilidades y la escalabilidad del sistema.

## 2. Decisiones de Arquitectura

La implementación se integrará en la arquitectura hexagonal existente de la siguiente manera:

### Capa de Dominio (`domain/`)
- Se crearán nuevas entidades: `Group`, `GroupMember`, `GroupClass`, manteniendo las existentes `User`, `Recipe`, `Classroom` (renombrada de "Room"/"Class" para claridad) y `ClassRecipe`.
- Estas entidades contendrán la lógica de negocio pura y las invariantes. Por ejemplo, la entidad `Group` será responsable de validar su propio estado, pero no de cómo se persiste. El dominio no tendrá dependencias externas.

### Capa de Aplicación (`application/`)
- Se crearán nuevos casos de uso para manejar las operaciones:
  - `CreateGroupUseCase`
  - `UpdateGroupUseCase`
  - `DeleteGroupUseCase`
  - `AddGroupMembersUseCase` (operación masiva)
  - `RemoveGroupMembersUseCase` (uno o muchos)
  - `AssignClassToGroupUseCase` (con orden)
  - `UpdateGroupClassOrderUseCase` (reordenar)
  - `GetGroupClassesUseCase` (lista ordenada)
  - `GetRecipeForUserUseCase` (acceso a una receta)
  - `ListAccessibleRecipesForStudentUseCase` (listado filtrado)
- Estos casos de uso orquestarán las entidades de dominio y los repositorios de infraestructura. Aquí residirá la lógica de autorización principal (p. ej., "verificar que el usuario que asigna una clase a un grupo es el propietario del grupo y de la clase").

### Capa de Infraestructura (`infrastructure/`)
- **Persistencia**: Se actualizará `prisma/schema.prisma` para incluir los nuevos modelos. Se implementarán repositorios (`PrismaGroupRepository`, `PrismaGroupMemberRepository`, `PrismaGroupClassRepository`, `PrismaClassroomRepository`, `PrismaRecipeRepository`, etc.) que se encargarán de la comunicación con la base de datos.
- **Controladores y Rutas**: Se crearán nuevos endpoints en la API (`groups.controller.ts`, `groups.routes.ts`) para exponer los casos de uso a través de rutas REST.
- **Middleware**: Se utilizará middleware de autenticación y autorización a nivel de ruta para checks básicos (p. ej., verificar si el usuario es `TEACHER`).

## 3. Modelo de Datos Actualizado

Se añadirán cuatro nuevas tablas a la base de datos para gestionar los grupos, las membresías, las asignaciones ordenadas de clases y se mantendrá la existente de asignación de recetas a clases.

```prisma
// En apps/api/prisma/schema.prisma

// Usuario existente (referencia)
model User {
  id              String        @id @default(cuid())
  email           String        @unique
  name            String?
  role            UserRole      @default(STUDENT) // TEACHER | STUDENT | ADMIN
  passwordHash    String

  // Relaciones existentes
  createdRecipes  Recipe[]      @relation("TeacherRecipes")
  createdClassrooms Classroom[]  @relation("TeacherClassrooms")
  createdGroups   Group[]       @relation("TeacherGroups")
  memberships     GroupMember[] @relation("StudentMemberships")
}

// Receta existente (referencia)
model Recipe {
  id          String        @id @default(cuid())
  title       String
  description String?
  published   Boolean       @default(false)
  teacherId   String
  teacher     User          @relation("TeacherRecipes", fields: [teacherId], references: [id])
  // Una receta puede asignarse a muchas clases (a través de ClassRecipe)
  classAssignments ClassRecipe[] @relation("RecipeClassAssignments")
}

// Entidad para la Clase (antes "Room"/"Class")
model Classroom {
  id          String        @id @default(cuid())
  name        String
  description String?
  status      ClassroomStatus @default(DRAFT) // DRAFT | UNDER_REVIEW | PUBLISHED | ARCHIVED
  teacherId   String
  teacher     User          @relation("TeacherClassrooms", fields: [teacherId], references: [id])
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  // Una clase puede tener muchas recetas asignadas
  recipeAssignments ClassRecipe[] @relation("ClassRecipeAssignments")
  // Puede estar incluida en muchos grupos (a través de GroupClass)
  groupAssignments  GroupClass[]  @relation("ClassGroupAssignments")

  @@index([teacherId])
}

// --- NUEVAS ENTIDADES ---

// Entidad para el Grupo (Cohorte)
model Group {
  id          String   @id @default(cuid())
  name        String   // ej. "Cohorte de Principiantes – Abril 2026"
  description String?
  teacherId   String   // propietario del grupo (el profesor que lo creó)
  teacher     User     @relation("TeacherGroups", fields: [teacherId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relaciones
  memberships   GroupMember[] @relation("GroupMemberships")
  classAssignments GroupClass[]  @relation("GroupClassAssignments")

  @@index([teacherId])
  // Opcional: unique combination teacherId+name si se quiere evitar nombres duplicados por profesor
  // @@unique([teacherId, name], name: "teacher_group_name")
}

// Tabla de unión para Alumnos en un Grupo (Membresía)
model GroupMember {
  id        String   @id @default(cuid())
  groupId   String
  studentId String
  joinedAt  DateTime @default(now())
  status    MemberStatus @default(ACTIVE) // ACTIVE | INACTIVE | COMPLETED

  group   Group   @relation("GroupMemberships", fields: [groupId], references: [id], onDelete: Cascade)
  student User    @relation("StudentMemberships", fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([groupId, studentId]) // un alumno solo puede estar una vez en un mismo grupo
  @@index([studentId])
  @@index([groupId])
}

// Entidad para la Asignación Ordenada Grupo ↔ Clase (camino gamificado)
model GroupClass {
  id        String   @id @default(cuid())
  groupId   String
  classId   String
  order     Int      @default(0)   // posición en la secuencia (0,1,2,...)
  assignedAt DateTime @default(now())

  group   Group   @relation("GroupClassAssignments", fields: [groupId], references: [id], onDelete: Cascade)
  class   Classroom @relation("ClassGroupAssignments", fields: [classId], references: [id], onDelete: Cascade)

  @@unique([groupId, order])   // evita duplicados de orden dentro del mismo grupo
  @@unique([groupId, classId]) // una misma clase no puede aparecer dos veces en el mismo grupo
  @@index([groupId])
  @@index([classId])
  @@index([order])
}

// Tabla de unión existente: Clase ↔ Receta (mantener)
model ClassRecipe {
  id        String   @id @default(cuid())
  classroomId String
  recipeId    String
  assignedAt  DateTime  @default(now())

  classroom Classroom @relation("ClassRecipeAssignments", fields: [classroomId], references: [id], onDelete: Cascade)
  recipe    Recipe    @relation("RecipeClassAssignments", fields: [recipeId], references: [id], onDelete: Cascade)

  @@id([classroomId, recipeId]) // clave primaria compuesta
  @@index([recipeId])
}

// Enums
enum UserRole { STUDENT TEACHER ADMIN }
enum ClassroomStatus { DRAFT UNDER_REVIEW PUBLISHED ARCHIVED }
enum MemberStatus { ACTIVE INACTIVE COMPLETED }
```

### Relaciones Clave:
- **User (Teacher) ↔ Group**: Un profesor tiene muchos grupos (propietario).
- **User (Student) ↔ Group**: Muchos alumnos pueden estar en muchos grupos (relación gestionada por `GroupMember`).
- **User (Teacher) ↔ Classroom**: Un profesor tiene muchas clases (propietario).
- **Classroom ↔ Group**: Muchas clases pueden estar en muchos grupos (relación gestionada por `GroupClass`).
- **Recipe ↔ Classroom**: Muchas recetas pueden ser asignadas a muchas clases (relación gestionada por `ClassRecipe`).

## 4. Flujos de Casos de Uso

### a. Creación de un Grupo por un Profesor
1. **Endpoint**: `POST /api/groups`
2. **Request Body**: `{ "name": "Cohorte Abril 2026", "description": "Primer grupo de principiantes" }`
3. **Middleware de Ruta**: Verifica JWT y rol `TEACHER`.
4. **Controlador**: Llama a `CreateGroupUseCase` con `name`, `description` y `userId` del token.
5. **Caso de Uso**:
   - Crea instancia de `Group` con `teacherId = userId`.
   - Valida que `name` no esté vacío.
   - Persiste mediante `groupRepository.save()`.
6. **Respuesta**: `201 Created` con datos del grupo creado.

### b. Actualización / Eliminación de Grupo (solo profesor propietario)
- Similar a creación, usando `PUT /api/groups/:groupId` y `DELETE /api/groups/:groupId` con casos de uso `UpdateGroupUseCase` y `DeleteGroupUseCase`.
- Autorización: verificar `Group.teacherId === userId`.

### c. Matriculación Masiva de Alumnos en un Grupo
1. **Endpoint**: `POST /api/groups/:groupId/members`
2. **Request Body**: `{ "studentIds": ["uid1", "uid2", "uid3"] }`
3. **Middleware**: verifica JWT y rol `TEACHER`.
4. **Controlador**: llama a `AddGroupMembersUseCase` con `:groupId`, `studentIds` y `userId` del token.
5. **Caso de Uso**:
   - Autorización: `Group.teacherId === userId`.
   - Para cada `studentId`:
     - Verificar que el usuario existe y tiene rol `STUDENT`.
     - Crear instancia `GroupMember` (si no existe ya).
   - Persistir en transacción (opcional pero recomendado).
6. **Respuesta**: `200 OK` o `201 Created` según se crearan nuevos registros.

### d. Eliminación de Alumnos de un Grupo (uno o muchos)
1. **Endpoint**: `DELETE /api/groups/:groupId/members/:studentId` (uno) o `DELETE /api/groups/:groupId/members` con body `{ "studentIds": [...] }`.
2. **Middleware**: verifica JWT y rol `TEACHER`.
3. **Controlador**: llama a `RemoveGroupMembersUseCase`.
4. **Caso de Uso**:
   - Autorización: `Group.teacherId === userId`.
   - Para cada `studentId`: eliminar registro `GroupMember` donde coincida `groupId` y `studentId`.
   - Persistir cambios.
5. **Respuesta**: `200 OK`.

### e. Asignación de una Clase a un Grupo (con orden)
1. **Endpoint**: `POST /api/groups/:groupId/classes`
2. **Request Body**: `{ "classId": "cls_cuid", "order": 0 }`
3. **Middleware**: verifica JWT y rol `TEACHER`.
4. **Controlador**: llama a `AssignClassToGroupUseCase`.
5. **Caso de Uso**:
   - Autorización #1: `Group.teacherId === userId` (profesor es propietario del grupo).
   - Autorización #2: `Classroom.teacherId === userId` (el profesor también es propietario de la clase que intenta asignar).
   - Validar que la combinación `groupId`+`order` y `groupId`+`classId` no exista ya (unicidad).
   - Crear instancia `GroupClass`.
   - Persistir mediante `groupClassRepository.save()`.
6. **Respuesta**: `201 Created`.

### f. Actualización del Orden de una Clase dentro de un Grupo (reordenar)
1. **Endpoint**: `PATCH /api/groups/:groupId/classes/:classId` (body `{ "order": nuevoOrden }`) o endpoint específico para reordenar lista.
   - Alternativamente, endpoint `POST /api/groups/:groupId/classes/reorder` con lista ordenada de classIds.
2. **Middleware**: verifica JWT y rol `TEACHER`.
3. **Controlador**: llama a `UpdateGroupClassOrderUseCase`.
4. **Caso de Uso**:
   - Autorización: `Group.teacherId === userId`.
   - Validar que el nuevo orden no colisione con otra clase en el mismo grupo (o, si se envía lista completa, volver a asignar órdenes 0,1,2...).
   - Actualizar campo `order` en los registros `GroupClass` afectados.
   - Persistir cambios.
5. **Respuesta**: `200 OK`.

### g. Obtener las Clases de un Grupo (ordenadas)
1. **Endpoint**: `GET /api/groups/:groupId/classes`
2. **Middleware**: verifica JWT (cualquier rol autenticado).
3. **Controlador**: llama a `GetGroupClassesUseCase`.
4. **Caso de Uso**:
   - Si el rol es `TEACHER`: verificar que sea el propietario del grupo (`teacherId === userId`).
   - Si el rol es `STUDENT`: verificar exista `GroupMember` con `groupId = :groupId`, `studentId = userId`, `status = ACTIVE`.
   - Si el rol es `ADMIN`: permitir (o aplicar política similar a estudiante? según requerimiento; aquí permitimos lectura).
   - Recuperar todas las `GroupClass` para ese `groupId`, ordenadas por `order ASC`, haciendo `join` a `Classroom` para traer sus datos (id, name, description, status, etc.).
5. **Respuesta**: `200 OK` con lista de objetos `{ id, name, description, status, order }`.

### h. Acceso a una Receta (por estudiante, profesor o admin)
1. **Endpoint**: `GET /api/recipes/:recipeId`
2. **Middleware**: verifica JWT y rol cualquiera (autenticado).
3. **Controlador**: llama a `GetRecipeForUserUseCase` (o delega al repositorio con lógica incorporada).
4. **Caso de Uso / Repositorio**:
   - Buscar la `Recipe` por `id`. Si no existe → `404 Not Found`.
   - **Lógica de Acceso (defensa en profundidad)**:
     - **Regla A – Profesor/Propietario**: si `recipe.teacherId === currentUser.id` → permitido.
     - **Regla B – Administrador**: si `currentUser.role === ADMIN` → permitido.
     - **Regla C – Estudiante vía Grupo y Secuencia**:
       - Si `currentUser.role === STUDENT`:
         * Ejecutar subconsulta que verifica existencia de al menos una ruta:
           ```sql
           EXISTS (
             SELECT 1
             FROM "GroupMember" gm
             JOIN "GroupClass" gc ON gm."groupId" = gc."groupId"
             JOIN "ClassRecipe" cr ON gc."classId" = cr."classId"
             WHERE gm."studentId" = ${currentUser.id}
               AND gm."status" = 'ACTIVE'
               AND cr."recipeId" = ${recipeId}
               -- Opcional: asegurar que la clase esté en estado accesible
               AND EXISTS (
                 SELECT 1 FROM "Classroom" c
                 WHERE c."id" = gc."classId"
                   AND c."status" IN ('PUBLISHED', 'UNDER_REVIEW')
               )
           )
           ```
         * Si subconsulta devuelve verdadera → permitido.
   - Si ninguna regla se cumple → `404 Not Found` (para no filtrar existencia de la receta).
5. **Respuesta**: `200 OK` con datos de la receta si hay permiso, o `404 Not Found` si no.

### i. Listado de Recetas Accesibles para un Estudiante
1. **Endpoint**: `GET /api/recipes` (con filtros opcionales como búsqueda, paginación)
2. **Middleware**: verifica JWT y rol `STUDENT`.
3. **Controlador**: llama a `ListAccessibleRecipesForStudentUseCase`.
4. **Caso de Uso**:
   - Construir consulta que devuelva todas las `Recipe` donde se cumpla la Regla C anterior (estudiante vía grupo y secuencia), aplicando paginación y filtros.
   - Utilizar `JOIN`s a través de `GroupMember → GroupClass → ClassRecipe → Recipe`.
   - Incluir condiciones de estado de clase (`Classroom.status IN ('PUBLISHED','UNDER_REVIEW')`).
5. **Respuesta**: `200 OK` con array de recetas.

## 5. Detalles de Validación de Autorización

La autorización se implementará en dos niveles (defensa en profundidad):

### Middleware de Ruta (Grueso)
- `isAuthenticated`: Verifica que existe un token JWT válido.
- `isTeacher`: Verifica que el usuario autenticado tiene el rol `TEACHER`. Se aplicará a rutas de creación/actualización/eliminación de grupos, clases y membresías.
- (Opcional) `isStudent` o `isAdmin` según corresponda.

### Capa de Aplicación / Caso de Uso (Fino)
- La lógica de autorización principal, que depende de los recursos, reside aquí. Esto centraliza las reglas de negocio y las hace independientes del framework web.
- Ejemplos:
  - En `AssignClassToGroupUseCase`: verificar `group.teacherId === userId` y `classroom.teacherId === userId`.
  - En `GetRecipeForUserUseCase`: aplicar las tres reglas descritas anteriormente.
  - En `ListAccessibleRecipesForStudentUseCase`: aplicar filtro de membresía activa y secuencia.
- Esta capa es la única responsable de ejecutar las complejas consultas de acceso basadas en membresía y propiedad.

## 6. Consideraciones de Rendimiento y Escalabilidad

- **Índices de Base de Datos**: Es crítico que los campos de clave foránea en las tablas de unión (`GroupMember`, `GroupClass`, `ClassRecipe`) estén indexados. El `schema.prisma` propuesto incluye `@@index` en `studentId`, `groupId`, `classId`, `recipeId`, `teacherId` y `order` según corresponda. Las claves primarias compuestas también generan índices únicos.
- **Consultas de Acceso**: La consulta con `EXISTS` es generalmente muy eficiente en PostgreSQL, ya que puede detenerse tan pronto como encuentra la primera coincidencia. Es preferible a obtener listas de IDs en la aplicación y luego hacer una segunda consulta.
- **Paginación**: Al listar recetas para un alumno, la consulta deberá incluir los joins necesarios. La paginación deberá aplicarse correctamente para evitar traer miles de registros a la vez.
- **Caching**: Se podría cachear el contenido de las recetas por su ID. Las listas de recetas accesibles para un alumno son más dinámicas y más difíciles de cachear de manera efectiva, pero podría explorarse una estrategia de caché por `userId` con un TTL corto.
- **Transaccionalidad**: Operaciones que involucran múltiples escrituras (ej. añadir varios miembros a un grupo) deben ser atómicas usando Prisma `$transaction`.

## 7. Componentes Afectados

### Backend (`apps/api/`)
- `prisma/schema.prisma`: Modificado con los 4 nuevos modelos (`Group`, `GroupMember`, `GroupClass`, manteniendo `ClassRecipe` y actualizando relaciones).
- **Nuevo Módulo**: `src/features/groups/`
  - `domain/group.entity.ts`
  - `domain/groupMember.entity.ts`
  - `domain/groupClass.entity.ts`
  - `application/create-group.use-case.ts`
  - `application/update-group.use-case.ts`
  - `application/delete-group.use-case.ts`
  - `application/add-group-members.use-case.ts`
  - `application/remove-group-members.use-case.ts`
  - `application/assign-class-to-group.use-case.ts`
  - `application/update-group-class-order.use-case.ts`
  - `application/get-group-classes.use-case.ts`
  - `application/get-recipe-for-user.use-case.ts`
  - `application/list-accessible-recipes-for-student.use-case.ts`
  - `infrastructure/group.repository.ts`
  - `infrastructure/groupMember.repository.ts`
  - `infrastructure/groupClass.repository.ts`
  - `infrastructure/http/group.controller.ts`
  - `infrastructure/http/group.routes.ts`
- **Módulos Existentes Modificados**:
  - `src/features/classrooms/`:
    - Actualizar `classroom.entity.ts` si se añaden relaciones o campos (ya tiene `groupAssignments` y `recipeAssignments`).
    - Los casos de uso existentes que asignen recetas a clase (`AssignRecipeToClassroomUseCase`) permanecen, pero ahora la clase puede pertenecer a múltiples grupos.
    - Los controladores de clase pueden necesitar ajustes para validar propiedad al crear/actualizar clase (ya lo hacían).
  - `src/features/recipes/`:
    - Los casos de uso `GetRecipe...` y `ListRecipes...` deben ser actualizados para incorporar la nueva lógica de autorización vía grupo/secuencia (Regla C).
    - El repositorio de recetas necesitará nuevos métodos como `findByIdForUser(recipeId, userId)` y `findAccessibleForStudent(studentId, pagination, filters)` que encapsulen la lógica de acceso.
- **Middleware**: `src/http/middleware/auth.ts`, `role.ts` (posible reutilización).

### Frontend (`apps/web/`)
- **Nuevo Módulo**: `src/features/teacher-dashboard/groups/`
  - UI para crear grupo (nombre, descripción).
  - UI para buscar/seleccionar estudiantes y añadirlos/eliminarlos (operación masiva, con selector múltiple o carga lenta).
  - UI para ordenar clases dentro del grupo (drag‑and‑drop o campos de número) y mostrar la secuencia gamificada.
  - UI para ver lista de grupos propios, editar nombre/descripción, eliminar grupo.
- **Módulos Existentes Modificados**:
  - `src/features/teacher-dashboard/classrooms/`:
    - El flujo para asignar una clase ahora puede ir a través del grupo: profesor selecciona grupo, luego asigna clase con orden.
    - Mantener la opción de crear clase independiente (para luego asignarla a grupo).
  - `src/features/student-dashboard/`:
    - La página de “Mis grupos” o “Mi camino de aprendizaje” mostrará los grupos a los que pertenece el estudiante y, dentro de cada grupo, las clases en orden, con acceso a las recetas correspondientes.
    - Posiblemente una vista de calendario o línea de tiempo.
  - `src/lib/api/`:
    - Se añadirán nuevos clientes de API para interactuar con los endpoints de `/groups`, `/groups/:id/members`, `/groups/:id/classes`.
  - `src/features/recipes/pages/`:
    - La `RecipeViewPage` no debería necesitar cambios significativos, ya que simplemente renderiza los datos que la API le proporciona. El control de acceso ya ha sido gestionado por el backend.

## 8. Próximos Pasos

1. Actualizar las especificaciones (ya hecho).
2. Actualizar el documento de diseño (hecho).
3. Regenerar la lista de tareas de implementación mediante `/sdd-tasks-potato` basada en las especificaciones y diseño actualizados.
4. Proceder a la fase de implementación (`sdd-apply`) cuando se decida continuar.
