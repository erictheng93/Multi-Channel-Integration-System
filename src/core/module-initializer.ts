// Lazy initialization for modular architecture, and P1 optimizations
// Extracted from src/index.ts to reduce entry point size

import type { Context, Next } from 'hono';
import type { Bindings } from '../types';
import { createContextLogger } from '../utils/logger';
import { globalModularSystemManager } from './modular-system-integration';
import { errorHandlingMiddleware } from './error-handler';

const log = createContextLogger('ModuleInitializer');

// Module initialization state tracking
let modularSystemInitialized = false;
let modularSystemInitPromise: Promise<void> | null = null;
let p1Initialized = false;

/**
 * Lazy-initialize the modular architecture system (runs on first request)
 */
async function initializeModularSystem(): Promise<void> {
  if (modularSystemInitialized) {
    return;
  }

  if (modularSystemInitPromise) {
    return modularSystemInitPromise;
  }

  modularSystemInitPromise = (async () => {
    try {
      const initResult = await globalModularSystemManager.initialize();
      log.info(`Modular Architecture System initialized successfully:
   Modules: ${initResult.modules.discovered} discovered, ${initResult.modules.registered} registered
   Routes: ${initResult.routes.groups} groups, ${initResult.routes.modules} modules
   Health: ${initResult.health.status} (monitoring: ${initResult.health.monitoring})
   System: ${initResult.success ? 'Ready' : 'Partial'}`);

      if (initResult.warnings.length > 0) {
        log.warn('Modular system warnings', { warnings: initResult.warnings });
      }
      if (initResult.errors.length > 0) {
        log.error('Modular system errors', { errors: initResult.errors });
      }

      modularSystemInitialized = true;
    } catch (error) {
      log.error('Failed to initialize modular architecture system', { error: error instanceof Error ? error.message : String(error) });
      // Reset promise to allow retry
      modularSystemInitPromise = null;
      throw error;
    }
  })();

  return modularSystemInitPromise;
}

/**
 * Lazy-initialize P1 Optimizations (runs on first request)
 */
async function initializeP1Optimizations(env: Bindings): Promise<void> {
  if (p1Initialized) {
    return;
  }

  try {
    log.debug('Initializing P1 Optimizations');
    const { initializeP1Optimizations: init } = await import('../services/p1-optimizations');
    await init(env);
    p1Initialized = true;
    log.debug('P1 Optimizations initialized successfully');
  } catch (error) {
    log.error('Failed to initialize P1 Optimizations', { error: error instanceof Error ? error.message : String(error) });
    // P1 optimization failure should not block system startup
  }
}

/**
 * Creates middleware that lazy-initializes the modular system and P1 optimizations
 * on the first request. Subsequent requests skip initialization.
 */
export function createLazyInitMiddleware() {
  return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    if (!modularSystemInitialized) {
      try {
        await initializeModularSystem();
      } catch (error) {
        log.error('Modular system initialization failed (continuing anyway)', { error: error instanceof Error ? error.message : String(error) });
      }
    }

    await initializeP1Optimizations(c.env);

    await next();
  };
}

/**
 * Returns the error handling middleware from the core error-handler module.
 * Re-exported here for convenience so index.ts doesn't need a separate import.
 */
export { errorHandlingMiddleware };
