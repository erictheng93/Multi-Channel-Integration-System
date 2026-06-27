// ============================================================================
// AUTH Module - 認證模組
// 處理使用者認證、授權和會話管理的核心模組
// ============================================================================

// ======================== 類型導出 ========================
export type * from './types/auth-types';

// ======================== 服務導出 ========================
export * from './services/auth';

// ======================== 處理器導出 ========================
// Active handler: auth-main.ts (registered via src/handlers/index.ts)

// ======================== 中間件導出 ========================
export * from './middleware/auth';

// ======================== 工具函數導出 ========================
// 如有需要，未來可擴展

// ======================== 常數導出 ========================
// 如有需要，未來可擴展

// ======================== 模組配置 ========================
export interface AuthModuleConfig {
  jwtSecret: string;
  tokenExpiry: number;
  refreshTokenExpiry: number;
  bcryptRounds: number;
  maxLoginAttempts: number;
  lockoutDuration: number;
}

export const DEFAULT_AUTH_MODULE_CONFIG: Omit<AuthModuleConfig, 'jwtSecret'> = {
  tokenExpiry: 3600, // 1 hour
  refreshTokenExpiry: 604800, // 7 days
  bcryptRounds: 12,
  maxLoginAttempts: 5,
  lockoutDuration: 900 // 15 minutes
};

// ======================== 模組資訊 ========================
export const MODULE_INFO = {
  name: 'auth',
  version: '1.0.0',
  description: '認證與授權管理模組',

  features: [
    'JWT 認證',
    '使用者登入登出',
    '密碼加密驗證',
    '會話管理',
    '角色權限控制',
    '登入嘗試限制'
  ],

  endpoints: {
    total: 8,
    implemented: 8,
    pending: 0,
    categories: {
      auth: 4, // login, logout, refresh, verify
      user: 2, // profile, update
      admin: 2 // user management
    }
  },

  permissions: {
    admin: {
      description: '完整認證系統管理權限',
      actions: ['manage_users', 'view_auth_logs', 'reset_passwords']
    },
    team: {
      description: '團隊內認證管理權限',
      actions: ['view_team_users', 'update_team_profiles']
    },
    agent: {
      description: '基本認證權限',
      actions: ['login', 'logout', 'update_profile']
    }
  },

  technical: {
    database: ['users', 'user_sessions', 'login_attempts'],
    cache: ['jwt_tokens', 'user_sessions'],
    dependencies: ['shared/database', 'shared/utils', '@hono/jwt'],
    middleware: ['auth', 'role-validation']
  },

  status: {
    development: 'completed' as const,
    testing: 'completed' as const,
    deployment: 'completed' as const,
    integration: 'completed' as const
  }
} as const;

import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('AuthModule');

const INSECURE_JWT_SECRETS = new Set(['default-secret', 'your-super-secret-jwt-key-here']);

function validateJwtSecret(jwtSecret: string | undefined): string {
  if (!jwtSecret || jwtSecret.trim() === '') {
    log.error(
      'initializeAuthModule called without a JWT secret. Refusing to initialize the auth module with an empty signing key.'
    );
    throw new Error('JWT_SECRET is required to initialize the auth module.');
  }

  const secret = jwtSecret.trim();

  if (INSECURE_JWT_SECRETS.has(secret)) {
    log.error(
      'initializeAuthModule called with a default or example JWT secret. Refusing to initialize the auth module with a predictable signing key.'
    );
    throw new Error('JWT_SECRET must not use a default or example value.');
  }

  if (secret.length < 32) {
    log.error(
      'initializeAuthModule called with a weak JWT secret. Refusing to initialize the auth module with a short signing key.'
    );
    throw new Error('JWT_SECRET must be at least 32 characters long.');
  }

  return secret;
}

// ======================== 初始化函數 ========================
export function initializeAuthModule(config: Partial<AuthModuleConfig> = {}) {
  const jwtSecret = validateJwtSecret(config.jwtSecret);

  const finalConfig: AuthModuleConfig = {
    ...DEFAULT_AUTH_MODULE_CONFIG,
    ...config,
    jwtSecret
  };

  return {
    config: finalConfig,
    moduleInfo: MODULE_INFO
  };
}

// ======================== 向後兼容 ========================
// Legacy exports for backward compatibility
export const AUTH_MODULE_CONFIG = {
  name: 'authentication',
  version: '1.0.0',
  dependencies: ['shared/database', 'shared/utils']
} as const;
