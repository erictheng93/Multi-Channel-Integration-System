/**
 * Delayed Messages API Client (Durable Objects Version)
 * 延遲訊息 API 客戶端 - 使用 DO 實現即時撤銷
 */

import {
  delayedMessagesV2Contracts,
  type CancelDelayedMessageParams,
  type DelayedMessage,
  type MessageStatus,
  type PendingDelayedMessage,
  type SendDelayedMessageParams
} from '@shared/api-contracts'
import { callModernApiContract } from './modern-contract-client'

export type {
  CancelDelayedMessageParams,
  DelayedMessage,
  MessageStatus,
  SendDelayedMessageParams
} from '@shared/api-contracts'


/**
 * 延遲訊息 API
 */
export const delayedMessagesApi = {
  /**
   * 發送延遲訊息
   *
   * 特點：
   * - 訊息會在指定秒數後發送
   * - 在發送前可以隨時撤銷
   * - 適用場景：客服容錯、防止誤發
   */
  async send(params: SendDelayedMessageParams): Promise<DelayedMessage> {
    const response = await callModernApiContract(delayedMessagesV2Contracts.send, {}, params);

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to send delayed message');
    }

    return response.data;
  },

  /**
   * 撤銷延遲訊息（即時撤銷）
   *
   * 優勢：
   * - 響應時間 <100ms
   * - 真正的撤銷（不是偽取消）
   * - 100% 可靠
   */
  async cancel(params: CancelDelayedMessageParams): Promise<void> {
    const response = await callModernApiContract(
      delayedMessagesV2Contracts.cancel,
      { messageId: params.messageId },
      {
        conversationId: params.conversationId,
        reason: params.reason
      }
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to cancel message');
    }
  },

  /**
   * 查詢訊息狀態
   *
   * 用途：
   * - 前端倒數計時
   * - 狀態顯示
   * - 判斷是否可撤銷
   */
  async getStatus(messageId: string, conversationId: string): Promise<MessageStatus> {
    const response = await callModernApiContract(
      delayedMessagesV2Contracts.status,
      { messageId, conversationId }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get message status');
    }

    return response.data;
  },

  /**
   * 列出待發送訊息
   */
  async listPending(conversationId: string): Promise<PendingDelayedMessage[]> {
    const response = await callModernApiContract(delayedMessagesV2Contracts.pending, { conversationId });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to list pending messages');
    }

    return response.data.messages;
  },

  /**
   * 健康檢查
   */
  async health(): Promise<{
    success: boolean;
    status: string;
    features: {
      instantCancel: boolean;
      preciseScheduling: boolean;
      durableObjects: boolean;
    };
  }> {
    const response = await callModernApiContract(delayedMessagesV2Contracts.health, {});

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to check health');
    }

    return response.data;
  }
};

export default delayedMessagesApi;
