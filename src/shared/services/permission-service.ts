/**
 * Re-export from main services to avoid version conflicts
 *
 * IMPORTANT: The system now uses a 2-tier role hierarchy (admin/agent)
 * The old 3-tier system (admin/team/agent) has been deprecated.
 *
 * @deprecated Import directly from '@/services/permission-service' for new code
 */
export { PermissionService } from '../../services/permission-service';

export type { Permission, Role } from '../../services/permission-service';
