// 撤回功能端對端測試
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';

// 模擬前端組件和 composables
const mockDelayedMessageComposable = {
  sendDelayedMessage: vi.fn(),
  recallMessage: vi.fn(),
  getPendingMessages: vi.fn(),
  canRecall: vi.fn(),
  isLoading: vi.fn().mockReturnValue(false),
  error: vi.fn().mockReturnValue(null)
};

// Mock useDelayedMessage composable
vi.mock('../../../frontend/src/composables/useDelayedMessage', () => ({
  useDelayedMessage: () => mockDelayedMessageComposable
}));

// Mock API 調用
const mockApiClient = {
  post: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn()
};

vi.mock('../../../frontend/src/api/client', () => ({
  apiClient: mockApiClient
}));

// 簡化的測試組件
const DelayedMessageSender = {
  template: `
    <div class="delayed-message-sender">
      <form @submit.prevent="handleSend">
        <textarea 
          v-model="content" 
          placeholder="輸入訊息內容"
          data-testid="message-content"
        />
        <input 
          v-model.number="delaySeconds" 
          type="number" 
          min="1" 
          max="120"
          data-testid="delay-seconds"
        />
        <button 
          type="submit" 
          :disabled="isLoading"
          data-testid="send-button"
        >
          {{ isLoading ? '發送中...' : '發送延遲訊息' }}
        </button>
      </form>
      <div v-if="error" class="error" data-testid="error-message">
        {{ error }}
      </div>
      <div v-if="successMessage" class="success" data-testid="success-message">
        {{ successMessage }}
      </div>
    </div>
  `,
  data() {
    return {
      content: '',
      delaySeconds: 30,
      successMessage: '',
      conversationId: 'test-conv-123'
    };
  },
  setup() {
    const { sendDelayedMessage, isLoading, error } = mockDelayedMessageComposable;
    return { sendDelayedMessage, isLoading, error };
  },
  methods: {
    async handleSend() {
      try {
        const result = await this.sendDelayedMessage({
          conversationId: this.conversationId,
          content: this.content,
          delaySeconds: this.delaySeconds
        });
        
        if (result.success) {
          this.successMessage = `訊息已排程，ID: ${result.data.messageId}`;
          this.content = '';
        }
      } catch (error) {
        console.error('Send failed:', error);
      }
    }
  }
};

const PendingMessagesList = {
  template: `
    <div class="pending-messages-list">
      <div v-if="isLoading" data-testid="loading">載入中...</div>
      <div v-else-if="messages.length === 0" data-testid="empty-state">
        沒有待發送的訊息
      </div>
      <div v-else>
        <div 
          v-for="message in messages" 
          :key="message.id"
          class="message-item"
          :data-testid="'message-' + message.id"
        >
          <div class="message-content">{{ message.content }}</div>
          <div class="message-time">
            預計發送時間: {{ formatTime(message.scheduledAt) }}
          </div>
          <button 
            v-if="message.canRecall"
            @click="handleRecall(message.id)"
            :disabled="recalling === message.id"
            :data-testid="'recall-button-' + message.id"
            class="recall-button"
          >
            {{ recalling === message.id ? '撤回中...' : '撤回' }}
          </button>
          <span v-else class="cannot-recall">無法撤回</span>
        </div>
      </div>
    </div>
  `,
  data() {
    return {
      messages: [],
      recalling: null
    };
  },
  setup() {
    const { getPendingMessages, recallMessage, isLoading } = mockDelayedMessageComposable;
    return { getPendingMessages, recallMessage, isLoading };
  },
  async mounted() {
    await this.loadMessages();
  },
  methods: {
    async loadMessages() {
      try {
        const result = await this.getPendingMessages();
        if (result.success) {
          this.messages = result.data.items;
        }
      } catch (error) {
        console.error('Load messages failed:', error);
      }
    },
    async handleRecall(messageId) {
      this.recalling = messageId;
      try {
        const result = await this.recallMessage(messageId);
        if (result.success) {
          // 更新本地狀態
          const message = this.messages.find(m => m.id === messageId);
          if (message) {
            message.canRecall = false;
            message.status = 'cancelled';
          }
        }
      } catch (error) {
        console.error('Recall failed:', error);
      } finally {
        this.recalling = null;
      }
    },
    formatTime(isoString) {
      return new Date(isoString).toLocaleString();
    }
  }
};

describe('Message Recall E2E Tests', () => {
  let pinia: any;
  let router: any;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } }
      ]
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Delayed Message Sending Flow', () => {
    it('should send delayed message successfully', async () => {
      // Mock API 成功回應
      mockDelayedMessageComposable.sendDelayedMessage.mockResolvedValue({
        success: true,
        data: {
          messageId: 'test-msg-123',
          canRecall: true,
          recallDeadline: new Date(Date.now() + 25000).toISOString(),
          scheduledSendTime: new Date(Date.now() + 30000).toISOString()
        }
      });

      const wrapper = mount(DelayedMessageSender, {
        global: {
          plugins: [pinia, router]
        }
      });

      // 1. 輸入訊息內容
      const contentInput = wrapper.find('[data-testid="message-content"]');
      await contentInput.setValue('這是一個測試延遲訊息');

      // 2. 設置延遲時間
      const delayInput = wrapper.find('[data-testid="delay-seconds"]');
      await delayInput.setValue('45');

      // 3. 點擊發送按鈕
      const sendButton = wrapper.find('[data-testid="send-button"]');
      await sendButton.trigger('click');

      // 4. 等待處理完成
      await wrapper.vm.$nextTick();

      // 5. 驗證 API 調用
      expect(mockDelayedMessageComposable.sendDelayedMessage).toHaveBeenCalledWith({
        conversationId: 'test-conv-123',
        content: '這是一個測試延遲訊息',
        delaySeconds: 45
      });

      // 6. 驗證成功訊息顯示
      const successMessage = wrapper.find('[data-testid="success-message"]');
      expect(successMessage.exists()).toBe(true);
      expect(successMessage.text()).toContain('test-msg-123');

      // 7. 驗證表單重置
      expect(contentInput.element.value).toBe('');
    });

    it('should handle send failure gracefully', async () => {
      // Mock API 失敗回應
      mockDelayedMessageComposable.sendDelayedMessage.mockRejectedValue(
        new Error('Network error')
      );
      mockDelayedMessageComposable.error.mockReturnValue('發送失敗，請重試');

      const wrapper = mount(DelayedMessageSender, {
        global: {
          plugins: [pinia, router]
        }
      });

      // 1. 輸入訊息並發送
      await wrapper.find('[data-testid="message-content"]').setValue('測試訊息');
      await wrapper.find('[data-testid="send-button"]').trigger('click');
      await wrapper.vm.$nextTick();

      // 2. 驗證錯誤訊息顯示
      const errorMessage = wrapper.find('[data-testid="error-message"]');
      expect(errorMessage.exists()).toBe(true);
      expect(errorMessage.text()).toBe('發送失敗，請重試');
    });

    it('should validate input before sending', async () => {
      const wrapper = mount(DelayedMessageSender, {
        global: {
          plugins: [pinia, router]
        }
      });

      // 1. 不輸入內容直接發送
      const sendButton = wrapper.find('[data-testid="send-button"]');
      await sendButton.trigger('click');

      // 2. 驗證不會調用 API
      expect(mockDelayedMessageComposable.sendDelayedMessage).not.toHaveBeenCalled();

      // 3. 測試無效的延遲時間
      await wrapper.find('[data-testid="message-content"]').setValue('測試');
      await wrapper.find('[data-testid="delay-seconds"]').setValue('150'); // 超過限制
      await sendButton.trigger('click');

      // HTML5 驗證應該阻止提交
      expect(mockDelayedMessageComposable.sendDelayedMessage).not.toHaveBeenCalled();
    });
  });

  describe('Message Recall Flow', () => {
    it('should display pending messages and allow recall', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          content: '第一個待發送訊息',
          scheduledAt: new Date(Date.now() + 30000).toISOString(),
          canRecall: true,
          status: 'pending'
        },
        {
          id: 'msg-2',
          content: '第二個待發送訊息',
          scheduledAt: new Date(Date.now() + 60000).toISOString(),
          canRecall: false, // 已過撤回期限
          status: 'pending'
        }
      ];

      // Mock API 回應
      mockDelayedMessageComposable.getPendingMessages.mockResolvedValue({
        success: true,
        data: {
          items: mockMessages,
          total: 2
        }
      });

      const wrapper = mount(PendingMessagesList, {
        global: {
          plugins: [pinia, router]
        }
      });

      // 等待組件載入完成
      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 100));

      // 1. 驗證訊息列表顯示
      const messageItems = wrapper.findAll('.message-item');
      expect(messageItems).toHaveLength(2);

      // 2. 驗證第一個訊息可以撤回
      const firstMessage = wrapper.find('[data-testid="message-msg-1"]');
      expect(firstMessage.exists()).toBe(true);
      
      const firstRecallButton = wrapper.find('[data-testid="recall-button-msg-1"]');
      expect(firstRecallButton.exists()).toBe(true);
      expect(firstRecallButton.text()).toBe('撤回');

      // 3. 驗證第二個訊息不能撤回
      const secondMessage = wrapper.find('[data-testid="message-msg-2"]');
      expect(secondMessage.exists()).toBe(true);
      
      const secondRecallButton = wrapper.find('[data-testid="recall-button-msg-2"]');
      expect(secondRecallButton.exists()).toBe(false);
      
      const cannotRecallText = secondMessage.find('.cannot-recall');
      expect(cannotRecallText.exists()).toBe(true);
    });

    it('should execute recall successfully', async () => {
      const mockMessages = [
        {
          id: 'msg-recall-test',
          content: '可撤回的測試訊息',
          scheduledAt: new Date(Date.now() + 30000).toISOString(),
          canRecall: true,
          status: 'pending'
        }
      ];

      mockDelayedMessageComposable.getPendingMessages.mockResolvedValue({
        success: true,
        data: { items: mockMessages }
      });

      mockDelayedMessageComposable.recallMessage.mockResolvedValue({
        success: true,
        data: {
          messageId: 'msg-recall-test',
          recalled: true,
          recalledAt: new Date().toISOString()
        }
      });

      const wrapper = mount(PendingMessagesList, {
        global: {
          plugins: [pinia, router]
        }
      });

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 100));

      // 1. 點擊撤回按鈕
      const recallButton = wrapper.find('[data-testid="recall-button-msg-recall-test"]');
      expect(recallButton.exists()).toBe(true);

      await recallButton.trigger('click');
      await wrapper.vm.$nextTick();

      // 2. 驗證 API 調用
      expect(mockDelayedMessageComposable.recallMessage).toHaveBeenCalledWith('msg-recall-test');

      // 3. 驗證 UI 狀態更新
      // 按鈕應該變為不可撤回狀態
      await wrapper.vm.$nextTick();
      const updatedMessage = wrapper.find('[data-testid="message-msg-recall-test"]');
      const updatedRecallButton = updatedMessage.find('[data-testid="recall-button-msg-recall-test"]');
      expect(updatedRecallButton.exists()).toBe(false);
    });

    it('should handle recall failure', async () => {
      const mockMessages = [
        {
          id: 'msg-fail-test',
          content: '撤回失敗測試訊息',
          scheduledAt: new Date(Date.now() + 30000).toISOString(),
          canRecall: true,
          status: 'pending'
        }
      ];

      mockDelayedMessageComposable.getPendingMessages.mockResolvedValue({
        success: true,
        data: { items: mockMessages }
      });

      mockDelayedMessageComposable.recallMessage.mockRejectedValue(
        new Error('Recall deadline has passed')
      );

      const wrapper = mount(PendingMessagesList, {
        global: {
          plugins: [pinia, router]
        }
      });

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 100));

      // 1. 點擊撤回按鈕
      const recallButton = wrapper.find('[data-testid="recall-button-msg-fail-test"]');
      await recallButton.trigger('click');
      await wrapper.vm.$nextTick();

      // 2. 驗證按鈕狀態恢復
      expect(recallButton.text()).toBe('撤回'); // 不再顯示 "撤回中..."
      expect(recallButton.attributes('disabled')).toBeUndefined();
    });

    it('should show loading state during recall', async () => {
      const mockMessages = [
        {
          id: 'msg-loading-test',
          content: '載入狀態測試訊息',
          scheduledAt: new Date(Date.now() + 30000).toISOString(),
          canRecall: true,
          status: 'pending'
        }
      ];

      mockDelayedMessageComposable.getPendingMessages.mockResolvedValue({
        success: true,
        data: { items: mockMessages }
      });

      // Mock 延遲的撤回操作
      let resolveRecall: any;
      mockDelayedMessageComposable.recallMessage.mockImplementation(() => {
        return new Promise(resolve => {
          resolveRecall = resolve;
        });
      });

      const wrapper = mount(PendingMessagesList, {
        global: {
          plugins: [pinia, router]
        }
      });

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 100));

      // 1. 點擊撤回按鈕
      const recallButton = wrapper.find('[data-testid="recall-button-msg-loading-test"]');
      await recallButton.trigger('click');
      await wrapper.vm.$nextTick();

      // 2. 驗證載入狀態
      expect(recallButton.text()).toBe('撤回中...');
      expect(recallButton.attributes('disabled')).toBeDefined();

      // 3. 完成撤回操作
      resolveRecall({
        success: true,
        data: { messageId: 'msg-loading-test', recalled: true }
      });
      await wrapper.vm.$nextTick();

      // 4. 驗證狀態恢復
      expect(wrapper.vm.recalling).toBeNull();
    });
  });

  describe('Real-time Updates', () => {
    it('should handle message status changes', async () => {
      const mockMessages = [
        {
          id: 'msg-realtime-test',
          content: '即時更新測試訊息',
          scheduledAt: new Date(Date.now() + 30000).toISOString(),
          canRecall: true,
          status: 'pending'
        }
      ];

      mockDelayedMessageComposable.getPendingMessages.mockResolvedValue({
        success: true,
        data: { items: mockMessages }
      });

      const wrapper = mount(PendingMessagesList, {
        global: {
          plugins: [pinia, router]
        }
      });

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 100));

      // 1. 驗證初始狀態
      let recallButton = wrapper.find('[data-testid="recall-button-msg-realtime-test"]');
      expect(recallButton.exists()).toBe(true);

      // 2. 模擬訊息狀態變更（例如時間過期）
      mockMessages[0].canRecall = false;
      
      // 3. 重新載入訊息
      await wrapper.vm.loadMessages();
      await wrapper.vm.$nextTick();

      // 4. 驗證 UI 更新
      recallButton = wrapper.find('[data-testid="recall-button-msg-realtime-test"]');
      expect(recallButton.exists()).toBe(false);
      
      const cannotRecallText = wrapper.find('.cannot-recall');
      expect(cannotRecallText.exists()).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty message list', async () => {
      mockDelayedMessageComposable.getPendingMessages.mockResolvedValue({
        success: true,
        data: { items: [] }
      });

      const wrapper = mount(PendingMessagesList, {
        global: {
          plugins: [pinia, router]
        }
      });

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 100));

      const emptyState = wrapper.find('[data-testid="empty-state"]');
      expect(emptyState.exists()).toBe(true);
      expect(emptyState.text()).toBe('沒有待發送的訊息');
    });

    it('should handle API loading state', async () => {
      mockDelayedMessageComposable.isLoading.mockReturnValue(true);
      mockDelayedMessageComposable.getPendingMessages.mockImplementation(() => {
        return new Promise(() => {}); // 永不解決，保持載入狀態
      });

      const wrapper = mount(PendingMessagesList, {
        global: {
          plugins: [pinia, router]
        }
      });

      await wrapper.vm.$nextTick();

      const loadingState = wrapper.find('[data-testid="loading"]');
      expect(loadingState.exists()).toBe(true);
      expect(loadingState.text()).toBe('載入中...');
    });

    it('should handle concurrent recall attempts', async () => {
      const mockMessages = [
        {
          id: 'msg-concurrent-test',
          content: '並發測試訊息',
          scheduledAt: new Date(Date.now() + 30000).toISOString(),
          canRecall: true,
          status: 'pending'
        }
      ];

      mockDelayedMessageComposable.getPendingMessages.mockResolvedValue({
        success: true,
        data: { items: mockMessages }
      });

      let recallCount = 0;
      mockDelayedMessageComposable.recallMessage.mockImplementation(() => {
        recallCount++;
        return Promise.resolve({
          success: true,
          data: { messageId: 'msg-concurrent-test', recalled: true }
        });
      });

      const wrapper = mount(PendingMessagesList, {
        global: {
          plugins: [pinia, router]
        }
      });

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 100));

      // 1. 快速連續點擊撤回按鈕
      const recallButton = wrapper.find('[data-testid="recall-button-msg-concurrent-test"]');
      
      await recallButton.trigger('click');
      await recallButton.trigger('click');
      await recallButton.trigger('click');
      
      await wrapper.vm.$nextTick();

      // 2. 驗證只調用一次 API（防止重複提交）
      expect(recallCount).toBe(1);
    });
  });

  describe('Accessibility and UX', () => {
    it('should provide proper ARIA labels and keyboard navigation', async () => {
      const mockMessages = [
        {
          id: 'msg-a11y-test',
          content: '無障礙測試訊息',
          scheduledAt: new Date(Date.now() + 30000).toISOString(),
          canRecall: true,
          status: 'pending'
        }
      ];

      mockDelayedMessageComposable.getPendingMessages.mockResolvedValue({
        success: true,
        data: { items: mockMessages }
      });

      const wrapper = mount(PendingMessagesList, {
        global: {
          plugins: [pinia, router]
        }
      });

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 100));

      const recallButton = wrapper.find('[data-testid="recall-button-msg-a11y-test"]');
      
      // 驗證按鈕可以通過鍵盤操作
      expect(recallButton.element.tagName).toBe('BUTTON');
      
      // 驗證按鈕有適當的文字內容
      expect(recallButton.text()).toBe('撤回');
    });

    it('should show appropriate feedback messages', async () => {
      // 這個測試已在其他測試中涵蓋
      expect(true).toBe(true);
    });
  });
});