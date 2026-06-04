# Arquitectura — zaga-backend

## Propósito del sistema

API backend de originación y formalización de créditos para Zaga (Argentina). Cubre el flujo completo: precalificación crediticia → caso → oferta → firma digital → préstamo activo → cobranza.

---

## Patrones técnicos clave

### Acceso a datos
- Sin ORM. Todo SQL raw a través de `DbService.query(sql, params)`.
- Repositorios (`*.repository.ts`) encapsulan las queries. Los servicios no escriben SQL.
- Transacciones: `DbService.withTransaction(async (client) => { ... })`. Algunas queries críticas usan `FOR UPDATE` para evitar race conditions.

### Autenticación
- Rutas públicas (`/prequal/*`, `/consents/*`, `/cases/*`, `/webhooks/*`): sin guard global. La seguridad perimetral depende de la capa de red/gateway.
- Rutas backoffice (`/auth/*`, `/private/*`): protegidas por `ZagaSessionGuard`. Sesiones persistidas en `admin_sessions` (token opaco, solo el hash en BD).

### Webhooks
- El servidor arranca con `rawBody: true` (necesario para validar HMAC de Signatura sobre el cuerpo crudo).
- Verificación HMAC timing-safe. Si el secret tiene 64 hex chars, se interpreta como 32 bytes binarios.

### Jobs
- `@nestjs/schedule` con cron en-proceso. El job de expiración de contratos corre cada 5 minutos.
- Controlado por vars de entorno: `CONTRACTS_EXPIRATION_CRON_ENABLED`, `CONTRACTS_EXPIRATION_REMOTE_CANCEL_ENABLED`.

---

## Flujos de negocio

### Embudo del lead (`lead_stage`)

```
NEED_CONSENT
  → (acepta consentimiento) → NEED_DATA
  → (completa datos) → DATA_COMPLETE
  → WAITING_REQUESTED_AMOUNT
  → (crea caso) → WAITING_CEO
  → OFFER_SENT
  → REJECTED
```

### Estados del caso

```
WAITING_CEO
  → (se crea oferta) → OFFER_SENT
  → (requiere garante) → PENDING_GUARANTOR_ANALYSIS
  → (garante OK, CEO aprueba) → PENDING_NOSIS
  → (aprobación final) → APROBADO_FINAL
```

### Flujo de contrato

```
(caso APROBADO_FINAL + oferta ACCEPTED)
  → start-contract → CREATED → SIGN_PENDING
  → (webhook Signatura firma exitosa) → SIGNED → inserta loan
  → (webhook firma fallida / expiración) → FAILED / CANCELED
```

### Motor de oferta (ZagaTasas v1)
- 12 cuotas semanales, sistema francés, IVA 21% sobre intereses.
- Montos válidos: 100k–500k ARS en pasos de 100k.
- Ofertas previas pasan a `SUPERSEDED` cuando se crea una nueva.

### Motor de precalificación (Zcore BCRA v1)
- Score 0–1000. Elegible desde 600.
- Umbrales: ≥800 riesgo BAJO, 600–799 riesgo MEDIO, <600 riesgo ALTO.
- Rechazo automático (score=0) si: situación BCRA 4/5, proceso judicial, situación jurídica o irrecuperabilidad técnica.
- Límite concurrencia BCRA: `BCRA_MAX_CONCURRENT_REQUESTS` (default 5). Las requests excedentes se encolan en `BcraRequestQueue`.

### Garantes
- Solo si el caso tiene `requires_guarantor=true` y está en `OFFER_SENT` o `PENDING_GUARANTOR_ANALYSIS`.
- Máximo 3 intentos. No se permite CUIT duplicado ni igual al del solicitante.
- Umbral de aprobación automática: `zcore_bcra >= 800`.
- Errores técnicos BCRA devuelven `retryable: true` sin consumir intento de negocio.

---

## Superficie de API

### Pública (n8n / canales operativos)

| Ruta | Propósito |
|------|-----------|
| `POST /prequal/run` | Precalificación crediticia |
| `POST /consents/accept` | Registrar consentimiento |
| `GET /consents/token/:token` | Estado del token de consentimiento |
| `POST /cases/create-from-requested-amount` | Crear caso, avanza lead a WAITING_CEO |
| `POST /cases/:id/create-offer` | Motor ZagaTasas |
| `POST /cases/:id/evaluate-guarantor` | Evaluar CUIT garante |
| `POST /cases/:id/resolve-guarantor` | Resolución manual garante (CEO) |
| `POST /cases/:id/update-manual-identity` | Nombre/apellido en carril revisión manual |
| `POST /cases/:id/approve-final` | APROBADO_FINAL + oferta ACCEPTED |
| `POST /cases/:id/start-contract` | Iniciar firma digital |
| `GET /cases/:id/get-current-contract` | Estado contractual actual |
| `POST /webhooks/signatura/case-contract` | Webhook eventos Signatura |

### Backoffice (`/auth/*` y `/private/*`, todas con `ZagaSessionGuard`)

| Ruta | Propósito |
|------|-----------|
| `POST /auth/login` | Login backoffice |
| `GET /auth/me` | Usuario de la sesión actual |
| `POST /auth/logout` | Revocar sesión |
| `GET /private/dashboard/summary` | Conteos agregados |
| `GET /private/search` | Búsqueda transversal |
| `GET /private/leads` | Listado leads |
| `GET /private/cases` | Listado casos |
| `GET /private/cases/:id` | Detalle compuesto de caso |
| `GET /private/cases/:id/timeline` | Timeline derivado de timestamps existentes |
| `GET /private/contracts` | Listado contratos |
| `GET /private/loans` | Listado préstamos |
| `GET /private/audit-logs` | Auditoría interna |

**Nota:** el backoffice es solo lectura. Las acciones comerciales (aprobar, desembolsar) siguen por WhatsApp/n8n.

---

## Integraciones externas

| Servicio | Propósito | Credenciales |
|----------|-----------|--------------|
| BCRA API | Consulta deudas crediticias | Solo URLs públicas, sin key |
| Signatura | Firma digital de contratos | `SIGNATURA_API_KEY`, `SIGNATURA_WEBHOOK_SECRET` |
| n8n | Notificación post-firma | `N8N_POST_SIGNATURA_WEBHOOK_URL` |

---

## Esquema de base de datos (tablas principales)

El esquema completo está en la DB. Las tablas `admin_users`, `admin_sessions` y `admin_audit_logs` tienen DDL en `scripts/sql/backoffice-auth-tables.sql` (idempotente, útil para dev).

Tablas de negocio asumidas como existentes: `leads`, `users`, `user_prequals`, `cases`, `case_offers`, `case_guarantors`, `case_contracts`, `loans`, `consents`, `cuotas`, `pagos`, `compromisos_pago`, `historial_cobranza`.

---

## Módulo cobranzas

Dominio aparte del flujo de originación. Se activa post-desembolso.

| Servicio | Responsabilidad |
|----------|----------------|
| `CuotasService` | Gestión y consulta de cuotas del préstamo |
| `MoraService` | Cálculo de mora y estado de morosidad |
| `PagosService` | Registro y validación de pagos |
| `HistorialCobranzaService` | Registro histórico de gestiones de cobranza |
| `CobranzasBackofficeService` | Lectura para el panel backoffice |

Expone tres controllers: backoffice, interno y el que sirve a la app del préstamo (`loans-cobranzas`).
