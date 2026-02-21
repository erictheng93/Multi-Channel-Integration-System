// Agent Status Service - 客服代理狀態管理服務
// Agent Status Management Service

import type {
  AgentStatus,
  AgentStatusType,
  UpdateStatusRequest
} from '../types/agent-types';
import { nowISO } from '@/utils/timestamp'
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('AgentStatusService');

export class AgentStatusService {
  constructor(private kv: KVNamespace) {}

  // 更新代理狀態
  async updateStatus(agentId: string, statusRequest: UpdateStatusRequest): Promise<AgentStatus> {
    try {
      const newStatus: AgentStatus = {
        status: statusRequest.status,
        since: nowISO(),
        availableUntil: statusRequest.availableUntil || null,
        note: statusRequest.note || null
      };

      // 儲存到 KV
      await this.kv.put(`agent:${agentId}:status`, JSON.stringify(newStatus));

      // 記錄狀態變更歷史
      await this.recordStatusChange(agentId, newStatus);

      return newStatus;
    } catch (error) {
      throw new Error(`Failed to update agent status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 獲取代理狀態
  async getAgentStatus(agentId: string): Promise<AgentStatus | null> {
    try {
      const statusData = await this.kv.get(`agent:${agentId}:status`);

      if (!statusData) {
        // 預設狀態
        return {
          status: 'offline',
          since: nowISO(),
          availableUntil: null,
          note: null
        };
      }

      const status: AgentStatus = JSON.parse(statusData);

      // 檢查是否超過可用時間
      if (status.availableUntil && new Date(status.availableUntil) < new Date()) {
        // 自動設為離線
        const expiredStatus = await this.updateStatus(agentId, {
          status: 'offline',
          note: 'Auto-expired'
        });
        return expiredStatus;
      }

      return status;
    } catch (error) {
      throw new Error(`Failed to get agent status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 批次獲取多個代理的狀態
  async getBatchAgentStatus(agentIds: string[]): Promise<Record<string, AgentStatus | null>> {
    try {
      const statusPromises = agentIds.map(async (agentId) => ({
        agentId,
        status: await this.getAgentStatus(agentId)
      }));

      const results = await Promise.all(statusPromises);

      return results.reduce((acc, { agentId, status }) => {
        acc[agentId] = status;
        return acc;
      }, {} as Record<string, AgentStatus | null>);
    } catch (error) {
      throw new Error(`Failed to get batch agent status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 設定代理為線上
  async setOnline(agentId: string, availableUntil?: string, note?: string): Promise<AgentStatus> {
    return this.updateStatus(agentId, {
      status: 'online',
      availableUntil,
      note
    });
  }

  // 設定代理為忙碌
  async setBusy(agentId: string, note?: string): Promise<AgentStatus> {
    return this.updateStatus(agentId, {
      status: 'busy',
      note: note || 'Handling conversations'
    });
  }

  // 設定代理為暫離
  async setAway(agentId: string, availableUntil?: string, note?: string): Promise<AgentStatus> {
    return this.updateStatus(agentId, {
      status: 'away',
      availableUntil,
      note: note || 'Temporarily away'
    });
  }

  // 設定代理為離線
  async setOffline(agentId: string, note?: string): Promise<AgentStatus> {
    return this.updateStatus(agentId, {
      status: 'offline',
      note
    });
  }

  // 設定代理為休息中
  async setOnBreak(agentId: string, availableUntil?: string, note?: string): Promise<AgentStatus> {
    return this.updateStatus(agentId, {
      status: 'break',
      availableUntil,
      note: note || 'On break'
    });
  }

  // 設定代理為開會中
  async setInMeeting(agentId: string, availableUntil?: string, note?: string): Promise<AgentStatus> {
    return this.updateStatus(agentId, {
      status: 'meeting',
      availableUntil,
      note: note || 'In meeting'
    });
  }

  // 檢查代理是否可用
  async isAgentAvailable(agentId: string): Promise<boolean> {
    try {
      const status = await this.getAgentStatus(agentId);
      return status?.status === 'online';
    } catch (error) {
      return false;
    }
  }

  // 獲取所有線上代理
  async getOnlineAgents(agentIds: string[]): Promise<string[]> {
    try {
      const batchStatus = await this.getBatchAgentStatus(agentIds);

      return agentIds.filter(agentId => {
        const status = batchStatus[agentId];
        return status?.status === 'online';
      });
    } catch (error) {
      throw new Error(`Failed to get online agents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 獲取可用代理（線上且不忙碌）
  async getAvailableAgents(agentIds: string[]): Promise<string[]> {
    try {
      const batchStatus = await this.getBatchAgentStatus(agentIds);

      return agentIds.filter(agentId => {
        const status = batchStatus[agentId];
        return status?.status === 'online';
      });
    } catch (error) {
      throw new Error(`Failed to get available agents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 記錄狀態變更歷史
  private async recordStatusChange(agentId: string, status: AgentStatus): Promise<void> {
    try {
      const historyKey = `agent:${agentId}:status_history`;
      const existingHistoryData = await this.kv.get(historyKey);

      let history: Array<AgentStatus & { recordedAt: string }> = [];
      if (existingHistoryData) {
        history = JSON.parse(existingHistoryData);
      }

      // 加入新紀錄
      history.unshift({
        ...status,
        recordedAt: nowISO()
      });

      // 保留最近 100 筆記錄
      if (history.length > 100) {
        history = history.slice(0, 100);
      }

      await this.kv.put(historyKey, JSON.stringify(history));
    } catch (error) {
      // 記錄失敗不影響主要功能
      log.error(`Failed to record status change for agent ${agentId}`, { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  // 獲取狀態變更歷史
  async getStatusHistory(agentId: string, limit: number = 20): Promise<Array<AgentStatus & { recordedAt: string }>> {
    try {
      const historyKey = `agent:${agentId}:status_history`;
      const historyData = await this.kv.get(historyKey);

      if (!historyData) {
        return [];
      }

      const history: Array<AgentStatus & { recordedAt: string }> = JSON.parse(historyData);
      return history.slice(0, limit);
    } catch (error) {
      throw new Error(`Failed to get status history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 清理過期狀態
  async cleanupExpiredStatuses(agentIds: string[]): Promise<number> {
    try {
      let cleanupCount = 0;

      for (const agentId of agentIds) {
        const status = await this.getAgentStatus(agentId);
        if (status?.availableUntil && new Date(status.availableUntil) < new Date()) {
          await this.setOffline(agentId, 'Auto cleanup - expired');
          cleanupCount++;
        }
      }

      return cleanupCount;
    } catch (error) {
      throw new Error(`Failed to cleanup expired statuses: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 獲取狀態統計
  async getStatusStatistics(agentIds: string[]): Promise<Record<AgentStatusType, number>> {
    try {
      const batchStatus = await this.getBatchAgentStatus(agentIds);

      const statistics: Record<AgentStatusType, number> = {
        online: 0,
        busy: 0,
        away: 0,
        offline: 0,
        break: 0,
        meeting: 0
      };

      Object.values(batchStatus).forEach(status => {
        if (status) {
          statistics[status.status]++;
        } else {
          statistics.offline++;
        }
      });

      return statistics;
    } catch (error) {
      throw new Error(`Failed to get status statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}