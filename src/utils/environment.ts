/**
 * Environment Validation and Configuration Utilities
 */
import { DEVELOPMENT_ORIGINS } from '@/config/development-origins';

export interface EnvironmentConfig {
  nodeEnv: string;
  environment: string;
  isDevelopment: boolean;
  isProduction: boolean;
  isTest: boolean;
}

/**
 * Required environment variables for production
 */
const REQUIRED_PRODUCTION_VARS = [
  'JWT_SECRET',
  'LINE_CHANNEL_ACCESS_TOKEN',
  'LINE_CHANNEL_SECRET',
] as const;

function getEnvString(env: Record<string, unknown>, key: string, fallback = ''): string {
  const value = env[key];
  return typeof value === 'string' ? value : fallback;
}

/**
 * Optional environment variables with defaults
 */
// const OPTIONAL_VARS = { // Reserved for future environment validation
// NODE_ENV: 'production',
// ENVIRONMENT: 'production',
// R2_PUBLIC_URL: '',
// FACEBOOK_PAGE_ACCESS_TOKEN: '',
// FACEBOOK_APP_SECRET: '',
// } as const;

/**
 * Validate environment configuration
 */
export function validateEnvironment(env: Record<string, unknown>): {
  isValid: boolean;
  missing: string[];
  warnings: string[];
  config: EnvironmentConfig;
} {
  const missing: string[] = [];
  const warnings: string[] = [];

  const nodeEnv = getEnvString(env, 'NODE_ENV', 'production');
  const environment = getEnvString(env, 'ENVIRONMENT', nodeEnv);
  const isDevelopment = nodeEnv === 'development' || environment === 'development';
  const isProduction = nodeEnv === 'production' || environment === 'production';
  const isTest = nodeEnv === 'test' || environment === 'test';

  // Check required variables for production
  if (isProduction) {
    for (const varName of REQUIRED_PRODUCTION_VARS) {
      if (getEnvString(env, varName).trim() === '') {
        missing.push(varName);
      }
    }

    // Check for weak JWT secrets
    const jwtSecret = getEnvString(env, 'JWT_SECRET');
    if (jwtSecret && jwtSecret.length < 32) {
      warnings.push('JWT_SECRET should be at least 32 characters long for production');
    }

    // Check for default/example values
    if (jwtSecret === 'your-super-secret-jwt-key-here') {
      missing.push('JWT_SECRET (using example value)');
    }

    if (getEnvString(env, 'LINE_CHANNEL_SECRET') === 'your-line-channel-secret') {
      missing.push('LINE_CHANNEL_SECRET (using example value)');
    }
  }

  // Security warnings
  if (isDevelopment) {
    warnings.push('Running in development mode - debug endpoints may be enabled');
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
    config: {
      nodeEnv,
      environment,
      isDevelopment,
      isProduction,
      isTest,
    },
  };
}

/**
 * Get sanitized environment info for logging
 */
export function getSanitizedEnvInfo(env: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['secret', 'key', 'token', 'password'];
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(env)) {
    const isSensitive = sensitiveKeys.some(sensitive =>
      key.toLowerCase().includes(sensitive)
    );

    if (isSensitive) {
      result[key] = value ? '[SET]' : '[NOT_SET]';
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Initialize and validate environment on startup
 */
export function initializeEnvironment(env: Record<string, unknown>): void {
  const validation = validateEnvironment(env);

  if (!validation.isValid) {
    console.error(' Environment validation failed:');
    console.error('Missing required variables:', validation.missing);
    throw new Error(`Missing required environment variables: ${validation.missing.join(', ')}`);
  }

  if (validation.warnings.length > 0) {
    console.warn(' Environment warnings:');
    validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }

  console.log(' Environment validation passed');
  console.log(' Environment info:', getSanitizedEnvInfo(env));
}

/**
 * Check if debug features should be enabled
 */
export function isDebugEnabled(env: Record<string, unknown>): boolean {
  const validation = validateEnvironment(env);
  return validation.config.isDevelopment || env.ENABLE_DEBUG === 'true';
}

/**
 * Get CORS origins based on environment
 */
export function getCorsOrigins(env: Record<string, unknown>): string[] {
  const validation = validateEnvironment(env);

  if (validation.config.isDevelopment) {
    return [...DEVELOPMENT_ORIGINS];
  }

  // Production origins - 從環境變量讀取
  const origins: string[] = [];

  // 添加配置的 URLs
  const frontendUrl = getEnvString(env, 'FRONTEND_URL');
  if (frontendUrl) {
    origins.push(frontendUrl);
  }
  const backendUrl = getEnvString(env, 'BACKEND_URL');
  if (backendUrl) {
    origins.push(backendUrl);
  }

  // Add custom origins if specified
  const corsOrigins = getEnvString(env, 'CORS_ORIGINS');
  if (corsOrigins) {
    const customOrigins = corsOrigins.split(',').map((origin) => origin.trim());
    origins.push(...customOrigins);
  }

  return origins;
}

/**
 * Security middleware factory
 */
export function createSecurityConfig(env: Record<string, unknown>) {
  const validation = validateEnvironment(env);

  return {
    environment: validation.config,
    cors: {
      origins: getCorsOrigins(env),
      credentials: true,
    },
    debug: {
      enabled: isDebugEnabled(env),
      requireAuth: true,
    },
    rateLimit: {
      enabled: validation.config.isProduction,
      windowMs: 60 * 1000, // 1 minute
      maxRequests: validation.config.isProduction ? 100 : 1000,
    },
  };
}
