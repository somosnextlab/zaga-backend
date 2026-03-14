/** Cantidad de dígitos que debe tener un CUIT válido. */
export const CUIT_DIGITS_LENGTH = 11;

/** Patrón de periodo BCRA (YYYYMM). */
export const PERIODO_REGEX = /^\d{6}$/;

/** Máximo de reintentos ante fallos temporales (5xx, red, timeout). */
export const BCRA_MAX_RETRIES = 3;

/** Base del exponential backoff en ms (1s, 2s, 4s). */
export const BCRA_BACKOFF_BASE_MS = 1000;

/** Jitter ±20% para evitar picos simultáneos entre instancias. */
export const BCRA_BACKOFF_JITTER = 0.2;
