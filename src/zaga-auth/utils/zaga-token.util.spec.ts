import { generateSessionToken, hashSessionToken } from './zaga-token.util';

describe('zaga-token.util', () => {
  it('hashSessionToken es determinista y distinta del token plano', () => {
    const t = 'abc123';
    expect(hashSessionToken(t)).toBe(hashSessionToken(t));
    expect(hashSessionToken(t)).not.toContain(t);
  });

  it('generateSessionToken genera longitud suficiente', () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(a).not.toBe(b);
  });
});
