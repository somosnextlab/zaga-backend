# Plan de desarrollo — Módulo prequal

## Implementación completada

### Archivos creados

| Archivo                              | Propósito                                                                          |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| `src/prequal/dto/run-prequal.dto.ts` | DTO con validación: userId (UUID), phone (string no vacío), cuit (string no vacío) |
| `src/prequal/prequal.service.ts`     | Toda la lógica: HTTP BCRA, normalización, score ZCORE_BCRA_V1, persistencia        |
| `src/prequal/prequal.controller.ts`  | Endpoint POST /internal/prequal/run, delega al service                             |
| `src/prequal/prequal.module.ts`      | Módulo Nest con controller y service                                               |

### Archivos modificados

| Archivo             | Cambio                           |
| ------------------- | -------------------------------- |
| `src/app.module.ts` | Agregar PrequalModule en imports |

### Variables de entorno nuevas (opcionales)

- `BCRA_API_LATEST_URL` (default: https://api.bcra.gob.ar/centraldedeudores/v1.0/deudas)
- `BCRA_API_HISTORICAL_URL` (default: https://api.bcra.gob.ar/centraldedeudores/v1.0/deudas/historicas)
- `BCRA_API_TIMEOUT_MS` (default: 15000)

## Flujo interno del service (orden exacto)

1. Validar y normalizar input (normalizeCuit)
2. Buscar usuario por userId (findUserById)
3. Si no existe → BUSINESS / USER_NOT_FOUND
4. Consultar BCRA latest (fetchBcraLatest)
5. Consultar BCRA historical24m (fetchBcraHistorical24m)
6. Clasificar respuestas (classifyBcraResponses) → SUCCESS | BUSINESS | TECHNICAL
7. Normalizar latest (normalizeLatest)
8. Normalizar historical (normalizeHistorical)
9. Parsear denominacion (parseDenominacion)
10. Decidir si actualizar users (shouldPersistParsedName)
11. Calcular ZCORE_BCRA_V1 (computeZcoreBcraV1)
12. Armar raw { latest, historical24m }
13. withTransaction: update users (si aplica) + upsert user_prequals
14. Devolver respuesta final

## SQL implementados

### 1. Buscar usuario por id

```sql
SELECT id, phone, cuit, first_name, last_name
FROM users
WHERE id = $1
```

### 2. Actualizar first_name y last_name en users

```sql
UPDATE users SET first_name = $2, last_name = $3 WHERE id = $1
```

### 3. Upsert en user_prequals (ON CONFLICT user_id, periodo)

```sql
INSERT INTO user_prequals (
  user_id, phone, cuit, bcra_status, periodo, entidades_count,
  max_situacion, total_monto, max_dias_atraso, max_entity_amount,
  max_entity_name, has_refinanciaciones, has_recategorizacion_oblig,
  has_situacion_juridica, has_irrec_disposicion_tecnica, has_proceso_jud,
  has_en_revision, eligible, risk_level, score_initial, score_reason,
  zcore_bcra, model_version, raw, checked_at
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
  $17, $18, $19, $20, $21, $22, $23, $24::jsonb, now()
)
ON CONFLICT (user_id, periodo) DO UPDATE SET
  bcra_status = EXCLUDED.bcra_status,
  entidades_count = EXCLUDED.entidades_count,
  max_situacion = EXCLUDED.max_situacion,
  total_monto = EXCLUDED.total_monto,
  max_dias_atraso = EXCLUDED.max_dias_atraso,
  max_entity_amount = EXCLUDED.max_entity_amount,
  max_entity_name = EXCLUDED.max_entity_name,
  has_refinanciaciones = EXCLUDED.has_refinanciaciones,
  has_recategorizacion_oblig = EXCLUDED.has_recategorizacion_oblig,
  has_situacion_juridica = EXCLUDED.has_situacion_juridica,
  has_irrec_disposicion_tecnica = EXCLUDED.has_irrec_disposicion_tecnica,
  has_proceso_jud = EXCLUDED.has_proceso_jud,
  has_en_revision = EXCLUDED.has_en_revision,
  eligible = EXCLUDED.eligible,
  risk_level = EXCLUDED.risk_level,
  score_initial = EXCLUDED.score_initial,
  score_reason = EXCLUDED.score_reason,
  zcore_bcra = EXCLUDED.zcore_bcra,
  model_version = EXCLUDED.model_version,
  raw = EXCLUDED.raw,
  checked_at = now()
```

**Nota:** La columna `raw` debe ser de tipo `jsonb`. Si es `text`, cambiar `$24::jsonb` por `$24`.

## Contrato de respuesta

- Éxito: ok, eligible, risk_level, zcore_bcra, score_initial, score_reason, model_version, periodo, first_name, last_name
- Error: ok: false, error_type (TECHNICAL|BUSINESS), error_code

## Tests

### Unit tests (`src/prequal/prequal.service.spec.ts`)

- Input inválido: CUIT &lt; 11 dígitos, CUIT &gt; 11 dígitos, CUIT con guiones (normalización)
- Usuario no existe: USER_NOT_FOUND
- BCRA técnico: timeout/error → BCRA_UNAVAILABLE
- BCRA sin datos: 404, periodos vacíos → BCRA_NO_DATA
- BCRA payload inválido: periodo no válido → BCRA_INVALID_PAYLOAD
- Éxito aprobable: ok:true, eligible, risk_level
- Éxito no aprobable: score bajo
- Hard reject: proceso_jud, situacion_juridica, max_situacion ≥ 5
- Denominación: parseable, no confiable
- Persistencia: withTransaction, consultas BCRA en paralelo

### E2E tests (`test/prequal.e2e-spec.ts`)

- POST con body válido → ok:true
- Validación DTO: userId no UUID, phone vacío, cuit vacío, body incompleto → 400
- Usuario inexistente → ok:false, USER_NOT_FOUND

## Fuera de alcance (confirmación)

- NO Twilio, n8n, leads.stage, CASE, CEO
- NO user_prequal_state, nuevas tablas/columnas
- NO cache, colas, cron, eventos
- NO repository, client, adapter, mapper separados
