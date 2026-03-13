// src/modules/auto-reply/services/index.ts
// Auto-Reply Services barrel export

export { evaluate, evaluateWelcome, invalidateRulesCache } from './auto-reply-engine';
export { matchConditions } from './condition-matcher';
export { isWithinBusinessHours, invalidateScheduleCache } from './schedule-service';
export { executeActions } from './action-executor';
export type { ActionExecuteResult } from './action-executor';
