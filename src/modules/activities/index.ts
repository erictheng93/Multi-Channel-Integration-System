// Activities Module - Main Export File
// 活動模組 - 主要匯出檔案

// Core Services
import { ActivityService } from '@modules/activities/services/ActivityService'
import { TeamActivityService } from '@modules/activities/services/TeamActivityService'
import { ActivityStatsService } from '@modules/activities/services/ActivityStatsService'

// Handlers
import { ActivityHandler, createActivityHandler, activityHandler } from '@modules/activities/handlers/ActivityHandler'

// Types and Interfaces
export * from './types/interfaces'

// Constants
import { ACTIVITY_ACTIONS } from '@modules/activities/constants/actions'
import { RESOURCE_TYPES } from '@modules/activities/constants/resources'
export type { ActivityAction } from './constants/actions'
export type { ResourceType } from './constants/resources'

// Utilities
import { ActivityValidator } from '@modules/activities/utils/validators'
import { ActivityFormatter } from '@modules/activities/utils/formatters'
export type { ValidationError } from './utils/validators'

// Export everything
export {
  ActivityService,
  TeamActivityService,
  ActivityStatsService,
  ActivityHandler,
  createActivityHandler,
  activityHandler,
  ACTIVITY_ACTIONS,
  RESOURCE_TYPES,
  ActivityValidator,
  ActivityFormatter
}

// Re-export for backward compatibility
export {
  ACTIVITY_ACTIONS as ActivityActions,
  RESOURCE_TYPES as ResourceTypes
}

// Module metadata
export const ACTIVITIES_MODULE_VERSION = '1.0.0'
export const ACTIVITIES_MODULE_NAME = 'activities'

// Default export for the entire module
export default {
  // Services
  ActivityService,
  TeamActivityService,
  ActivityStatsService,

  // Handlers
  ActivityHandler,
  createActivityHandler,
  activityHandler,

  // Constants
  ACTIVITY_ACTIONS,
  RESOURCE_TYPES,

  // Utilities
  ActivityValidator,
  ActivityFormatter,

  // Metadata
  VERSION: ACTIVITIES_MODULE_VERSION,
  NAME: ACTIVITIES_MODULE_NAME
}