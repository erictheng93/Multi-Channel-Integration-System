/**
 * Role Constants
 *
 * Centralized role definitions for the entire system.
 * These constants should be used throughout the codebase instead of hardcoded strings.
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
 * Note: 'team' role has been deprecated but kept for backward compatibility
 */
export const ROLES = {
  /** Administrator role - full system access */
  ADMIN: 'admin',

  /** Agent role - can handle conversations within assigned teams */
  AGENT: 'agent',

  /** @deprecated Team role - kept for backward compatibility, use AGENT instead */
  TEAM: 'team'
} as const;

/**
 * Type-safe role type derived from ROLES constant
 *
 * Usage:
 * ```typescript
 * import { ROLES, type Role } from '@/constants/roles';
 *
 * function checkPermission(userRole: Role) {
 *   if (userRole === ROLES.ADMIN) {
 *     // Admin-specific logic
 *   }
 * }
 * ```
 */
export type Role = typeof ROLES[keyof typeof ROLES];

/**
 * Array of all valid role values
 * Useful for validation and dropdown generation
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
  [ROLES.ADMIN]: 'Administrator',
  [ROLES.AGENT]: 'Agent',
  [ROLES.TEAM]: 'Team Member (Deprecated)'
};

/**
 * Role descriptions for help text
 */
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  [ROLES.ADMIN]: 'Full system access with ability to manage teams, agents, and all resources',
  [ROLES.AGENT]: 'Can handle customer conversations and manage assigned resources within teams',
  [ROLES.TEAM]: 'Deprecated role - please use Agent role instead'
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
