// Lazy initialization for modular architecture, P1 optimizations, and collaboration
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
let collaborationInitialized = false;

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
  try {
    log.debug('Initializing P1 Optimizations');
    const { initializeP1Optimizations: init } = await import('../services/p1-optimizations');
    await init(env);
    log.debug('P1 Optimizations initialized successfully');
  } catch (error) {
    log.error('Failed to initialize P1 Optimizations', { error: error instanceof Error ? error.message : String(error) });
    // P1 optimization failure should not block system startup
  }
}

/**
 * Lazy-initialize Collaboration module (runs on first request)
 */
async function initializeCollaboration(env: Bindings): Promise<void> {
  if (collaborationInitialized) {
    return;
  }

  try {
    log.debug('Initializing Collaboration Module');

    // Initialize P1 optimizations first
    await initializeP1Optimizations(env);

    const { Collaboration } = await import('@modules/collaboration');

    const config = {
      defaultProtocol: 'websocket' as const,
      enableWebSocket: true,
      typingExpirationSeconds: 5,
      presenceExpirationSeconds: 300,
      cleanupIntervalSeconds: 60,
      maxViewersPerConversation: 50,
      persistEvents: false
    };

    await Collaboration.initialize(env, config);

    collaborationInitialized = true;

    log.info('Collaboration Module initialized', { protocol: 'WebSocket', environment: env.ENVIRONMENT || 'unknown' });
  } catch (error) {
    log.error('Failed to initialize Collaboration Module', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

/**
 * Creates middleware that lazy-initializes the modular system and collaboration
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

    // Initialize Collaboration module
    if (!collaborationInitialized) {
      try {
        await initializeCollaboration(c.env);
      } catch (error) {
        log.error('Collaboration module initialization failed (continuing anyway)', { error: error instanceof Error ? error.message : String(error) });
      }
    }

    await next();
  };
}

/**
 * Returns the error handling middleware from the core error-handler module.
 * Re-exported here for convenience so index.ts doesn't need a separate import.
 */
export { errorHandlingMiddleware };
