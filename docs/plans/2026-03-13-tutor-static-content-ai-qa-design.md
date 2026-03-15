# Tutor con Contenido Estático + AI para Q&A

**Fecha:** 2026-03-13  
**Estado:** Aprobado

---

## Problema Actual

El sistema actual depende del AI para generar contenido pedagógico en tiempo real, lo cual:

- Produce respuestas inconsistentes
- No garantiza calidad pedagógica
- Puede fallar técnicamente (API key expirada, red, etc.)
- No es adecuado para educación estructurada

---

## Solución Propuesta

Sistema híbrido donde:

1. **Contenido pedagógico es 100% estático** - almacenado en DB, creado por educadores
2. **AI solo se usa para Q&A** - responder preguntas de estudiantes sobre el contenido de la clase
3. **Flujo fijo y estructurado** - el tutor guía por un camino pedagógico predefined

---

## Arquitectura de Datos

### Modelo Conceptual

```
Recipe (Lección)
├── Introduction (Introducción)
│   - greeting: Saludo inicial
│   - motivation: Por qué es importante
│   - objective: Qué aprenderá al final
│
├── Concepts (Conceptos)
│   ├── Concept 1
│   │   ├── introduction: Introducción al concepto
│   │   ├── explanation: Explicación principal
│   │   ├── examples: Ejemplos (texto + visual)
│   │   └── keyPoints: Puntos clave
│   │
│   └── Activity: Actividad práctica
│
└── Closure (Cierre)
    - summary: Resumen de lo aprendido
    - encouragement: Refuerzo positivo
    - nextLesson: Previsualización siguiente clase
```

### Estructura de Script por Paso

```typescript
type StepScript = {
  // Transición al paso
  transition: {
    text: string; // "Ahora vamos a aprender..."
  };

  // Contenido principal
  content: {
    text: string; // Contenido completo a leer
    chunks: {
      // Para pausas naturales
      text: string;
      pauseAfter: number; // segundos
    }[];
  };

  // Ejemplos
  examples: {
    text: string;
    visual?: {
      type: 'image' | 'animation' | 'equation';
      src?: string;
    };
  }[];

  // Verificación de comprensión
  comprehensionCheck?: {
    question: string;
    expectedAnswer: string;
    feedback: {
      correct: string;
      incorrect: string;
    };
  };

  // Cierre del paso
  closure: {
    text: string;
  };
};
```

---

## Flujo de la Clase (Fijo)

```
START → INTRO → [EXPLAIN_CONCEPT_1] → [ACTIVITY_1] → [EXPLAIN_CONCEPT_2] → [ACTIVITY_2] → ... → CLOSURE → END
```

| Paso | Estado     | Descripción              |
| ---- | ---------- | ------------------------ |
| 1    | INTRO      | Saludo + objetivos       |
| 2    | EXPLAINING | Concepto N completo      |
| 3    | PRACTICE   | Actividad práctica       |
| 4    | FEEDBACK   | Corrección + refuerzos   |
| ...  | ...        | ...                      |
| N    | CLOSURE    | Resumen + siguiente tema |
| N+1  | COMPLETED  | Felicitaciones           |

---

## AI: Solo para Q&A

### Flujo de Preguntas

```
Estudiante pregunta
       ↓
  [Clasificador]
  ¿Relacionada con clase actual?
       ↓
       ├─ NO → "Solo respondo preguntas sobre la clase"
       └─ SI → Busca en contenido estático (RAG)
                  ↓
             Genera respuesta contextualizada
```

### Prompt del AI

```
Eres un tutor infantil amigable y paciente.
TEMA DE LA CLASE: {recipe.title}
CONTENIDO RELACIONADO:
{relevant_chunks_from_static_content}

INSTRUCCIONES:
1. Responde solo usando el contenido proporcionado
2. Si no tienes información suficiente, dice "Buena pregunta, pero eso no está en nuestra clase de hoy"
3. Usa ejemplos del contenido para explicar
4. Sé encouraging y positivo
5. Lenguaje simple para niños de 6-8 años
```

---

## Cambios en Schema de Base de Datos

### Nuevos Modelos

```prisma
// Concepto pedagógico
model Concept {
  id            String   @id @default(uuid())
  recipeId      String
  title         String
  order         Int
  introduction  Json     // Script de introducción
  explanation   Json     // Contenido principal
  examples      Json     // Array de ejemplos
  keyPoints     Json     // Puntos clave
  closure       Json     // Cierre del concepto
  createdAt     DateTime @default(now())

  recipe        Recipe   @relation(fields: [recipeId], references: [id])
  activities    Activity[]
  @@map("concepts")
}

// Actividad pedagógica
model Activity {
  id            String   @id @default(uuid())
  conceptId     String
  type          String   // PRACTICE, QUIZ
  order         Int
  instruction   String
  options       Json?    // Para multiple choice
  correctAnswer String
  feedback      Json     // Feedback por tipo
  createdAt     DateTime @default(now())

  concept       Concept  @relation(fields: [conceptId], references: [id])
  @@map("activities")
}
```

### RecipeStep Modificado

```prisma
model RecipeStep {
  // ...existing fields...

  // Referencias (opcionales para backwards compatibility)
  conceptId  String?
  activityId String?

  // Contenido estático completo del paso
  script     Json?    // StepScript completo

  @@map("recipe_steps")
}
```

---

## Seed Inicial (2 Lecciones)

### Lección 1: "Matemáticas Básicas: Suma y Resta"

**Conceptos:**

1. "¿Qué es sumar?"
   - Introducción: "¡Hoy vamos a aprender algo divertido!"
   - Explicación: Sumar es juntar cantidades
   - Ejemplos: 2+3=5, 1+4=5
   - Activity: Mini quiz

2. "El símbolo +"
   - Explicación: El símbolo "más"
   - Ejemplos: visual de +
   - Activity: Identificar el símbolo

### Lección 2: "Formas Geométricas"

**Conceptos:**

1. "El círculo"
2. "El cuadrado"

---

## Criterios de Éxito

- [ ] Contenido pedagógico 100% estático (no depende de AI)
- [ ] Flujo de clase fijo y predecible
- [ ] AI solo responde Q&A relacionadas con clase
- [ ] AI rechaza preguntas fuera de tema apropiadamente
- [ ] 2 lecciones de ejemplo funcionando
- [ ] Seed crea contenido rico y realista
