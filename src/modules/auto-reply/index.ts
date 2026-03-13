// src/modules/auto-reply/index.ts
// Auto-Reply module barrel export

// Handlers
export { autoReplyRulesHandler, autoReplySchedulesHandler, autoReplyLogsHandler } from './handlers';

// Services
export { evaluate, evaluateWelcome, invalidateRulesCache } from './services';
export { matchConditions } from './services';
export { isWithinBusinessHours, invalidateScheduleCache } from './services';

// Types
export type * from './types';
