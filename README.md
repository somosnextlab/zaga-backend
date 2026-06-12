# zaga-backend

API del MVP de **ZAGA** — micro-préstamos online, WhatsApp-first, operado bajo PUGIA SAS (Argentina).

Backend NestJS que cubre el flujo de préstamo punta a punta: onboarding, pre-calificación crediticia (BCRA), motor de ofertas, garantes, recolección de datos, generación y firma digital de contratos, y cobranzas.

> Contexto de negocio y guía de trabajo: ver [`CLAUDE.md`](./CLAUDE.md) (raíz del repo y de este paquete).

---

## Stack

- **Runtime:** Node.js + NestJS 11 (TypeScript)
- **Base de datos:** PostgreSQL — acceso directo con `pg` (sin ORM, SQL raw)
- **Auth backoffice:** sesiones propias (`admin_sessions`), sin JWT de terceros
- **Jobs:** `@nestjs/schedule` (cron en-proceso)
- **Firma digital:** Signatura (proveedor externo)
- **Contratos → PDF:** Gotenberg (docx → PDF fiel vía LibreOffice)
- **Docs API:** Swagger (`@nestjs/swagger`)
- **Deploy:** backend en Railway; PostgreSQL + n8n en Hostinger KVM2; dominio productivo `zaga.com.ar`

## Requisitos previos

- Node.js 18+ (se usan `fetch`/`FormData`/`Blob` nativos)
- PostgreSQL accesible vía `DATABASE_URL`, con la extensión `unaccent` habilitada (`CREATE EXTENSION IF NOT EXISTS unaccent;`) — el match de localidad en la recolección de datos del contrato es tolerante a tildes
- Gotenberg accesible vía `GOTENBERG_URL` (solo para generar contratos)

## Setup

```bash
npm install
```

Crear un `.env` local con las variables de la tabla de abajo (nunca commitear `.env` ni secrets).

## Variables de entorno

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Connection string PostgreSQL |
| `PORT` | Puerto HTTP (default 3000) |
| `CORS_ORIGIN` | Origen permitido |
| `BCRA_API_LATEST_URL` | API BCRA — deudas vigentes |
| `BCRA_API_HISTORICAL_URL` | API BCRA — deudas históricas |
| `BCRA_API_TIMEOUT_MS` | Timeout BCRA en ms |
| `BCRA_MAX_CONCURRENT_REQUESTS` | Límite de concurrencia para queries BCRA |
| `SIGNATURA_API_BASE_URL` | Base URL Signatura |
| `SIGNATURA_API_KEY` | API key Signatura |
| `SIGNATURA_WEBHOOK_SECRET` | Secret para validar webhooks de Signatura |
| `CONTRACTS_EXPIRATION_CRON_ENABLED` | Activa el cron de vencimiento de contratos |
| `CONTRACTS_EXPIRATION_REMOTE_CANCEL_ENABLED` | Activa cancelación remota de contratos vencidos |
| `CONTRACT_TEMPLATE_DOCX_PATH` | Override opcional de plantilla `.docx` (solo testing) |
| `GOTENBERG_URL` | URL interna de Gotenberg (docx→PDF). Sin default público |
| `GOTENBERG_TIMEOUT_MS` | Timeout de Gotenberg en ms (default 30000) |
| `GOTENBERG_USER` / `GOTENBERG_PASS` | Basic Auth de Gotenberg (opcional, si hay proxy con auth) |
| `N8N_POST_SIGNATURA_WEBHOOK_URL` | Webhook n8n que se dispara post-firma |

## Comandos

```bash
npm run start:dev        # servidor en watch mode
npm run start:prod       # node dist/main (requiere build previo)
npm run build            # compila a dist/
npm run lint             # ESLint + auto-fix
npm run test             # unit tests (Jest)
npm run test:e2e         # tests e2e
npm run test:cov         # cobertura
npm run admin:create-user  # crear usuario admin del backoffice
npm run seed:localidades   # seed de localidades de referencia
```

> Antes de pushear: `npm run lint` y `npm run test`. Si el cambio toca contratos o cobranzas, correr también `npm run test:e2e`.

## Arquitectura

API NestJS modular — cada módulo es un dominio de negocio.

| Módulo | Responsabilidad |
|---|---|
| `db` | `DbService` global: pool `pg`, `query()`, `withTransaction()` |
| `zaga-auth` | Auth del backoffice: sesiones, guards, decoradores |
| `audit` | Registro de acciones de administradores |
| `cases` | Solicitudes de préstamo (lead → caso → oferta) |
| `case-guarantors` | Garantes/codeudores de un caso |
| `consents` | Consentimientos del usuario final |
| `prequal` | Motor de pre-calificación crediticia (consulta BCRA) |
| `offerEngine` | Generación de ofertas de préstamo |
| `contracts` | Generación, firma digital (Signatura) y gestión de contratos |
| `loans` | Préstamos activos desembolsados |
| `cobranzas` | Motor de mora, cuotas, pagos e historial de cobranza |
| `leads` | Listado y gestión de leads (backoffice) |
| `users` | Usuarios del sistema (backoffice) |
| `dashboard` | Métricas y resumen para el backoffice |

**Backoffice vs app:** los controllers con sufijo `-backoffice` son del panel admin (protegidos por `ZagaSessionGuard`); los sin sufijo son para la app del usuario final.

### Generación de contratos

Según la operación se elige el contrato (`resolveContractKind`):

| Caso | Kind | templateCode |
|---|---|---|
| Préstamo titular sin garante | `MUTUO` | `CONTRATO_MUTUO_ZAGA_V1` |
| Préstamo titular + garante | `MUTUO_CODEUDOR` | `CONTRATO_MUTUO_CODEUDOR_ZAGA_V1` |
| Refinanciación (siempre con codeudor) | `REFINANCIACION` | `CONTRATO_REFINANCIACION_ZAGA_V1` |

Las plantillas viven en [`src/contracts/assets/`](./src/contracts/assets/) como `.docx` con tags `{{VAR}}`. El flujo: docxtemplater rellena el `.docx` → `GotenbergPdfConverter` lo convierte a PDF fiel → se envía a Signatura en base64. Sin `GOTENBERG_URL` configurada, la generación de contratos falla con error claro.

## Convenciones

- **Sin ORM:** todas las queries son SQL raw vía `DbService.query()`. La capa de datos va en clases `*.repository.ts`; los servicios no hacen queries directas.
- **Transacciones:** usar `DbService.withTransaction(async (client) => { ... })`, nunca `BEGIN/COMMIT/ROLLBACK` manual.
- **Validación de entrada:** DTOs con `class-validator`. `ValidationPipe` global con `whitelist` + `forbidNonWhitelisted`.
- **Esquema SQL:** sin migraciones automáticas; los cambios se aplican a mano desde [`scripts/sql/`](./scripts/sql/).

Detalle completo de convenciones, reglas y criterio de terminado en [`CLAUDE.md`](./CLAUDE.md).
