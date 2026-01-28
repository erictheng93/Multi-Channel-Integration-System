/**
 * Role Constants (Frontend)
 *
 * Frontend mirror of backend role constants.
 * Must be kept in sync with src/constants/roles.ts
 *
 * @module constants/roles
 */

/**
 * System roles enum
 *
 * The system uses a simplified 2-tier role hierarchy:
 * - ADMIN: Full system access, can manage teams and all resources
 * - AGENT: Can handle conversations and customer interactions within assigned teams
 *
 * Team-specific permissions are controlled by team roles (Member/Lead/Supervisor).
 */
export const ROLES = {
  /** Administrator role - full system access */
  ADMIN: 'admin',

  /** Agent role - can handle conversations within assigned teams */
  AGENT: 'agent'
} as const;

/**
 * Type-safe role type
 */
export type Role = typeof ROLES[keyof typeof ROLES];

/**
 * Array of all valid role values
 */
export const ROLE_VALUES = Object.values(ROLES) as Role[];

/**
 * Array of active roles (excluding deprecated ones)
 */
export const ACTIVE_ROLES = [ROLES.ADMIN, ROLES.AGENT] as const;

/**
 * Role display names for UI
 */
export const ROLE_LABELS: Record<Role, string> = {
  [ROLES.ADMIN]: '管理員',
  [ROLES.AGENT]: '客服'
};

/**
 * Role descriptions for help text
 */
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  [ROLES.ADMIN]: '完整系統權限，可管理團隊、客服和所有資源',
  [ROLES.AGENT]: '可處理客戶對話並管理團隊內的指派資源'
};

/**
 * Check if a string is a valid role
 */
export function isValidRole(role: string): role is Role {
  return ROLE_VALUES.includes(role as Role);
}

/**
 * Check if a role is an active (non-deprecated) role
 */
export function isActiveRole(role: Role): boolean {
  return ACTIVE_ROLES.includes(role as typeof ACTIVE_ROLES[number]);
}

/**
 * Get role display label
 */
export function getRoleLabel(role: Role): string {
  return ROLE_LABELS[role] || role;
}

/**
 * Get role description
 */
export function getRoleDescription(role: Role): string {
  return ROLE_DESCRIPTIONS[role] || '';
}
