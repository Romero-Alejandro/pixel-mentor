# Skill Registry - Pixel Mentor

**Última actualización:** 2026-03-14

## Project Skills

| Skill | Descripción | Trigger |
|-------|-------------|---------|
| webapp-testing | Testing de aplicaciones web con Playwright | testing, verificación UI, screenshots |
| api-design-principles | Principios de diseño REST/GraphQL | diseño de APIs |
| supabase-postgres-best-practices | Optimización de Postgres/Supabase | queries, schema, base de datos |
| error-handling-patterns | Patrones de manejo de errores | errores, excepciones, resiliencia |
| vercel-react-best-practices | Optimización React/Next.js | componentes React, Next.js, performance |
| backend-testing | Tests backend (Jest, integration, API) | tests, testing, coverage |
| security-best-practices | Seguridad web (OWASP, HTTPS, CORS, etc) | seguridad, protección |
| systematic-debugging | Debugging sistemático | bugs, errores, debugging |
| brainstorming | Lluvia de ideas antes de trabajo creativo | crear features, nuevos componentes |
| interface-design | Diseño de interfaces (dashboards, apps, tools) | interfaces, UI, UX |

## SDD Skills

| Skill | Descripción | Trigger |
|-------|-------------|---------|
| sdd-init | Inicializar SDD en proyecto | sdd init, openspec init |
| sdd-explore | Explorar ideas antes de implementar | /sdd-explore |
| sdd-propose | Crear propuesta de cambio | /sdd-new |
| sdd-spec | Escribir especificaciones | specs, requisitos |
| sdd-design | Diseño técnico | arquitectura, diseño |
| sdd-tasks | Descomponer en tareas | tareas, checklist |
| sdd-apply | Implementar código | implementación |
| sdd-verify | Verificar implementación vs specs | verificar, tests |
| sdd-archive | Archivar cambio completado | archivar |

## Conventions

### Stack Detectado
- **Monorepo:** pnpm workspaces + turbo
- **Backend:** Express/Prisma
- **Frontend:** React/Zustand
- **Testing:** Jest
- **TypeScript:** 5.9.3

### Protocolos de Terminal
- Linting: `pnpm lint`
- Type Checking (Backend): `pnpm --filter @pixel-mentor/api typecheck`
- Unit Testing: `pnpm --filter @pixel-mentor/api test -- --testPathPattern="{exact_filename}"`
- Prisma Generation: `pnpm --filter @pixel-mentor/api db:generate`

### Rutas Importantes
- Arquitectura/Stack: `docs/ai/01-architecture-and-stack.md`
- Schema DB: `apps/api/prisma/schema.prisma`
- Estándares: `docs/ai/02-coding-standards.md`
- PRD: `docs/PRD.md`
