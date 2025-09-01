// 對話數據混合同步服務 - SSE + 智能輪詢備份
// 專案名稱：Multi-Channel Support MVP
// Created by: Hybrid Sync Service Developer

import { ref, type Ref } from 'vue';
import { conversationApi } from '@/api/conversations';
import { useAuthStore } from '@/stores/auth';
import type { Conversation } from '@/types';

// 同步狀態類型
type SyncStatus = 'disconnected' | 'connecting' | 'connected' | 'polling' | 'error';

// 混合同步配置
interface SyncConfig {
  sseUrl: string;
  pollbackupInterval: number;  // 備份輪詢間隔
  heartbeatTimeout: number;    // 心跳超時
  reconnectDelay: number;      // 重連延遲
  maxReconnectAttempts: number; // 最大重連次數
}

// 默認配置
const DEFAULT_CONFIG: SyncConfig = {
  sseUrl: '/api/conversations/stream',
  pollbackupInterval: 120000,   // 2分鐘備份輪詢
  heartbeatTimeout: 45000,      // 45秒心跳超時
  reconnectDelay: 5000,         // 5秒重連延遲
  maxReconnectAttempts: 3       // 最多重連3次
};

export class ConversationSyncService {
  // SSE連接
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  
  // 輪詢備份
  private pollbackupTimer: NodeJS.Timeout | null = null;
  private lastSSEUpdate = 0;
  
  // 心跳檢測
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private lastHeartbeat = 0;
  
  // 狀態管理
  private config: SyncConfig;
  public status: Ref<SyncStatus> = ref('disconnected');
  public lastUpdate: Ref<Date | null> = ref(null);
  public errorMessage: Ref<string | null> = ref(null);
  
  // 回調函數
  private onDataUpdate: ((conversations: Conversation[]) => void) | null = null;
  private onStatusChange: ((status: SyncStatus) => void) | null = null;

  constructor(config?: Partial<SyncConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupVisibilityListener();
  }

  // 設置數據更新回調
  onData(callback: (conversations: Conversation[]) => void) {
    this.onDataUpdate = callback;
  }

  // 設置狀態變化回調
  onStatus(callback: (status: SyncStatus) => void) {
    this.onStatusChange = callback;
  }

  // 開始同步
  async start() {
    console.log('🚀 [Sync Service] Starting hybrid sync...');
    
    // 清理現有連接
    this.stop();
    
    // 設置狀態
    this.setStatus('connecting');
    
    // 嘗試SSE連接
    this.startSSE();
    
    // 開始備份輪詢
    this.startPollbackup();
  }

  // 停止同步
  stop() {
    console.log('🛑 [Sync Service] Stopping sync service...');
    
    this.closeSSE();
    this.stopPollbackup();
    this.stopHeartbeat();
    this.stopReconnect();
    
    this.setStatus('disconnected');
    this.errorMessage.value = null;
  }

  // 手動刷新
  async refresh() {
    console.log('🔄 [Sync Service] Manual refresh requested');
    return this.pollConversations();
  }

  // 啟動SSE連接
  private startSSE() {
    const authStore = useAuthStore();
    if (!authStore.token) {
      console.warn('⚠️ [Sync Service] No auth token, falling back to polling');
      this.setStatus('polling');
      return;
    }

    try {
      const baseURL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
      const baseUrl = baseURL.endsWith('/api') 
        ? `${baseURL}/conversations/stream`
        : `${baseURL}/api/conversations/stream`;
      
      // 通過URL參數傳遞token（EventSource限制）
      const url = `${baseUrl}?token=${encodeURIComponent(authStore.token)}`;

      console.log('📡 [Sync Service] Connecting to SSE:', baseUrl);

      this.eventSource = new EventSource(url, {
        withCredentials: false
      });
      
      this.eventSource.onopen = () => {
        console.log('✅ [Sync Service] SSE connected');
        this.setStatus('connected');
        this.reconnectAttempts = 0;
        this.errorMessage.value = null;
        this.startHeartbeat();
      };

      this.eventSource.onmessage = (event) => {
        this.handleSSEMessage(event);
      };

      this.eventSource.onerror = (error) => {
        console.error('❌ [Sync Service] SSE error:', error);
        this.handleSSEError();
      };

    } catch (error) {
      console.error('❌ [Sync Service] Failed to start SSE:', error);
      this.handleSSEError();
    }
  }

  // 處理SSE消息
  private handleSSEMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data);
      console.log('📥 [Sync Service] SSE message:', data.type);

      switch (data.type) {
        case 'heartbeat':
          this.lastHeartbeat = Date.now();
          break;

        case 'conversations_update':
          this.lastSSEUpdate = Date.now();
          this.lastUpdate.value = new Date();
          
          if (this.onDataUpdate && data.data) {
            this.onDataUpdate(data.data);
          }
          break;

        default:
          console.warn('⚠️ [Sync Service] Unknown SSE message type:', data.type);
      }

    } catch (error) {
      console.error('❌ [Sync Service] Failed to parse SSE message:', error);
    }
  }

  // 處理SSE錯誤
  private handleSSEError() {
    this.closeSSE();
    
    if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 [Sync Service] Reconnecting SSE (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})...`);
      
      this.setStatus('connecting');
      this.reconnectTimer = setTimeout(() => {
        this.startSSE();
      }, this.config.reconnectDelay * this.reconnectAttempts);
      
    } else {
      console.warn('⚠️ [Sync Service] Max reconnect attempts reached, falling back to polling');
      this.setStatus('polling');
      this.errorMessage.value = 'SSE連接失敗，使用輪詢模式';
    }
  }

  // 關閉SSE連接
  private closeSSE() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.stopHeartbeat();
  }

  // 開始心跳檢測
  private startHeartbeat() {
    this.lastHeartbeat = Date.now();
    
    this.heartbeatTimer = setInterval(() => {
      const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeat;
      
      if (timeSinceLastHeartbeat > this.config.heartbeatTimeout) {
        console.warn('💔 [Sync Service] Heartbeat timeout, reconnecting...');
        this.handleSSEError();
      }
    }, this.config.heartbeatTimeout / 2);
  }

  // 停止心跳檢測
  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // 開始備份輪詢
  private startPollbackup() {
    this.pollbackupTimer = setInterval(() => {
      // 只有當SSE長時間沒有更新時才執行輪詢
      const timeSinceSSEUpdate = Date.now() - this.lastSSEUpdate;
      const shouldPoll = this.status.value === 'polling' || 
                        timeSinceSSEUpdate > this.config.pollbackupInterval;

      if (shouldPoll) {
        console.log('🔄 [Sync Service] Backup polling triggered');
        this.pollConversations();
      }
    }, this.config.pollbackupInterval);
  }

  // 停止備份輪詢
  private stopPollbackup() {
    if (this.pollbackupTimer) {
      clearInterval(this.pollbackupTimer);
      this.pollbackupTimer = null;
    }
  }

  // 輪詢對話數據
  private async pollConversations() {
    try {
      const response = await conversationApi.list({
        page: 1,
        pageSize: 50
      });

      if (response.success && response.data && this.onDataUpdate) {
        this.onDataUpdate(response.data.items || []);
        this.lastUpdate.value = new Date();
        
        // 如果輪詢成功且SSE斷開，嘗試重新連接SSE
        if (this.status.value === 'polling' && this.reconnectAttempts === 0) {
          console.log('🔄 [Sync Service] Attempting to restore SSE connection...');
          this.startSSE();
        }
      }
      
    } catch (error) {
      console.error('❌ [Sync Service] Polling failed:', error);
      this.errorMessage.value = '數據同步失敗';
    }
  }

  // 停止重連定時器
  private stopReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // 設置狀態
  private setStatus(status: SyncStatus) {
    if (this.status.value !== status) {
      this.status.value = status;
      if (this.onStatusChange) {
        this.onStatusChange(status);
      }
      console.log(`📊 [Sync Service] Status: ${status}`);
    }
  }

  // 監聽頁面可見性
  private setupVisibilityListener() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('👁️ [Sync Service] Page hidden, maintaining connection');
      } else {
        console.log('👁️ [Sync Service] Page visible, refreshing data');
        this.refresh();
      }
    });
  }
}

// 創建單例實例
export const conversationSync = new ConversationSyncService();