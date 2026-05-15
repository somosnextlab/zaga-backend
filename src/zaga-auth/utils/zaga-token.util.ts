import { createHash, randomBytes } from 'crypto';

export function hashSessionToken(plainToken: string): string {
  return createHash('sha256').update(plainToken, 'utf8').digest('hex');
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}
