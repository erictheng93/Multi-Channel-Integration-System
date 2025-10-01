// 活動記錄服務 - Legacy compatibility layer for modularized Activities
// This file provides backward compatibility for existing imports
import {
  ActivityService as ModularActivityService,
  ACTIVITY_ACTIONS,
  RESOURCE_TYPES
} from '../modules/activities';

// Re-export types from the modularized activities module
export type {
  ActivityLog,
  CreateActivityRequest,
  ActivityQueryParams,
  ActivityListResponse,
  UserActivityStats,
  ActivityOverview
} from '../modules/activities';

// Re-export the modularized ActivityService for backward compatibility
export { ActivityService } from '../modules/activities';

// Re-export constants
export { ACTIVITY_ACTIONS, RESOURCE_TYPES };