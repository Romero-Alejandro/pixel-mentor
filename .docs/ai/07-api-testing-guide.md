# Guía de Pruebas de API con Bruno

## Endpoints de la API Pixel Mentor

### 1. Health & Info

- `GET /health` - Health check (status, timestamp, database)
- `GET /api` - Información de la API (name, version, status)

### 2. Lessons

- `GET /api/lessons?activeOnly=true` - Listar lecciones activas
- `GET /api/lessons/:id` - Obtener lección específica

### 3. Sessions

- `GET /api/sessions?studentId=:id&activeOnly=true` - Listar sesiones de un estudiante
- `GET /api/sessions/:id` - Obtener sesión específica

### 4. Lección Flow (interactivo)

- `POST /api/leccion/start` - Iniciar sesión de lección (captura `session_id`)
- `POST /api/leccion/interact` - Interactuar con el tutor IA

## Prerrequisitos

### 1. Servidor API corriendo

```bash
cd apps/api
npm run dev
```

El servidor debe estar en `http://localhost:3001`.

### 2. Base de datos poblada

Ejecuta el seed script:

```bash
# Desde la raíz del proyecto
npx tsx apps/api/prisma/seed-test-data.ts
```

**Datos creados:**

- Estudiante: `student@test.pixel-mentor` (ID: `11111111-1111-1111-1111-111111111111`)
- Lección de prueba: ID `00000000-0000-0000-0000-000000000000`
- Preguntas asociadas a la lección

### 3. Bruno instalado (v3.0+)

Descarga: https://www.usebruno.com/

## Colección Bruno

La colección está en `apps/api/bruno/`.

### Estructura

```
bruno/
├── opencollection.yml          # Manifiesto
├── environments/
│   └── development.yml         # Variables (base_url, IDs)
├── Health Check.yml
├── API Info.yml
├── List Lessons.yml
├── Get Lesson.yml
├── List Sessions.yml
├── Get Session.yml
├── Start Lesson.yml
├── Interact.yml
└── README.md
```

## Cómo Usar Bruno

### Paso 1: Importar la Colección

1. Abre Bruno
2. Haz clic en **"Import Collection"** o arrastra la carpeta `apps/api/bruno/` a la ventana de Bruno
3. La colección aparecerá en el panel izquierdo con 8 requests

### Paso 2: Seleccionar el Entorno

En la esquina superior derecha, hay un dropdown de **environments**:

- Selecciona **"development"**

Esto carga las variables:

- `base_url = http://localhost:3001`
- `lesson_id = 00000000-0000-0000-0000-000000000000`
- `student_id = 11111111-1111-1111-1111-111111111111`
- `session_id = ''` (vacío, se llena automáticamente)

**Importante**: Si no ves "development" en el dropdown, haz:

- Click derecho en la colección → "Reload Collection" (o Ctrl+R)

### Paso 3: Ejecutar Requests

#### Opción A: Manual (recomendado para explore)

Haz clic en cada request en orden:

1. **Health Check**
   - Click → "Send"
   - Espera status 200
   - Deberías ver: `{ "status": "ok", "timestamp": "...", "database": "healthy" }`

2. **API Info**
   - Click → "Send"
   - Espera status 200
   - Deberías ver: `{ "name": "Pixel Mentor API", "version": "1.0.0", "status": "running" }`

3. **List Lessons**
   - Click → "Send"
   - Espera status 200
   - Deberías ver un array con al menos 1 lección (la del seed)
   - Si sale vacío, verifica que el seed corrió

4. **Get Lesson**
   - Click → "Send"
   - Usa `{{lesson_id}}` (ya definido)
   - Espera status 200
   - Deberías ver la lección completa con `concepts` y `questions`

5. **List Sessions**
   - Click → "Send"
   - Usa `{{student_id}}`
   - Espera status 200
   - Probablemente array vacío al inicio (ninguna sesión creada aún)

6. **Start Lesson**
   - Click → "Send"
   - Envía `lessonId` y `studentId`
   - **IMPORTANTE**: Esto captura automáticamente `session_id` del response
   - Espera status 201
   - Deberías ver: `{ "sessionId": "...", "voiceText": "...", "pedagogicalState": "EXPLANATION" }`
   - Verifica que en la pestaña "Variables" (derecha) aparezca `session_id` con valor

7. **Get Session**
   - Click → "Send"
   - Usa `{{session_id}}` (debería tener valor ahora)
   - Espera status 200
   - Deberías ver la sesión recién creada con estado `active`

8. **Interact**
   - Click → "Send"
   - Envía `sessionId` y `studentInput`
   - Espera status 200
   - Deberías ver: `{ "voiceText": "...", "pedagogicalState": "...", "sessionCompleted": false }`

#### Opción B: Run Collection Completo

En el panel izquierdo, click derecho sobre la colección → **"Run Collection"**.
Esto ejecuta todos los requests en orden secuencial.

Ventajas:

- Automático
- Genera reporte de resultados
- `session_id` se captura y propaga automáticamente

### Paso 4: Interpretar Resultados

- **Status 200/201**: Éxito (verde)
- **Status 400**: Validación fallida (revisar body)
- **Status 404**: No encontrado (IDs incorrectos)
- **Status 429**: Rate limit (espera 60 segundos)
- **Status 500**: Error del servidor (revisar logs)

## Variables y Captura Automática

### Variables Disponibles

| Nombre       | Valor por defecto            | Dónde se define                |
| ------------ | ---------------------------- | ------------------------------ |
| `base_url`   | `http://localhost:3001`      | `environments/development.yml` |
| `lesson_id`  | UUID de lección de prueba    | `environments/development.yml` |
| `student_id` | UUID de estudiante de prueba | `environments/development.yml` |
| `session_id` | `''` (vacío)                 | `environments/development.yml` |

### Flujo de `session_id`

1. `Start Lesson` ejecuta y recibe response con `sessionId`
2. El script `post-response` en `Start Lesson.yml` ejecuta:
   ```javascript
   bru.setVar('session_id', response.body.sessionId);
   ```
3. `session_id` ahora tiene el valor real
4. `Get Session` y `Interact` usan `{{session_id}}` automáticamente

## Troubleshooting

### "Invalid URL" o variables no resueltas

**Causa**: El entorno "development" no está seleccionado.

**Solución**:

1. Selecciona "development" del dropdown de environments (top-right)
2. Si no aparece, recarga la colección (Ctrl+R o click derecho → Reload)

### `LessonNotFoundError`

**Causa**: `lesson_id` no existe en la BD.

**Solución**: Ejecuta el seed script:

```bash
npx tsx apps/api/prisma/seed-test-data.ts
```

### `SessionNotFoundError`

**Causa**: `session_id` inválido o expirado.

**Solución**:

- Asegúrate de ejecutar `Start Lesson` ANTES de `Get Session` e `Interact`
- Si `session_id` está vacío, `Start Lesson` no completó exitosamente

### `429 Too Many Requests`

**Causa**: Rate limit excedido (5 req/min en `/interact`)

**Solución**: Espera 60 segundos entre interacciones.

### Errores 500 (Gemini API)

**Causa**: `GEMINI_API_KEY` no configurada en `.env`.

**Solución**: Agrega a `apps/api/.env`:

```env
GEMINI_API_KEY=tu-clave-aqui
```

### No aparecen los 8 requests

**Causa**: Abriste la carpeta equivocada.

**Solución**:

- Cierra la colección actual
- Importa **la carpeta `bruno/`**, no `apps/api/` ni `bruno-import/`

### Variables aparecen pero URL sigue con `{{base_url}}`

**Causa**: No ejecutaste ningún request después de seleccionar el entorno.

**Solución**:

1. Selecciona "development"
2. Haz clic en cualquier request y presiona "Send"
3. La URL debería resolverse a `http://localhost:3001/...`

## Validación de Datos de Prueba

Puedes verificar que el seed creó los datos esperados:

```bash
# Conectar a la BD (psql o DBeaver)
SELECT id, email FROM "User" WHERE email = 'student@test.pixel-mentor';
SELECT id, title, active FROM Lesson WHERE id = '00000000-0000-0000-0000-000000000000';
SELECT * FROM Question WHERE lessonId = '00000000-0000-0000-0000-000000000000';
```

## Ejemplo de Flujo Completo

```
1. Health Check      → 200 OK
2. API Info          → 200 OK
3. List Lessons      → [ {id: ..., title: ...} ]
4. Get Lesson        → {id: ..., concepts: [...], questions: [...]}
5. Start Lesson      → 201 Created → {sessionId: "abc123...", voiceText: "Hola..."}
6. Get Session       → 200 OK → {id: "abc123...", status: "active"}
7. Interact          → 200 OK → {voiceText: "Respuesta IA", sessionCompleted: false}
```

## Notas Adicionales

- **Rate Limits**:
  - General: 100 req/min (ventana configurable)
  - `/api/leccion/interact`: 5 req/min (para evitar spam)
- **Timeouts**: 30 segundos por request (configurable)
- **CORS**: Configurado para `http://localhost:3001` (frontend)
- **Logs**: Vistos en consola donde corre `npm run dev`
- **Gemini API**: Las respuestas de IA dependen de la API key; si falla, verifica `GEMINI_API_KEY`

## Cleanup

Después de pruebas, puedes borrar sesiones de prueba:

```sql
-- En la BD
DELETE FROM "Session" WHERE "studentId" = '11111111-1111-1111-1111-111111111111';
-- Las lecciones y preguntas seed pueden quedarse para reuso
```

## Siguientes Pasos

- Agregar más lecciones de prueba (ejecutar seed con datos diferentes)
- Probar con diferentes respuestas de estudiante en `Interact`
- Probar edge cases: `lesson_id` inválido, `session_id` vencido
- Generar reportes usando "Run Collection" → "Export Results"
