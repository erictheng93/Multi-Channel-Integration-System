import { describe, expect, it } from 'vitest';

import { DEFAULT_AUTH_MODULE_CONFIG, initializeAuthModule } from '@modules/auth';

describe('Auth module configuration', () => {
  const validJwtSecret = 'a'.repeat(32);

  it('does not expose a JWT secret through the default module config', () => {
    expect('jwtSecret' in DEFAULT_AUTH_MODULE_CONFIG).toBe(false);
  });

  it.each([
    ['missing secret', undefined],
    ['empty secret', ''],
    ['legacy default secret', 'default-secret'],
    ['example template secret', 'your-super-secret-jwt-key-here'],
    ['short secret', 'short'],
    ['whitespace-padded short secret', ` ${'a'.repeat(30)} `]
  ])('rejects %s', (_caseName, jwtSecret) => {
    expect(() =>
      initializeAuthModule(jwtSecret === undefined ? {} : { jwtSecret })
    ).toThrow(/JWT_SECRET/);
  });

  it('initializes with an explicit strong JWT secret', () => {
    const module = initializeAuthModule({ jwtSecret: validJwtSecret });

    expect(module.config.jwtSecret).toBe(validJwtSecret);
    expect(module.config.tokenExpiry).toBe(DEFAULT_AUTH_MODULE_CONFIG.tokenExpiry);
  });
});
