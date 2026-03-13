// src/modules/auto-reply/types/index.ts
// Auto-Reply System type definitions

// ==================== Trigger Types ====================

export type TriggerType = 'welcome' | 'keyword' | 'off_hours' | 'fallback';

export type ConditionType = 'exact' | 'contains' | 'regex' | 'message_type';

export type MatchMode = 'any' | 'all';

export type ActionType = 'reply_text' | 'reply_image' | 'reply_flex';

export type ReplyMethod = 'reply_api' | 'push_api';

export type Platform = 'line' | 'facebook';

// ==================== Rule & Condition Types ====================

export interface AutoReplyConditionData {
  id: number;
  ruleId: number;
  conditionType: ConditionType;
  value: string;
  caseSensitive: boolean;
  matchMode: MatchMode;
}

export interface AutoReplyActionData {
  id: number;
  ruleId: number;
  actionType: ActionType;
  content: string; // JSON string
  sortOrder: number;
}

export interface AutoReplyRuleWithRelations {
  id: number;
  teamId: number;
  name: string;
  triggerType: TriggerType;
  priority: number;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
  conditions: AutoReplyConditionData[];
  actions: AutoReplyActionData[];
}

// ==================== Engine Input/Output ====================

export interface AutoReplyEvaluateInput {
  message: {
    content: string;
    messageType: string;
    platform: Platform;
  };
  conversationId: string;
  teamId: number;
  replyToken: string | null;
  customerId: number;
  platformUserId: string;
}

export interface AutoReplyEvaluateResult {
  matched: boolean;
  ruleId?: number;
  ruleName?: string;
  replyMethod?: ReplyMethod;
  error?: string;
}

// ==================== Schedule Types ====================

export interface ScheduleData {
  id: number;
  teamId: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone: string;
  isActive: boolean;
}

// ==================== API Request/Response Types ====================

export interface CreateRuleRequest {
  name: string;
  triggerType: TriggerType;
  priority?: number;
  isActive?: boolean;
  conditions?: Array<{
    conditionType: ConditionType;
    value: string;
    caseSensitive?: boolean;
    matchMode?: MatchMode;
  }>;
  actions?: Array<{
    actionType: ActionType;
    content: string;
    sortOrder?: number;
  }>;
}

export interface UpdateRuleRequest {
  name?: string;
  triggerType?: TriggerType;
  priority?: number;
  isActive?: boolean;
  conditions?: Array<{
    conditionType: ConditionType;
    value: string;
    caseSensitive?: boolean;
    matchMode?: MatchMode;
  }>;
  actions?: Array<{
    actionType: ActionType;
    content: string;
    sortOrder?: number;
  }>;
}

export interface BulkUpsertScheduleRequest {
  timezone?: string;
  schedules: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive?: boolean;
  }>;
}

// ==================== Action Content Types ====================

export interface TextActionContent {
  text: string;
}

export interface ImageActionContent {
  url: string;
  previewUrl?: string;
}

// Flex content is raw LINE Flex Message JSON
export type FlexActionContent = Record<string, unknown>;
