// Drizzle 轉換工具
// Database converters and utilities

import type { agents, teams } from '@shared/database/schema';

export type Agent = typeof agents.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type NewTeam = typeof teams.$inferInsert;

/**
 * 將資料庫查詢結果轉換為 API 回應格式
 */
export function convertAgent(agentRow: Agent): Omit<Agent, 'passwordHash'> {
  const { passwordHash, ...agentData } = agentRow;
  return agentData;
}

/**
 * 將 Team 資料庫結果轉換為 API 格式
 */
export function convertTeam(teamRow: Team): Team {
  return teamRow;
}

/**
 * 安全地轉換用戶資訊，移除敏感欄位
 */
export function safeUserInfo(agent: Agent): {
  id: string;
  email: string;
  displayName: string;
  role: string;
  // teamId REMOVED — use agent_teams table for team membership
  isActive: boolean | null;
  lastActive: string | null;
  createdAt: string | null;
} {
  return {
    id: agent.id,
    email: agent.email,
    displayName: agent.displayName,
    role: agent.role,
    isActive: agent.isActive,
    lastActive: agent.lastActive,
    createdAt: agent.createdAt
  };
}

/**
 * 將日期字串轉換為 ISO 格式
 */
export function convertToISOString(dateString: string | null): string | null {
  if (!dateString) return null;
  try {
    return new Date(dateString).toISOString();
  } catch {
    return dateString;
  }
}

/**
 * 檢查資料庫記錄是否存在且啟用
 */
export function isActiveRecord<T extends { isActive?: boolean | null }>(record: T | null): record is T {
  return record !== null && record.isActive !== false;
}