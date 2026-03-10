# Security, Resiliency & NFRs

## RNF1: Seguridad y Privacidad (Zero-Audio)

- **RNF1.1:** Prohibir estrictamente la recepción, el procesamiento o el almacenamiento de blobs de audio en el servidor, delegando las funciones de STT/TTS al entorno del cliente.
- **RNF1.2:** Aplicar una política de retención temporal (TTL configurable) a las transcripciones almacenadas.
- **RNF1.3:** Proveer endpoints estandarizados para el borrado definitivo y la exportación de datos, garantizando el cumplimiento normativo.

## RNF2: Resiliencia de Infraestructura Externa (LLM)

- **RNF2.1:** Enrutar toda comunicación externa con proveedores LLM obligatoriamente a través del `ApiKeyRotatorService`.
- **RNF2.2:** Implementar en el rotador de claves una estrategia Round-Robin equilibrada.
- **RNF2.3:** Implementar el patrón _Circuit Breaker_ (ej. 5 errores en 60s) para aislar proactivamente claves degradadas o con cuota excedida.
- **RNF2.4:** Ejecutar health-checks periódicos para monitorear la latencia del proveedor.

## RNF3: Escalado Humano (Fallback)

- **RNF3.1:** Generar de forma asíncrona un ticket de revisión humana (`teacher_review`) que adjunte el snapshot del estado de la sesión bajo las siguientes condiciones:
  - Agotar el límite configurado de reintentos pedagógicos.
  - Detectar contenido inseguro a través de las banderas de seguridad (Safety Flags) del proveedor LLM.
  - Fallar las validaciones de contrato de esquema (Zod) de forma repetitiva.
