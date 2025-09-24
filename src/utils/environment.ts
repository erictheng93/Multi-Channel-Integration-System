/**
 * Environment Validation and Configuration Utilities
 */

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

/**
 * Optional environment variables with defaults
 */
// const OPTIONAL_VARS = { // Reserved for future environment validation
//   NODE_ENV: 'production',
//   ENVIRONMENT: 'production',
//   R2_PUBLIC_URL: '',
//   FACEBOOK_PAGE_ACCESS_TOKEN: '',
//   FACEBOOK_APP_SECRET: '',
// } as const;

/**
 * Validate environment configuration
 */
export function validateEnvironment(env: Record<string, any>): {
  isValid: boolean;
  missing: string[];
  warnings: string[];
  config: EnvironmentConfig;
} {
  const missing: string[] = [];
  const warnings: string[] = [];

  const nodeEnv = env.NODE_ENV || 'production';
  const environment = env.ENVIRONMENT || nodeEnv;
  const isDevelopment = nodeEnv === 'development' || environment === 'development';
  const isProduction = nodeEnv === 'production' || environment === 'production';
  const isTest = nodeEnv === 'test' || environment === 'test';

  // Check required variables for production
  if (isProduction) {
    for (const varName of REQUIRED_PRODUCTION_VARS) {
      if (!env[varName] || env[varName].trim() === '') {
        missing.push(varName);
      }
    }

    // Check for weak JWT secrets
    if (env.JWT_SECRET && env.JWT_SECRET.length < 32) {
      warnings.push('JWT_SECRET should be at least 32 characters long for production');
    }

    // Check for default/example values
    if (env.JWT_SECRET === 'your-super-secret-jwt-key-here') {
      missing.push('JWT_SECRET (using example value)');
    }

    if (env.LINE_CHANNEL_SECRET === 'your-line-channel-secret') {
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
export function getSanitizedEnvInfo(env: Record<string, any>): Record<string, any> {
  const sensitiveKeys = ['secret', 'key', 'token', 'password'];
  const result: Record<string, any> = {};

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
export function initializeEnvironment(env: Record<string, any>): void {
  const validation = validateEnvironment(env);

  if (!validation.isValid) {
    console.error('❌ Environment validation failed:');
    console.error('Missing required variables:', validation.missing);
    throw new Error(`Missing required environment variables: ${validation.missing.join(', ')}`);
  }

  if (validation.warnings.length > 0) {
    console.warn('⚠️ Environment warnings:');
    validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }

  console.log('✅ Environment validation passed');
  console.log('📊 Environment info:', getSanitizedEnvInfo(env));
}

/**
 * Check if debug features should be enabled
 */
export function isDebugEnabled(env: Record<string, any>): boolean {
  const validation = validateEnvironment(env);
  return validation.config.isDevelopment || env.ENABLE_DEBUG === 'true';
}

/**
 * Get CORS origins based on environment
 */
export function getCorsOrigins(env: Record<string, any>): string[] {
  const validation = validateEnvironment(env);

  if (validation.config.isDevelopment) {
    return [
      'http://localhost:3000',
      'https://localhost:3000',
      'http://localhost:8787',
      'http://127.0.0.1:3000',
      'https://127.0.0.1:3000',
    ];
  }

  // Production origins
  const origins = ['https://multi-channel.imfinethankyouandyou.com'];

  // Add custom origins if specified
  if (env.CORS_ORIGINS) {
    const customOrigins = env.CORS_ORIGINS.split(',').map((origin: string) => origin.trim());
    origins.push(...customOrigins);
  }

  return origins;
}

/**
 * Security middleware factory
 */
export function createSecurityConfig(env: Record<string, any>) {
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