# ZCORE V1 — Documentación para ejecutivos

## ¿Qué es ZCORE?

ZCORE es el score que usa ZAGA para decidir si una persona puede acceder a un préstamo. Va de **0 a 1000 puntos**. A mayor puntaje, mejor perfil crediticio.

**Fuente de datos:** información de deudas del BCRA (Central de Deudores del Banco Central).

---

## Resultado: ¿Aprueba o no?

| ZCORE | Riesgo | Elegible |
|-------|--------|----------|
| 800 o más | BAJO | Sí |
| 600 a 799 | MEDIO | Sí |
| Menor a 600 | ALTO | No |

---

## Reglas automáticas de rechazo

Si ocurre **cualquiera** de estas condiciones, la persona no pasa la precalificación y obtiene score 0:

1. **Situación BCRA 4 o 5** — Estado muy grave de deuda (incumplimiento serio o irreparable).
2. **Proceso judicial** — Tiene deudas en juicio.
3. **Situación jurídica** — Deuda con situación legal compleja.
4. **Irrecuperabilidad técnica** — Deuda declarada técnicamente irrecuperable.

En estos casos no se calcula score: se rechaza de forma directa.

---

## Cómo se calcula el score

### 1. Score base

Se combinan seis factores con distintos pesos:

| Factor | Peso | Qué mide |
|--------|------|----------|
| Situación actual | 25% | Nivel de cumplimiento hoy |
| Días de atraso | 15% | Morosidad actual |
| Flags (refinanciaciones, recategorización) | 12% | Señales de dificultad |
| Historial 24 meses | 20% | Trayectoria reciente |
| Concentración de deuda | 9,5% | Muchas entidades o una muy grande |
| Monto total adeudado | 18,5% | Endeudamiento total |

- Deuda total: hasta $1.000.000 casi no penaliza; desde $15.000.000 penaliza al máximo.
- El score base es una nota de riesgo: más riesgo → menos puntaje.

### 2. Ajuste por tendencia de deuda

Se mira cómo evolucionó la deuda en los últimos 6 meses:

- **Bajó deuda** → Se suma hasta +20 puntos.
- **Subió deuda** → Se restan hasta -20 puntos.
- **Subió de golpe en 3 meses** → Penalización mayor.
- **Deuda nueva desde cero** → Si antes no tenía deuda y ahora tiene ≥ $5.000, se considera suba y se castiga. Montos menores se ignoran para evitar ruido (residuos, errores o apariciones sin relevancia).

Este ajuste solo se aplica cuando no hubo rechazo automático. Sirve para diferenciar a quien mejora de quien empeora, aunque ambos estén hoy en un nivel similar.

### 3. Score final

```
Score final = Score base + Ajuste por tendencia
```

El resultado se mantiene entre 0 y 1000.

---

## Ejemplos conceptuales

- **Persona prolija hoy que viene bajando deuda** → Score base bueno + premio por tendencia → Mejor ZCORE.
- **Persona prolija hoy que viene subiendo deuda** → Score base bueno - castigo por tendencia → Peor ZCORE.
- **Persona con mucha deuda estructural** → La tendencia no compensa el alto endeudamiento; el score base sigue siendo el principal.
- **Persona con situación 4 o 5** → Rechazo automático; no se calcula score.

---

## Resumen en una frase

ZCORE combina el estado actual de deudas, el historial y la tendencia reciente para dar un puntaje de riesgo crediticio entre 0 y 1000; a partir de 600 puntos se considera elegible.
