# Design Document: TTS Streaming Robust Solution

**Fecha:** 2026-03-18  
**Autor:** Agent Orchestrator  
**Estado:** Draft  
**Etiquetas:** tts, streaming, audio, performance, ux

---

## 1. Problem Statement

El sistema actual presenta dos problemas críticos en la narración de lecciones:

1. **Pérdida de contenido inicial en la UI**: El texto mostrado al usuario no incluye los campos `transition` y `closure` del script, mientras que la voz sí los incluye. Esto hace que parezca que la UI "corta" el primer tramo del texto.

2. **Truncamiento de texto largo**: El endpoint TTS limita el texto a 5000 caracteres mediante `sanitizeText().slice(0, 5000)`. Para lecciones extensas, la narración se corta a mitad de una oración, perdiendo contenido final.

3. **Alto tiempo de espera inicial**: Con el endpoint `/speak` (non-streaming), el usuario debe esperar a que se genere TODO el audio antes de escuchar algo (10-60 segundos), creando una pésima experiencia.

**Evidencia**:

- `apps/api/src/infrastructure/adapters/http/routes/tts.ts` línea 24: `slice(0, 5000)`
- `apps/web/src/features/lesson/hooks/useClassOrchestrator.ts` línea 186: `staticContent?.script?.content` (solo content)
- `apps/api/src/application/use-cases/recipe/orchestrate-recipe.use-case.ts` líneas 187-199: `buildVoiceText` combina transition+content+closure

---

## 2. Goals & Non-Goals

### Goals (qué SÍ haremos)

- ✅ **Rendimiento óptimo**: La voz debe comenzar a reproducirse en < 1 segundo, independientemente de la longitud del texto.
- ✅ **Sin pérdida de texto**: TODO el contenido (transition, content, closure) debe ser narrado y mostrado.
- ✅ **Consistencia**: La UI debe mostrar exactamente el mismo texto que se está narrando.
- ✅ **Escalabilidad**: Soportar textos de hasta 50000 caracteres sin degradación.
- ✅ **Robustez**: Manejar timeouts, errores de red y reintentos automáticamente.
- ✅ **Aprovechar infraestructura existente**: Ya contamos con streaming SSE (`/tts/stream`) y frontend queueing.

### Non-Goals (qué NO haremos)

- ❌ Cambiar el sistema de chunking de `@sefinek/google-tts-api` (ya lo hace automáticamente ~200 chars).
- ❌ Implementar combinación de audios MP3 en backend (el streaming evita esto).
- ❌ Crear un nuevo endpoint TTS (reutilizaremos `/tts/stream`).
- ❌ Cambiar la arquitectura de recetas/átomos (solo ajustaremos texto).

---

## 3. Proposed Solution

### Estrategia: **Streaming SSE + Límites altos + Unificación de texto**

**Por qué es la mejor opción**:

| Criterio                      | Opción 1 (Aumentar límite)   | Opción 2 (Chunking manual)     | **Opción 3 (Streaming SSE)**   |
| ----------------------------- | ---------------------------- | ------------------------------ | ------------------------------ |
| Tiempo hasta primer sonido    | 10-60s (espera completa)     | 20-90s (generar+combinar)      | **< 1s (streaming inmediato)** |
| Completoidad de texto         | Sí (con límite alto)         | Sí                             | **Sí**                         |
| Complejidad de implementación | Baja                         | Alta                           | **Media**                      |
| Escalabilidad                 | Limitada (5000 chars)        | Limitada (combinación costosa) | **Alta (infinitos chunks)**    |
| Uso de memoria backend        | Alto (audio completo en RAM) | Muy alto (todos los chunks)    | **Bajo (streaming directo)**   |
| UX                            | Pobre (espera larga)         | Muy pobre (espera larga)       | **Excelente (inmediato)**      |

**Conclusión**: La Opción 3 ofrece **mejor rendimiento, menor tiempo de espera y mejor UX** con esfuerzo de implementación moderado.

---

## 4. Architecture & Data Flow

### Diagrama de flujo (post-implementación)

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (useVoice.speak)                                       │
│ • Recibe text completo (voiceText)                              │
│ • Crea EventSource a /api/tts/stream                           │
│ • Recibe chunks SSE (audioBase64) → cola → reproduce           │
└───────────────────────┬─────────────────────────────────────────┘
                        │ GET /api/tts/stream?text=...&lang=...
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND (tts.ts → TTSStreamService)                            │
│ • sanitizeText: solo limpieza, SIN truncar                     │
│ • TTSStreamService timeout: 60s                                │
│ • googleTTS.getAllAudioBase64(text completo)                   │
│   → divide en chunks de ~200 chars                             │
│   → genera audio por chunk                                     │
│   → emite eventos SSE: {type: "audio", data: {audioBase64}}   │
│   → emite evento "end" al finalizar                            │
└───────────────────────┬─────────────────────────────────────────┘
                        │ SSE stream (text/event-stream)
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (speakStream)                                          │
│ • on "audio" → crea Blob → Audio element → encola              │
│ • on "end" → limpia recursos                                   │
│ • Reproducción continua sin interrupciones                     │
└─────────────────────────────────────────────────────────────────┘
```

### Changes Required

#### Backend Changes

1. **`apps/api/src/infrastructure/adapters/http/routes/tts.ts`**
   - Eliminar `.slice(0, 5000)` de `sanitizeText` (línea 24)
   - Aumentar timeout de `/speak` a 60000 ms (línea 106)
   - Aumentar timeout de `TTSStreamService` a 60000 ms (pasado a constructor)

2. **`apps/api/src/services/ttsStream.ts`**
   - Cambiar `timeout: 10000` → `timeout: 60000` (línea 55)

3. **(Opcional) Límite superior de seguridad**
   - Agregar validación: `if (text.length > 50000) throw new Error(...)` en `sanitizeText` o schema

#### Frontend Changes

1. **`apps/web/src/features/lesson/hooks/useClassOrchestrator.ts`**
   - Línea 186:
     ```typescript
     // Antes:
     const display = staticContent?.script?.content || voiceText || '';
     // Después:
     const display = voiceText || staticContent?.script?.content || '';
     ```
   - Esto asegura que se muestre `voiceText` (completo con transition+content+closure) en lugar de solo `content`.

2. **(Opcional) CSS para textos largos**
   - Asegurar que el panel de concentración tenga `overflow-y: auto` para textos muy extensos.

---

## 5. Implementation Details

### Backend: TTS Streaming con timeout ampliado

**Archivo**: `apps/api/src/services/ttsStream.ts`

```typescript
export class TTSStreamService extends Readable {
  constructor(text: string, options: TTSStreamOptions = {}) {
    super({ objectMode: true });
    this.text = text;
    this.options = {
      lang: 'en',
      slow: false,
      host: 'https://translate.google.com',
      timeout: 60000, // ← Cambiado de 10000 a 60000 ms
      splitPunct: '.,;!?',
      ...options,
    };
  }
}
```

**Razón**: El chunking automático de la librería puede tardar más con textos largos. 60 segundos da suficiente margen para 25000-50000 caracteres.

### Backend: Eliminar truncamiento

**Archivo**: `apps/api/src/infrastructure/adapters/http/routes/tts.ts`

```typescript
function sanitizeText(input: string): string {
  return (
    input
      // .slice(0, 5000) // ← ELIMINAR esta línea
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/<[^>]*>/g, '')
      .trim()
  );
}
```

**Razón**: La librería `googleTTS.getAllAudioBase64` ya maneja textos largos mediante chunking interno. No necesitamos truncar.

**Validación adicional opcional** (si queremos límite superior):

```typescript
function sanitizeText(input: string): string {
  if (input.length > 50000) {
    throw new Error('Texto demasiado largo. Máximo: 50000 caracteres.');
  }
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}
```

### Frontend: Mostrar texto completo

**Archivo**: `apps/web/src/features/lesson/hooks/useClassOrchestrator.ts`

```typescript
// Línea ~186
const display = voiceText || staticContent?.script?.content || '';
setContentText(display);
```

**Razón**: `voiceText` ya contiene `transition + content + closure`. Al darle prioridad, la UI muestra exactamente lo que se está narrando.

**Nota**: Esto también asegura que si `staticContent.script.content` está vacío por alguna razón, se使用 `voiceText`.

---

## 6. Error Handling

### Timeout en streaming (backend)

- Si `googleTTS.getAllAudioBase64` tarda >60s, el stream se cerrará con error.
- El frontend captura el evento `error` SSE y limpia recursos.
- Se reintentará hasta 3 veces con backoff exponencial (ya implementado en `useVoice.ts`).

### Texto extremadamente largo (>50000 chars)

- Si agregamos validación, el backend devolverá `400 Bad Request` con mensaje claro.
- Frontend mostrará error al usuario.

### Interrupción de conexión

- El frontend ya maneja `eventSource.onerror` y `close`.
- Si se interrumpe, se puede reintentar o fallback a `/speak` (HTTP non-streaming).

---

## 7. Testing Strategy

### Unit Tests (Backend)

- **TTS route sanitization**: Verificar que `sanitizeText` NO trunque texto de 10000 chars.
- **TTSStreamService timeout**: Verificar que el timeout sea 60000 ms.
- **Validación de límite máximo** (si se agrega): texto de 60000 chars debe lanzar error.

### Integration Tests (Backend)

- **Streaming endpoint con texto largo**:
  ```typescript
  const longText = '...'; // 10000 caracteres
  const response = await request(app).get('/api/tts/stream?text=' + encodeURIComponent(longText));
  // Verificar status 200, headers SSE
  // Leer stream y contar eventos "audio" (deben ser múltiples)
  ```
- **Tiempo de generación**: Medir que el primer chunk llega en < 5 segundos.

### E2E Tests (Frontend)

- **Playwright test**:
  1. Iniciar sesión.
  2. Ir a una lección con texto largo (>5000 chars).
  3. Verificar que el panel de concentración muestra el texto completo (incluye transition).
  4. Verificar que el audio comienza a reproducirse en < 3 segundos.
  5. Esperar a que termine y verificar que se reprodujo el texto completo (sin cortes).

### Manual Testing

- Usar una lección con contenido de 8000-10000 caracteres.
- Observar Chrome DevTools → Network → EventSource response.
- Contar los chunks SSE recibidos.
- Verificar que la voz narra el texto completo sin saltos.

---

## 8. Migration & Rollout

### Pasos de deployment (sin downtime)

1. **Deploy backend** (primero):
   - Modificar `tts.ts` (sanitizeText y timeout /speak)
   - Modificar `ttsStream.ts` (timeout)
   - Reiniciar servicio.
   - **No rompe compatibilidad**: Los clientes viejos seguirán funcionando (solo relajan límites).

2. **Deploy frontend** (después):
   - Modificar `useClassOrchestrator.ts` (prioridad de `voiceText`)
   - Reiniciar servidor frontend.
   - **Rollback sencillo**: Revertir a `staticContent?.script?.content` si hay problemas.

### Feature flag (opcional)

Podemos agregar un flag para mostrar `voiceText` vs `script.content`:

```typescript
const useFullVoiceText = process.env.VITE_USE_FULL_VOICE_TEXT === 'true';
const display = useFullVoiceText ? voiceText : staticContent?.script?.content || voiceText;
```

---

## 9. Risks & Mitigations

| Risk                                                                      | Impact    | Probability | Mitigation                                                                                                        |
| ------------------------------------------------------------------------- | --------- | ----------- | ----------------------------------------------------------------------------------------------------------------- |
| **Google bloquea IP por uso excesivo** (muchas solicitudes a TTS gratis)  | Alarmante | Media       | Implementar rate limiting por usuario/IP. Usar `express-rate-limit` en endpoints TTS (ej: 100 requests/min).      |
| **Timeout insuficiente** para textos extremadamente largos (>40000 chars) | Alto      | Baja        | Aumentar a 90s si es necesario. Limitar a 50000 chars.                                                            |
| **Frontend OOM** al crear muchos objetos Audio (uno por chunk)            | Medio     | Baja        | Limitar el tamaño de la cola (`audioQueueRef`) a 10 chunks. Descartar chunks antiguos si la cola crece demasiado. |
| **Texto muy largo en DOM** causa lentitud de scroll/render                | Medio     | Baja        | Usar virtual scrolling si el texto supera 10000 chars (poco probable en lecciones).                               |
| **SSE connection drop** en textos muy largos (>60s)                       | Medio     | Media       | Retry automático conReconnect en frontend (ya implementado con maxRetries=3).                                     |

---

## 10. Success Metrics

- **Tiempo hasta primer sonido (Time to First Sound)**: < 2 segundos para 90% de las lecciones.
- **Completitud de texto**: 100% de las lecciones narradas sin cortes (comparar texto original vs audio transcript, manual).
- **User satisfaction**: No hay complaints sobre "falta texto" o "se corta".
- **Error rate**: < 1% de errores TTS por timeout/abuso.
- **Performance**: No increase en CPU/memoria del backend más del 20% vs baseline.

---

## 11. Alternatives Considered (Why not the others?)

### Opción 1: Aumentar límite + timeout en `/speak`

- **Pro**: Simple.
- **Con**: Tiempo de espera alto (debe generar todo antes de reproducir). Mala UX.
- **Rejected**: No aprovecha el streaming ya implementado.

### Opción 2: Chunking manual + combinar en backend

- **Pro**: Control total.
- **Con**: Complejidad alta (combinar MP3s), tiempo de espera alto (generar+combinar), memoria alta.
- **Rejected**: La librería ya hace chunking; combinación innecesaria.

---

## 12. Open Questions

- ¿Debemos agregar rate limiting específico para TTS? (Revisar si ya existe global)
- ¿Debemos limitar el número de requests TTS por usuario/día para conservar GoogleFree quota?
- ¿Debemos agregar logging/monitoring de duración de generación TTS?

---

## 13. Appendix: Files to Modify

### Backend

- `apps/api/src/infrastructure/adapters/http/routes/tts.ts`
- `apps/api/src/services/ttsStream.ts`

### Frontend

- `apps/web/src/features/lesson/hooks/useClassOrchestrator.ts`

---

**Fin del Design Document.**
