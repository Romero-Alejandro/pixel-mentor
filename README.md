# Pixel Mentor

![Pixel Mentor Logo](./docs/assets/logo.png) <!-- Optional: Add a logo if available -->

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://semver.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Code Style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://prettier.io)

> **Plataforma EdTech de tutoría vocal interactiva para niños de 6 a 12 años.**

Pixel Mentor es un proyecto de arquitectura hexagonal estricta (Domain-Driven Design) diseñado para proporcionar sesiones de tutoría personalizadas mediante IA generativa (Google Gemini) y procesamiento de lenguaje natural. La aplicación gestiona el estado de la sesión, el historial de interacciones y la lógica pedagógica de forma robusta y segura.

---

## 📑 Tabla de Contenidos

- [Arquitectura](#-arquitectura)
- [Características Clave](#-características-clave)
- [Stack Tecnológico](#-stack-tecnológico)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Guía de Instalación](#-guía-de-instalación)
- [Uso](#-uso)
  - [Desarrollo](#desarrollo)
  - [Construcción y Producción](#construcción-y-producción)
  - [Base de Datos](#base-de-datos)
  - [Pruebas](#pruebas)
- [API Reference](#-api-reference)
- [Contribución](#-contribución)
- [Licencia](#-licencia)

---

## 🏗️ Arquitectura

Este proyecto sigue el patrón **Hexagonal Architecture (Ports & Adapters)** de forma estricta para garantizar un bajo acoplamiento y una alta cohesión.

### Dominios

- **Domain (Core)**: Entidades, Value Objects y Reglas de Negocio puras (sin dependencias externas).
- **Application**: Orquestación de flujos (Use Cases) y definición de puertos (interfaces).
- **Infrastructure**: Implementación de adaptadores (HTTP, Base de Datos, IA).

### Estructura de Directorios (API)

```text
apps/api/src/
├── domain/              # Entidades y lógica de negocio pura
│   ├── entities/        # Reglas de estado y comportamiento
│   ├── ports/           # Interfaces de repositorios y servicios
│   └── state/           # Máquina de estados finitos (FSM)
├── application/         # Orquestación y casos de uso
│   ├── dto/             # Objetos de Transferencia de Datos
│   ├── ports/           # Definiciones de puertos
│   └── use-cases/       # Lógica de aplicación
├── infrastructure/      # Adaptadores externos
│   ├── adapters/
│   │   ├── database/    # Repositorios Prisma
│   │   ├── ai/          # Integración con Google Gemini
│   │   └── http/        # Servidor Express, Rutas, Middleware
│   └── ...              # Otros adaptadores
└── types/               # Definiciones globales de TypeScript
```

---

## ✨ Características Clave

- **Tutoría Interactiva**: Flujo de conversación guiado por IA con estados pedagógicos (Explicación, Pregunta, Evaluación).
- **RAG (Retrieval-Augmented Generation)**: Recuperación de contexto relevante (lecciones, chunks) para respuestas precisas.
- **Seguridad Infantil**: Procesamiento de audio cero en el servidor (Zero-Audio Privacy) y validación estricta de entradas.
- **Concurrencia Segura**: Uso de bloqueos consultivos (Advisory Locks) de PostgreSQL y control de versiones optimistas.
- **Monitoreo y Logs**: Estructurado con Pino para observabilidad en producción.

---

## 🛠️ Stack Tecnológico

### Backend (API)

- **Lenguaje**: TypeScript (Node.js)
- **Framework**: Express.js
- **Base de Datos**: PostgreSQL (Supabase) con Prisma ORM
- **IA/LLM**: Google Generative AI (Gemini Flash)
- **Validación**: Zod
- **Autenticación**: JWT (Argon2 hashing)
- **Rate Limiting**: Express Rate Limit
- **Logs**: Pino

### Frontend (Web - en desarrollo)

- **Framework**: React (Vite)
- **Gestión de Estado**: Zustand
- **Estilos**: Tailwind CSS

### Herramientas de Desarrollo

- **Gestión de Paquetes**: pnpm (monorepo)
- **Build**: TSUP / tsx
- **Testing**: Jest
- **Linting**: ESLint
- **Formato**: Prettier
- **CI/CD**: TurboRepo

---

## 📂 Estructura del Proyecto (Monorepo)

```text
pixel-mentor/
├── apps/
│   ├── api/              # Backend principal (Hexagonal)
│   └── web/              # Frontend (React/Vite)
├── packages/             # Paquetes compartidos (si aplica)
├── docs/                 # Documentación técnica
└── .agents/              # Habilidades y guías para IA (OpenCode)
```

---

## 🚀 Guía de Instalación

### Requisitos Previos

- Node.js v20+
- pnpm (recomendado) o npm
- PostgreSQL (local o Supabase)

### 1. Clonar el Repositorio

```bash
git clone https://github.com/tu-usuario/pixel-mentor.git
cd pixel-mentor
```

### 2. Instalar Dependencias

```bash
pnpm install
```

### 3. Configurar Variables de Entorno

Copia el archivo de ejemplo y configura tus credenciales:

```bash
cp apps/api/.env.example apps/api/.env
```

Edita `apps/api/.env` con tus credenciales reales:

- `DATABASE_URL`: URL de conexión a PostgreSQL.
- `GEMINI_API_KEY`: Clave API de Google Generative AI.
- `JWT_SECRET`: Clave secreta para firmar tokens.

### 4. Generar Cliente de Base de Datos

```bash
pnpm --filter @pixel-mentor/api db:generate
```

### 5. Iniciar la Base de Datos (Si usas Docker local)

```yaml
# docker-compose.yml (ejemplo simple)
version: '3.8'
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: pixel_mentor
    ports:
      - '5432:5432'
```

```bash
docker-compose up -d
```

### 6. Aplicar Migraciones

```bash
pnpm --filter @pixel-mentor/api db:push
# o
pnpm --filter @pixel-mentor/api db:migrate
```

---

## 💻 Uso

### Desarrollo

Inicia el servidor de desarrollo con recarga en caliente:

```bash
pnpm --filter @pixel-mentor/api dev
```

El servidor estará disponible en `http://localhost:3001`.

### Construcción y Producción

1.  **Construir el proyecto**:

    ```bash
    pnpm --filter @pixel-mentor/api build
    ```

2.  **Ejecutar en producción**:
    ```bash
    pnpm --filter @pixel-mentor/api start
    ```

### Base de Datos

- **Generar cliente Prisma**:
  ```bash
  pnpm --filter @pixel-mentor/api db:generate
  ```
- **Sincronizar esquema (sin migraciones)**:
  ```bash
  pnpm --filter @pixel-mentor/api db:push
  ```
- **Crear migración**:
  ```bash
  pnpm --filter @pixel-mentor/api db:migrate
  ```

### Pruebas

Ejecuta la suite de pruebas unitarias y de integración:

```bash
# Ejecutar todos los tests
pnpm --filter @pixel-mentor/api test

# Ejecutar con cobertura
pnpm --filter @pixel-mentor/api test -- --coverage

# Ejecutar tests específicos
pnpm --filter @pixel-mentor/api test -- --testPathPattern="orchestrate-lesson-flow"
```

---

## 📡 API Reference

El servidor expone una API RESTful en el puerto configurado (por defecto 3001).

### Endpoints Principales

| Método | Ruta                    | Descripción                                            |
| ------ | ----------------------- | ------------------------------------------------------ |
| `GET`  | `/health`               | Verifica estado de la base de datos y servicio.        |
| `GET`  | `/api`                  | Información de la API (nombre, versión, estado).       |
| `POST` | `/api/leccion/start`    | Inicia una nueva sesión de tutoría.                    |
| `POST` | `/api/leccion/interact` | Procesa la interacción del estudiante (transcripción). |
| `GET`  | `/api/lessons`          | Lista lecciones disponibles.                           |
| `GET`  | `/api/lessons/:id`      | Obtiene detalles de una lección.                       |
| `GET`  | `/api/sessions`         | Lista sesiones de usuario.                             |
| `GET`  | `/api/sessions/:id`     | Obtiene estado de una sesión específica.               |

### Ejemplo de Solicitud (Iniciar Lección)

```bash
curl -X POST http://localhost:3001/api/leccion/start \
  -H "Content-Type: application/json" \
  -d '{
    "lessonId": "uuid-de-leccion",
    "studentId": "uuid-de-estudiante"
  }'
```

### Autenticación

Los endpoints protegidos requieren un token JWT en el header:
`Authorization: Bearer <token>`

---

## 🤝 Contribución

Consulte el archivo [AGENTS.md](AGENTS.md) para directrices específicas sobre la arquitectura y el flujo de trabajo con IA.

1.  **Clona el repositorio**: `git clone ...`
2.  **Crea una rama**: `git checkout -b feature/nueva-funcionalidad`
3.  **Realiza cambios**: Sigue los estándares de código (Prettier/ESLint).
4.  **Ejecuta pruebas**: Asegúrate de que todos los tests pasen.
5.  **Commitea**: Sigue el convencional commits.
6.  **Push y PR**: Abre un Pull Request hacia `main`.

### Directrices de Código

- **TypeScript Estricto**: Tipado explícito y estricto.
- **Principio SRP**: Funciones y clases con una única responsabilidad.
- **Hexagonal Architecture**: Mantén la separación de dominios, aplicación e infraestructura.

---

## 📜 Licencia

Distribuido bajo la licencia MIT. Consulte el archivo [LICENSE](LICENSE) para más detalles.

---

## 📚 Recursos y Documentación

- **Arquitectura y Stack**: [`.docs/ai/01-architecture-and-stack.md`](.docs/ai/01-architecture-and-stack.md)
- **Estándares de Código**: [`.docs/ai/02-coding-standards.md`](.docs/ai/02-coding-standards.md)
- **Flujos Core (RAG)**: [`.docs/ai/03-core-flows.md`](.docs/ai/03-core-flows.md)
- **Máquina de Estados**: [`.docs/ai/04-state-machine.md`](.docs/ai/04-state-machine.md)
- **Seguridad y NFRs**: [`.docs/ai/05-security-nfr.md`](.docs/ai/05-security-nfr.md)
