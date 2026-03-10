# Bruno Collection - Pixel Mentor API

Esta colección contiene requests de prueba para la API de **Pixel Mentor**, diseñada para ser ejecutada en [Bruno](https://www.usebruno.com/).

## 🎯 Objetivo

Probar de manera exhaustiva los endpoints de la API, incluyendo el flujo completo de orquestación de lecciones con captura automática de variables (`session_id`).

## 📋 Estructura de la Colección

```text
bruno/
├── opencollection.yml      # Manifiesto de la colección
├── Health Check.yml        # GET /health
├── API Info.yml            # GET /api
├── List Lessons.yml        # GET /api/lessons?activeOnly=true
├── Get Lesson.yml          # GET /api/lessons/:id
├── List Sessions.yml       # GET /api/sessions
├── Get Session.yml         # GET /api/sessions/:id
├── Start Lesson.yml        # POST /api/leccion/start (captura session_id)
├── Interact.yml            # POST /api/leccion/interact (usa session_id)
└── README.md
```

## ⚙️ Prerrequisitos

1. **Servidor API corriendo**:

   ```bash
   cd apps/api
   npm run dev
   ```

   El servidor debe estar en `http://localhost:3001` (o cambiar `base_url` en `opencollection.yml`).

2. **Base de datos poblada**:
   Ejecuta el script de seed para crear datos de prueba:

   ```bash
   # Asegúrate de tener .env configurado con DATABASE_URL
   npx tsx prisma/seed-test-data.ts
   ```

   Esto creará:
   - Usuario estudiante: `student@test.pixel-mentor` (ID: `11111111-1111-1111-1111-111111111111`)
   - Lección de prueba: ID `00000000-0000-0000-0000-000000000000`
   - Preguntas asociadas

3. **Bruno instalado**: Descarga desde [usebruno.com](https://www.usebruno.com/).

## 🚀 Cómo Usar

### 1. Importar la Colección

- Abre Bruno.
- Haz clic en **"Import Collection"** o arrastra la carpeta `bruno/` entera a Bruno.
- También puedes ir a `File -> Import` y seleccionar `opencollection.yml`.

### 2. Configurar Variables

Edita `opencollection.yml` si es necesario:

- `base_url`: URL de tu API (default: `http://localhost:3001`).
- `lesson_id`: UUID de la lección de prueba (por defecto: `00000000-0000-0000-0000-000000000000`).
- `student_id`: UUID del estudiante de prueba (por defecto: `11111111-1111-1111-1111-111111111111`).
- `session_id`: **NO modificar** — esta variable se llena automáticamente después de ejecutar `Start Lesson.yml`.

### 3. Ejecutar Requests

#### Orden Recomendado:

1. **Health Check**: Verifica que la API y BD estén vivas.
2. **API Info**: Confirma versión y estado.
3. **List Lessons**: Obtén listado de lecciones activas.
4. **Get Lesson**: Usa `{{lesson_id}}` para traer detalles.
5. **List Sessions**: (opcional) para ver sesiones existentes.
6. **Lección Flow**:
   - Ejecuta **Start Lesson**: Inicia una nueva sesión. Automáticamente guarda `session_id`.
   - Ejecuta **Interact**: Envía la respuesta del estudiante. Usa el `session_id` capturado.

> 💡 **Tip**: Puedes ejecutar toda la colección en orden usando la opción **"Run Collection"** en Bruno.

### 4. Variable Capture (Flujo Automático)

El archivo `Start Lesson.yml` contiene un script de respuesta que captura el `session_id` del JSON de respuesta:

```javascript
bru.setVar('session_id', response.body.sessionId);
```

Esto permite que `Interact.yml` use `{{session_id}}` sin intervención manual.

---

## 🧪 Scenarios de Prueba Adicionales

### Casos de Éxito

- ✅ Start con UUIDs válidos → `201` + `sessionId`.
- ✅ Interact con `sessionId` correcto → `200` + `voiceText`.
- ✅ List lessons sin filtro → `200` + array.
- ✅ Get lesson por ID existente → `200` + objeto.

### Casos de Error

Para probar errores, modifica temporalmente las variables:

- **Lesson no encontrado**: Usa un `lesson_id` inválido (ej: `ffffffff-...`).
- **Session no encontrado**: Usa un `session_id` inválido.
- **Validación fallida**: En `Start Lesson.yml`, omite `studentId` o usa un string no-UUID.
- **Rate limiting**: Dispara 10+ requests rápidos a `/api/leccion/interact` (límite: 5/min).

---

## 📊 Respuestas Esperadas

### `POST /api/leccion/start` (201)

```json
{
  "sessionId": "a1b2c3d4-...",
  "voiceText": "Hola, vamos a aprender...",
  "pedagogicalState": "EXPLANATION"
}
```

### `POST /api/leccion/interact` (200)

```json
{
  "voiceText": "¡Muy bien! Esa es la respuesta correcta.",
  "pedagogicalState": "EVALUATION",
  "sessionCompleted": false,
  "isCorrect": true
}
```

### `GET /health` (200)

```json
{
  "status": "ok",
  "timestamp": "2025-03-10T...",
  "database": "healthy"
}
```

---

## 🔧 Solución de Problemas

| Problema                | Posible Causa                      | Solución                                      |
| ----------------------- | ---------------------------------- | --------------------------------------------- |
| `Connection refused`    | API no está corriendo              | Ejecuta `npm run dev` en `apps/api/`          |
| `LessonNotFoundError`   | `lesson_id` no existe en BD        | Ejecuta el seed script                        |
| `SessionNotFoundError`  | `session_id` inválido o expirado   | Usa solo `session_id` del `Start Lesson.yml`  |
| `429 Too Many Requests` | Rate limit excedido                | Espera 60 segundos o ajusta límites en `.env` |
| Errores 500             | Gemini API key faltante o inválida | Configura `GEMINI_API_KEY` en `.env`          |

---

## 📝 Notas

- Las variables de Bruno se definen en **`opencollection.yml`** (pestaña _Variables_ en la GUI).
- Los **scripts de respuesta** (post-response) se ejecutan automáticamente después de recibir la respuesta.
- La colección está diseñada para API local (`localhost:3001`). Cambia `base_url` si usas otro host/puerto.
- Para probar en producción, crea un **entorno separado** en Bruno y usa credenciales reales.

---

## 🎉 ¡Listo!

Con esta colección puedes explorar toda la API de Pixel Mentor de forma manual o automatizar tests de regresión. Si encuentras bugs, reporta en el repositorio.
