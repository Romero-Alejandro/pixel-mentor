# Plan de Debug: Auto-advance para intro/closure

## Problema reportado
El usuario indica que los pasos tipo "introducción" y "cierre" no avanzan automáticamente.

## Análisis realizado

### Backend (orchestrate-recipe.use-case.ts)

1. **Lógica de auto-advance**: El método `requiresStudentInput()` (línea 496-498) retorna `false` para `intro` y `closure`, lo que significa que `autoAdvance` debería ser `true` para estos pasos.

2. **Fast path de navegación**: Los métodos `interact()` e `interactStream()` tienen lógica de navegación rápida que avanzada pasos cuando el input es '__auto__' o 'continuar'.

3. **Estado pedagógico**: Los pasos tipo content (intro, closure, content)van a `EXPLANATION`, mientras que activity/question van a `ACTIVITY_WAIT`.

### Frontend (useClassOrchestrator.ts)

1. **Auto-advance check** (línea 309): 
   ```typescript
   if (autoAdvance === true && !sessionCompleted) {
   ```
   Esto debería dispararse para intro/closure.

## Posibles causas

1. **VITE_ENABLE_STREAMING**: Si está deshabilitado, el flujo usa `interact()` en lugar de `interactStream()`. Verificar que retorne `autoAdvance`.

2. **Logging excesivo**: El logging en líneas 310-322 puede estar causando lentitud. Considerar reducirlo.

3. **Timing del speak()**: El auto-advance ocurre ANTES de speak(). Si el backend retorna rápido pero el frontend tiene problemas, podría haber timing issues.

## Acción recomendada

Verificar en tiempo de ejecución:
1. Revisar la consola del navegador para ver los logs de auto-advance
2. Confirmar que el backend retorna `autoAdvance: true` para pasos intro/closure
3. Verificar que el flag se propaga correctamente al frontend

El código parece correcto - el problema puede estar en:
- Configuración de entorno (streaming enabled/disabled)
- Logs excesivos que bloquean el thread
- Fallo en la propagación del campo autoAdvance desde el backend