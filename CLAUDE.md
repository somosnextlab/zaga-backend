# zaga-backend

## Stack
- **Runtime:** Node.js + NestJS 11 (TypeScript)
- **Base de datos:** PostgreSQL — acceso directo con `pg` (sin ORM). SQL raw escrito a mano.
- **Auth:** Sesiones propias (tabla `admin_sessions`), sin JWT de terceros.
- **Jobs:** `@nestjs/schedule` (cron jobs en-proceso).
- **Docs:** Swagger (`@nestjs/swagger`).
- **Deploy:** Producción en `zaga.com.ar`, CORS restringido al dominio productivo.

## Comandos

| Comando | Para qué |
|---|---|
| `npm install` | Instalar dependencias |
| `npm run start:dev` | Servidor en modo desarrollo (watch) |
| `npm run test` | Unit tests (Jest) |
| `npm run test:e2e` | E2E tests |
| `npm run lint` | ESLint + auto-fix |
| `npm run build` | Compilar a `dist/` |
| `npm run admin:create-user` | Crear usuario admin (script) |

Antes de hacer push: correr `lint` y `test`. Si hay errores de TypeScript, el build fallará.

## Variables de entorno requeridas

Las claves esperadas (ver `.env` local, nunca commitear valores):

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Connection string PostgreSQL |
| `PORT` | Puerto HTTP (default 3000) |
| `CORS_ORIGIN` | Origen permitido |
| `BCRA_API_LATEST_URL` | API BCRA — deudas vigentes |
| `BCRA_API_HISTORICAL_URL` | API BCRA — deudas históricas |
| `BCRA_API_TIMEOUT_MS` | Timeout BCRA en ms |
| `BCRA_MAX_CONCURRENT_REQUESTS` | Límite de concurrencia para queries BCRA |
| `SIGNATURA_API_BASE_URL` | Base URL Signatura (firma digital) |
| `SIGNATURA_API_KEY` | API key Signatura |
| `SIGNATURA_WEBHOOK_SECRET` | Secret para validar webhooks de Signatura |
| `CONTRACTS_EXPIRATION_CRON_ENABLED` | Activa/desactiva el cron de vencimiento de contratos |
| `CONTRACTS_EXPIRATION_REMOTE_CANCEL_ENABLED` | Activa cancelación remota de contratos vencidos |
| `CONTRACT_TEMPLATE_DOCX_PATH` | Override opcional de plantilla `.docx` (solo testing) |
| `GOTENBERG_URL` | URL interna de Gotenberg (docx→PDF). Sin default público |
| `GOTENBERG_TIMEOUT_MS` | Timeout de Gotenberg en ms (default 30000) |
| `GOTENBERG_USER` | Usuario Basic Auth de Gotenberg (opcional, si hay proxy con auth) |
| `GOTENBERG_PASS` | Password Basic Auth de Gotenberg (opcional) |
| `N8N_POST_SIGNATURA_WEBHOOK_URL` | Webhook n8n que se dispara post-firma |

## Arquitectura

API NestJS modular — cada módulo es un dominio de negocio.

| Módulo | Responsabilidad |
|---|---|
| `db` | `DbService` global: pool pg, `query()`, `withTransaction()` |
| `zaga-auth` | Auth del backoffice: sesiones, guards, decoradores |
| `audit` | Registro de acciones de administradores |
| `cases` | Solicitudes de préstamo (lead → caso → oferta) |
| `case-guarantors` | Garantes de un caso |
| `consents` | Consentimientos del usuario final |
| `prequal` | Motor de pre-calificación crediticia (consulta BCRA) |
| `offerEngine` | Generación de ofertas de préstamo |
| `contracts` | Generación, firma digital (Signatura) y gestión de contratos |
| `loans` | Préstamos activos desembolsados |
| `cobranzas` | Motor de mora, cuotas, pagos e historial de cobranza |
| `leads` | Listado y gestión de leads (backoffice) |
| `users` | Usuarios del sistema (backoffice) |
| `dashboard` | Métricas y resumen para el backoffice |

## Convenciones del código

- **Sin ORM.** Todas las queries son SQL raw a través de `DbService.query()`. No usar TypeORM, Prisma ni query builders.
- **Repository pattern.** La capa de acceso a datos va en clases `*.repository.ts`. Los servicios no hacen queries directas.
- **Transacciones:** usar `DbService.withTransaction(async (client) => { ... })`. Nunca gestionar `BEGIN/COMMIT/ROLLBACK` manualmente.
- **DTOs con class-validator.** La validación de entrada va en DTOs, no en servicios.
- **Backoffice vs app:** Los controllers con sufijo `-backoffice` son para el panel admin (protegidos por `ZagaSessionGuard`). Los sin sufijo son para la app del usuario final.

## Reglas

- No commitear `.env` ni secrets. Las variables productivas nunca van al repo.
- No aplicar cambios de esquema SQL sin revisión previa. No hay sistema de migraciones automáticas — los cambios se aplican manualmente desde `scripts/sql/`.
- No modificar la interfaz pública de `DbService`; es global y todos los módulos dependen de ella.
- Antes de implementar un cambio que toque más de un módulo, explicar el plan y pedir aprobación.
- Después de cambiar código: correr `npm run lint` y `npm run test`. Si el cambio toca contratos o cobranzas, correr también `npm run test:e2e`.

## Criterio de terminado

- `npm run test` pasa sin errores.
- `npm run build` compila sin errores TypeScript.
- `npm run lint` sin warnings nuevos.
- Si hubo cambios en endpoints, Swagger está actualizado.
- Si hubo cambios de esquema, el SQL correspondiente está en `scripts/sql/`.
