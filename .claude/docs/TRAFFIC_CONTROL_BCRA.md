# Control de tráfico — API BCRA Central de Deudores

Documento de seguimiento para el control de tráfico hacia la API del BCRA. El manual del BCRA indica que aplican reglas de control de tráfico por IP; este documento describe la implementación y las mejoras planificadas.

---

## Contexto

- **Fuente:** Manual BCRA API Central de Deudores v1.0 (ver `BCRA-API-central-deudores-v1.pdf`)
- **Regla BCRA:** "Se establecen distintas reglas de control del tráfico proveniente de los clientes basado en las direcciones IP"
- **Límites:** El manual no especifica valores concretos (requests/min, requests/seg, etc.)

---

## Implementado

### Fase 1: Cola con concurrencia limitada ✅

**Fecha:** 2025-03

**Descripción:** Se limita cuántas requests HTTP hacia el BCRA pueden ejecutarse en paralelo. Las requests excedentes esperan en cola.

**Archivos:**

| Archivo | Propósito |
|---------|-----------|
| `src/prequal/bcra-request-queue.ts` | Clase `BcraRequestQueue` con semáforo para limitar concurrencia |
| `src/prequal/prequal.service.ts` | Integración: `fetchWithRetry` pasa cada fetch por la cola |

**Variable de entorno:**

| Variable | Default | Descripción |
|----------|---------|-------------|
| `BCRA_MAX_CONCURRENT_REQUESTS` | 5 | Máximo de requests BCRA en paralelo (latest + historical cuentan como 2) |

**Comportamiento:**

- Cada `runPrequal` hace 2 requests en paralelo (latest + historical)
- Con concurrencia 5, hay como máximo 5 requests simultáneas al BCRA
- Las requests adicionales esperan en cola hasta que haya un slot libre
- La cola se aplica por request individual (cada fetch ocupa un slot)

---

## Pendiente / Futuro

### Fase 2: Rate limiting por tiempo (opcional)

**Objetivo:** Limitar requests por minuto además de la concurrencia.

**Enfoque:** Token bucket o sliding window. Ejemplo: 30 requests/minuto.

**Variables sugeridas:**

```env
BCRA_REQUESTS_PER_MINUTE=30
```

**Prioridad:** Media. Implementar si se observan 429 o bloqueos por IP.

---

### Fase 3: Circuit breaker (opcional)

**Objetivo:** Ante fallos consecutivos del BCRA, dejar de llamar temporalmente y devolver `BCRA_UNAVAILABLE` sin saturar la API.

**Enfoque:** Tras N fallos consecutivos → estado "abierto" durante X segundos → no hacer requests.

**Variables sugeridas:**

```env
BCRA_CIRCUIT_BREAKER_THRESHOLD=5
BCRA_CIRCUIT_BREAKER_COOLDOWN_MS=60000
```

**Prioridad:** Media. Útil si la API del BCRA es inestable.

---

### Fase 4: Caché de respuestas (opcional)

**Objetivo:** Reducir llamadas al BCRA cuando el mismo CUIT se consulta varias veces en poco tiempo.

**Consideración:** El BCRA actualiza datos mensualmente. Cachear por CUIT + periodo con TTL corto (ej. 1 hora) podría reducir tráfico.

**Nota:** `PLAN_PREQUAL.md` indicaba cache como fuera de alcance en la versión inicial. Revisar si aplica para control de tráfico.

**Prioridad:** Baja.

---

## Métricas recomendadas

Para calibrar límites y detectar problemas:

| Métrica | Descripción |
|---------|-------------|
| `bcra_requests_total` | Total de requests al BCRA |
| `bcra_queue_wait_ms` | Tiempo que una request esperó en cola |
| `bcra_requests_failed` | Requests fallidas (por tipo: timeout, 5xx, etc.) |
| `bcra_circuit_open` | (Fase 3) Si el circuit breaker está abierto |

---

## Notas operativas

1. **Múltiples instancias:** Si hay varios pods/servidores, cada uno tiene su propia cola. El BCRA ve la IP de salida (o del load balancer). El límite efectivo es por IP de salida.
2. **Valores conservadores:** Empezar con `BCRA_MAX_CONCURRENT_REQUESTS=5`. Ajustar según observación (429, bloqueos, latencia).
3. **UX:** Con cola, las requests que esperan tardan más. Considerar timeout de request (ej. 30s) para no dejar al usuario esperando indefinidamente.

---

## Historial de cambios

| Fecha | Cambio |
|-------|--------|
| 2025-03 | Fase 1: Cola con concurrencia limitada implementada |
