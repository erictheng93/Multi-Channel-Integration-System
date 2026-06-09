import { describe, expect, it } from 'vitest';
import { isOperationalDrillAuthorized } from '@/routes/operational-drill-routes';

describe('operational drill authorization', () => {
  it('is unavailable outside staging', () => {
    const result = isOperationalDrillAuthorized({
      ENVIRONMENT: 'production',
      OPERATIONAL_DRILLS_ENABLED: 'true',
      OPERATIONAL_DRILL_TOKEN: 'secret'
    }, 'secret');

    expect(result).toEqual({
      authorized: false,
      status: 404,
      error: 'Operational drills are only available in staging'
    });
  });

  it('requires explicit staging enablement', () => {
    const result = isOperationalDrillAuthorized({
      ENVIRONMENT: 'staging',
      OPERATIONAL_DRILLS_ENABLED: 'false',
      OPERATIONAL_DRILL_TOKEN: 'secret'
    }, 'secret');

    expect(result).toEqual({
      authorized: false,
      status: 404,
      error: 'Operational drills are disabled'
    });
  });

  it('requires a configured token', () => {
    const result = isOperationalDrillAuthorized({
      ENVIRONMENT: 'staging',
      OPERATIONAL_DRILLS_ENABLED: 'true'
    }, 'secret');

    expect(result).toEqual({
      authorized: false,
      status: 503,
      error: 'Operational drill token is not configured'
    });
  });

  it('rejects an invalid token', () => {
    const result = isOperationalDrillAuthorized({
      ENVIRONMENT: 'staging',
      OPERATIONAL_DRILLS_ENABLED: 'true',
      OPERATIONAL_DRILL_TOKEN: 'secret'
    }, 'wrong');

    expect(result).toEqual({
      authorized: false,
      status: 401,
      error: 'Invalid operational drill token'
    });
  });

  it('accepts the configured staging token', () => {
    const result = isOperationalDrillAuthorized({
      ENVIRONMENT: 'staging',
      OPERATIONAL_DRILLS_ENABLED: 'true',
      OPERATIONAL_DRILL_TOKEN: 'secret'
    }, 'secret');

    expect(result).toEqual({ authorized: true });
  });
});
