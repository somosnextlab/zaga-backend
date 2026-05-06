/**
 * Normalización mínima para creación de caso vía interno (n8n / Twilio).
 * No altera el formato E.164 (+54...) salvo quitar prefijo `whatsapp:`.
 */
export function normalizeCaseCreationPhone(raw: string): string {
  let s = raw.trim();
  if (/^whatsapp:/i.test(s)) {
    s = s.replace(/^whatsapp:/i, '').trim();
  }
  return s;
}
