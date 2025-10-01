// Agents Module - 客服代理模組主要匯出
// Agent Module Main Export

export * from './types/agent-types';
export * from './handlers/index';
export * from './services/index';
export * from './middleware/index';

// 重新匯出常用的類型和服務
export type {
  Agent,
  NewAgent,
  AgentWithDetails,
  AgentServiceInterface,
  AgentListRequest,
  AgentListResponse,
  CreateAgentRequest,
  UpdateAgentRequest
} from './types/agent-types';

// 主要處理器匯出
export { createAgentRouter } from './handlers/agent-main';
export { agentHandler } from './handlers/agent';

// 服務類別匯出
export { AgentService } from './services/agent-crud';
export { AgentSkillsService } from './services/agent-skills';
export { AgentStatusService } from './services/agent-status';

// 中介層匯出
export { agentAuthMiddleware } from './middleware/agent-auth';
export { agentValidationMiddleware } from './middleware/agent-validation';