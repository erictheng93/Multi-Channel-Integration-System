/**
 * ============================================================================
 * Configuration Guard Middleware
 * ============================================================================
 *
 * Validates required environment variables are set before processing requests.
 * Provides clear error messages when configuration is missing.
 *
 * Design Philosophy:
 * - Fail-fast with helpful error messages instead of silent 403 errors
 * - Production deployments MUST configure FRONTEND_URL and BACKEND_URL
 * - Development environments have sensible defaults
 *
 * @see CLAUDE.md - Configuration Guard Pattern
 */

import type { Context, Next } from 'hono';
import type { Bindings } from '../types/bindings';
import { createContextLogger } from '../utils/logger';
import { nowISO } from '@/utils/timestamp'

const log = createContextLogger('ConfigGuard');

/**
 * Configuration validation result
 */
export interface ConfigurationValidationResult {
  configured: boolean;
  missing: string[];
  warnings: string[];
  environment: string;
}

/**
 * Required environment variables for production
 */
const REQUIRED_PRODUCTION_VARS = [
  'FRONTEND_URL',
  'BACKEND_URL',
] as const;

/**
 * Recommended environment variables (warning if missing)
 */
const RECOMMENDED_VARS = [
  'STORAGE_PUBLIC_URL',
] as const;

/**
 * Validates the configuration and returns detailed results
 */
export function validateConfiguration(env: Bindings): ConfigurationValidationResult {
  const environment = env.ENVIRONMENT || 'development';
  const missing: string[] = [];
  const warnings: string[] = [];

  // In production, FRONTEND_URL and BACKEND_URL are required
  if (environment === 'production') {
    for (const varName of REQUIRED_PRODUCTION_VARS) {
      if (!env[varName as keyof Bindings]) {
        missing.push(varName);
      }
    }
  }

  // Check recommended variables (warnings only)
  for (const varName of RECOMMENDED_VARS) {
    if (!env[varName as keyof Bindings]) {
      warnings.push(varName);
    }
  }

  return {
    configured: missing.length === 0,
    missing,
    warnings,
    environment,
  };
}

/**
 * Generates a helpful configuration error response
 */
export function generateConfigurationErrorResponse(
  validation: ConfigurationValidationResult,
  requestOrigin?: string
): {
  status: number;
  body: object;
  headers: Record<string, string>;
} {
  const errorResponse = {
    success: false,
    error: 'CONFIGURATION_INCOMPLETE',
    message: 'Required environment variables are not configured.',
    details: {
      environment: validation.environment,
      missingVariables: validation.missing,
      warnings: validation.warnings.length > 0 ? validation.warnings : undefined,
    },
    resolution: {
      steps: [
        '1. Go to Cloudflare Dashboard (https://dash.cloudflare.com)',
        '2. Navigate to: Workers & Pages -> Your Worker -> Settings -> Variables',
        '3. Add the following environment variables:',
        ...validation.missing.map(v => ` - ${v}`),
        '4. Click "Save and Deploy"',
      ],
      documentation: 'https://developers.cloudflare.com/workers/configuration/environment-variables/',
    },
    requestedOrigin: requestOrigin,
    timestamp: nowISO(),
  };

  return {
    status: 503, // Service Unavailable - indicates misconfiguration
    body: errorResponse,
    headers: {
      'Content-Type': 'application/json',
      'X-Configuration-Status': 'incomplete',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  };
}

/**
 * Configuration Guard Middleware
 *
 * Checks if required environment variables are configured.
 * In production, returns a helpful error if configuration is incomplete.
 *
 * @example
 * ```typescript
 * app.use('*', configurationGuardMiddleware);
 * ```
 */
export async function configurationGuardMiddleware(
  c: Context<{ Bindings: Bindings }>,
  next: Next
): Promise<Response | void> {
  const validation = validateConfiguration(c.env);

  // Log validation status
  if (!validation.configured) {
    log.error('Configuration incomplete', {
      missing: validation.missing,
      environment: validation.environment,
      path: c.req.path,
    });
  } else if (validation.warnings.length > 0) {
    log.warn('Configuration warnings', {
      warnings: validation.warnings,
      environment: validation.environment,
    });
  }

  // In production, block requests if configuration is incomplete
  // Exception: Allow health check and config-check endpoints
  if (!validation.configured && validation.environment === 'production') {
    const path = c.req.path;

    // Allow these paths even without configuration
    const allowedPaths = [
      '/api/system/health',
      '/api/system/config-check',
      '/api/websocket/health',
      '/api/websocket/liveness',
      '/api/websocket/readiness',
    ];

    if (!allowedPaths.some(p => path.startsWith(p))) {
      const origin = c.req.header('Origin');
      const errorResponse = generateConfigurationErrorResponse(validation, origin);

      // Set headers
      Object.entries(errorResponse.headers).forEach(([key, value]) => {
        c.header(key, value);
      });

      return c.json(errorResponse.body, errorResponse.status as 503);
    }
  }

  // Store validation result in context for other handlers to use
  c.set('configValidation' as never, validation as never);

  await next();
}

/**
 * Get configuration status for the config-check endpoint
 */
export function getConfigurationStatus(env: Bindings): object {
  const validation = validateConfiguration(env);

  // Build status for each variable
  const variableStatus: Record<string, { set: boolean; hint?: string }> = {};

  for (const varName of REQUIRED_PRODUCTION_VARS) {
    const value = env[varName as keyof Bindings];
    variableStatus[varName] = {
      set: !!value,
      hint: value ? `${String(value).substring(0, 30)}...` : 'Not set',
    };
  }

  for (const varName of RECOMMENDED_VARS) {
    const value = env[varName as keyof Bindings];
    variableStatus[varName] = {
      set: !!value,
      hint: value ? `${String(value).substring(0, 30)}...` : 'Not set (recommended)',
    };
  }

  return {
    success: validation.configured,
    status: validation.configured ? 'configured' : 'incomplete',
    environment: validation.environment,
    variables: variableStatus,
    missingRequired: validation.missing,
    missingRecommended: validation.warnings,
    corsOrigins: {
      configured: !!env.FRONTEND_URL,
      frontendUrl: env.FRONTEND_URL || null,
      backendUrl: env.BACKEND_URL || null,
    },
    resolution: !validation.configured ? {
      message: 'Please set the missing environment variables in Cloudflare Dashboard',
      steps: [
        'Go to Cloudflare Dashboard',
        'Navigate to Workers & Pages -> mcis-worker -> Settings -> Variables',
        'Add the missing variables listed above',
        'Save and Deploy',
      ],
    } : null,
    timestamp: nowISO(),
  };
}

export default configurationGuardMiddleware;
