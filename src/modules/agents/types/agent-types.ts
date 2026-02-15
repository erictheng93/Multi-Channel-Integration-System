// Agents Module Types
// Agent 模組類型定義

// Database schema types
import type { agents } from '@/db/schema';

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;

// Agent 詳細資料介面 (包含統計和擴展資訊)
export interface AgentWithDetails extends Agent {
  primaryTeamId?: number | null;  // From agent_teams WHERE isPrimary=true
  teamName?: string | null;
  skills?: AgentSkill[];
  workloadStats?: AgentWorkloadStats;
  performanceStats?: AgentPerformanceStats;
  currentStatus?: AgentStatus;
}

// Agent 技能系統
export interface AgentSkill {
  id: string;
  name: string;
  category: SkillCategory;
  level: SkillLevel;
  certified?: boolean;
  certifiedAt?: string | null;
  description?: string;
}

export type SkillCategory =
  | 'communication'     // 溝通技巧
  | 'technical'         // 技術能力
  | 'product'           // 產品知識
  | 'language'          // 語言能力
  | 'platform'          // 平台專精
  | 'soft_skill';       // 軟技能

export type SkillLevel =
  | 'beginner'          // 初級
  | 'intermediate'      // 中級
  | 'advanced'          // 高級
  | 'expert';           // 專家

// Agent 工作狀態
export interface AgentStatus {
  status: AgentStatusType;
  since: string;
  availableUntil?: string | null;
  note?: string | null;
}

export type AgentStatusType =
  | 'online'            // 線上
  | 'busy'              // 忙碌
  | 'away'              // 暫離
  | 'offline'           // 離線
  | 'break'             // 休息中
  | 'meeting';          // 開會中

// Agent 工作負載統計
export interface AgentWorkloadStats {
  activeConversations: number;
  totalConversations: number;
  averageResponseTime: number; // 秒
  messagesHandled: number;
  satisfactionScore?: number;
  period: {
    from: string;
    to: string;
  };
}

// Agent 績效統計
export interface AgentPerformanceStats {
  conversationsCompleted: number;
  avgConversationDuration: number; // 分鐘
  customerSatisfactionRate: number; // 百分比
  firstResponseTime: number; // 秒
  resolutionRate: number; // 百分比
  escalationRate: number; // 百分比
  period: {
    from: string;
    to: string;
  };
}

// API Request/Response 類型
export interface AgentListRequest {
  page?: number;
  limit?: number;
  includeInactive?: boolean;
  search?: string;
  teamId?: number;
  role?: string;
  status?: AgentStatusType;
  skills?: string[];
}

export interface AgentListResponse {
  agents: AgentWithDetails[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Agent CRUD 操作類型
export interface CreateAgentRequest {
  email: string;
  displayName: string;
  role?: 'admin' | 'team' | 'agent';
  teamId?: number; // Creates agent_teams membership (not stored on agents table)
  passwordHash?: string; // 通常由系統生成
  skills?: Omit<AgentSkill, 'id'>[];
  isActive?: boolean;
}

export interface UpdateAgentRequest {
  displayName?: string;
  email?: string;
  role?: 'admin' | 'team' | 'agent';
  teamId?: number; // Updates agent_teams membership (not stored on agents table)
  isActive?: boolean;
  passwordPolicy?: string;
}

// Agent 技能管理類型
export interface AddSkillRequest {
  name: string;
  category: SkillCategory;
  level: SkillLevel;
  description?: string;
  certified?: boolean;
}

export interface UpdateSkillRequest {
  level?: SkillLevel;
  description?: string;
  certified?: boolean;
}

// Agent 狀態管理類型
export interface UpdateStatusRequest {
  status: AgentStatusType;
  availableUntil?: string;
  note?: string;
}

// Agent 工作分配類型
export interface AssignConversationRequest {
  conversationId: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  skillsRequired?: string[];
  estimatedDuration?: number; // 分鐘
}

// Agent 搜尋和過濾類型
export interface AgentSearchQuery {
  keyword?: string;
  teamIds?: number[];
  roles?: string[];
  skills?: string[];
  status?: AgentStatusType[];
  lastActiveAfter?: string;
  lastActiveBefore?: string;
  joinedAfter?: string;
  joinedBefore?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

// Agent 批次操作類型
export interface BatchUpdateAgentsRequest {
  agentIds: string[];
  updates: Partial<UpdateAgentRequest>;
}

export interface BatchTransferAgentsRequest {
  agentIds: string[];
  fromTeamId?: number;
  toTeamId: number;
  reason?: string;
}

// 錯誤處理類型
export class AgentNotFoundError extends Error {
  constructor(agentId: string) {
    super(`Agent not found: ${agentId}`);
    this.name = 'AgentNotFoundError';
  }
}

export class AgentAlreadyExistsError extends Error {
  constructor(email: string) {
    super(`Agent with email already exists: ${email}`);
    this.name = 'AgentAlreadyExistsError';
  }
}

export class InvalidAgentDataError extends Error {
  public details?: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'InvalidAgentDataError';
    this.details = details;
  }
}

export class AgentPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentPermissionError';
  }
}

// 服務介面
export interface AgentServiceInterface {
  // CRUD 操作
  createAgent(data: CreateAgentRequest): Promise<Agent>;
  getAgent(id: string): Promise<AgentWithDetails | null>;
  updateAgent(id: string, data: UpdateAgentRequest): Promise<Agent>;
  deleteAgent(id: string): Promise<boolean>;

  // 列表和搜尋
  listAgents(params: AgentListRequest): Promise<AgentListResponse>;
  searchAgents(query: AgentSearchQuery): Promise<AgentWithDetails[]>;

  // 技能管理
  addSkill(agentId: string, skill: AddSkillRequest): Promise<AgentSkill>;
  updateSkill(agentId: string, skillId: string, updates: UpdateSkillRequest): Promise<AgentSkill>;
  removeSkill(agentId: string, skillId: string): Promise<boolean>;
  getAgentSkills(agentId: string): Promise<AgentSkill[]>;

  // 狀態管理
  updateStatus(agentId: string, status: UpdateStatusRequest): Promise<AgentStatus>;
  getAgentStatus(agentId: string): Promise<AgentStatus | null>;

  // 工作負載和績效
  getWorkloadStats(agentId: string, period?: { from: string; to: string }): Promise<AgentWorkloadStats>;
  getPerformanceStats(agentId: string, period?: { from: string; to: string }): Promise<AgentPerformanceStats>;

  // 批次操作
  batchUpdateAgents(request: BatchUpdateAgentsRequest): Promise<Agent[]>;
  batchTransferAgents(request: BatchTransferAgentsRequest): Promise<{ success: boolean; errors: any[] }>;
}

// 權限相關類型
export interface AgentPermissions {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageSkills: boolean;
  canViewStats: boolean;
  canAssignConversations: boolean;
  canChangeStatus: boolean;
  canManageTeam: boolean;
}

// 事件類型 (用於實時更新)
export interface AgentEvent {
  type: 'agent.created' | 'agent.updated' | 'agent.deleted' |
        'agent.status.changed' | 'agent.skill.added' | 'agent.skill.updated' |
        'agent.assigned' | 'agent.performance.updated';
  agentId: string;
  data: any;
  timestamp: string;
  userId?: string;
}

// 重新匯出共用類型
export type { Bindings } from '@/types';