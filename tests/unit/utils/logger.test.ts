/**
 * Logger — Unit Tests
 *
 * Regression tests for the 2026-04-14 "silent catch" incident where a D1
 * query failure in the conversations list handler was invisible in
 * production because Logger.error() was gated behind `enableConsole`, which
 * is false in production by design (to keep debug/info noise out).
 *
 * Invariants locked in here:
 *   1. error() and fatal() ALWAYS emit to console.error regardless of
 *      enableConsole — errors should never be silently dropped.
 *   2. error() and fatal() still respect the `silent` log level so tests
 *      and opt-out scenarios keep working.
 *   3. debug() and info() keep their existing production noise control
 *      (they stay gated by enableConsole so we don't flood logs).
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Logger', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Reset the module registry so each test gets a fresh singleton.
    vi.resetModules();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('error() / fatal() always emit (regression: silent catch incident)', () => {
    test('error() writes to console.error in production (enableConsole=false)', async () => {
      const { logger, configureLogger } = await import('@/utils/logger');
      // Simulate production: LOG_LEVEL=info, ENVIRONMENT=production
      configureLogger({ logLevel: 'info', environment: 'production' });

      logger.error('Database connection failed', 'TestContext', { code: 500 });

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const payload = consoleErrorSpy.mock.calls[0][0];
      expect(typeof payload).toBe('string');
      const parsed = JSON.parse(payload as string);
      expect(parsed.level).toBe('error');
      expect(parsed.message).toBe('Database connection failed');
      expect(parsed.context).toBe('TestContext');
      expect(parsed.metadata).toEqual({ code: 500 });
    });

    test('error() serializes Error instances into the entry', async () => {
      const { logger, configureLogger } = await import('@/utils/logger');
      configureLogger({ logLevel: 'info', environment: 'production' });

      const cause = new Error('D1_ERROR: too many SQL variables');
      logger.error('Query failed', 'ConversationQueries', { requested: 52 }, cause);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
      expect(parsed.error).toBe('D1_ERROR: too many SQL variables');
      expect(parsed.metadata).toEqual({ requested: 52 });
    });

    test('fatal() writes to console.error in production (enableConsole=false)', async () => {
      const { logger, configureLogger } = await import('@/utils/logger');
      configureLogger({ logLevel: 'info', environment: 'production' });

      logger.fatal('Unrecoverable state', 'TestContext');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
      expect(parsed.level).toBe('fatal');
      expect(parsed.message).toBe('Unrecoverable state');
    });

    test('error() still respects log level = silent (opt-out escape hatch)', async () => {
      const { logger, configureLogger } = await import('@/utils/logger');
      configureLogger({ logLevel: 'silent', environment: 'production' });

      logger.error('This must not surface');
      logger.fatal('This must not surface either');

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    test('error() emits in development too (not just production)', async () => {
      const { logger, configureLogger } = await import('@/utils/logger');
      configureLogger({ logLevel: 'info', environment: 'development' });

      logger.error('Dev error path');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('info() / debug() keep production noise control', () => {
    test('info() does NOT write to console in production (enableConsole=false)', async () => {
      const { logger, configureLogger } = await import('@/utils/logger');
      configureLogger({ logLevel: 'info', environment: 'production' });

      logger.info('Routine operation');

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    test('info() DOES write to console in development (enableConsole=true)', async () => {
      const { logger, configureLogger } = await import('@/utils/logger');
      configureLogger({ logLevel: 'info', environment: 'development' });

      logger.info('Routine operation');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    });

    test('debug() is suppressed when log level = info (level filtering)', async () => {
      const { logger, configureLogger } = await import('@/utils/logger');
      configureLogger({ logLevel: 'info', environment: 'development' });

      logger.debug('Diagnostic detail');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    test('debug() emits when log level = debug', async () => {
      const { logger, configureLogger } = await import('@/utils/logger');
      configureLogger({ logLevel: 'debug', environment: 'production' });

      logger.debug('Diagnostic detail');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    });

    test('warn() keeps existing behaviour (gated by enableConsole in production)', async () => {
      const { logger, configureLogger } = await import('@/utils/logger');
      configureLogger({ logLevel: 'info', environment: 'production' });

      logger.warn('Possible issue');

      // warn remains gated — we explicitly decided not to change warn behaviour
      // when fixing error/fatal. This test exists so a future change here is
      // a deliberate decision, not an accident.
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });
});
