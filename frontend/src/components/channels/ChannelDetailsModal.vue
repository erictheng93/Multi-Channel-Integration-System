<template>
  <Modal
    :show="show"
    title="頻道詳情"
    size="lg"
    @close="emit('close')"
    @update:show="emit('update:show', $event)"
  >
    <div
      v-if="channel"
      class="details-content"
    >
      <div class="detail-section">
        <h4>基本資訊</h4>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">平台：</span>
            <span class="detail-value">{{ getPlatformName(channel.platform) }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">狀態：</span>
            <span class="detail-value">{{ channel.isActive ? '啟用中' : '已停用' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">驗證狀態：</span>
            <span class="detail-value">{{ channel.isVerified ? '已驗證' : '未驗證' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">建立時間：</span>
            <span class="detail-value">{{ formatDate(channel.createdAt) }}</span>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h4>Webhook 設定</h4>
        <div class="webhook-url-container">
          <input
            :value="getWebhookUrl(channel)"
            type="text"
            class="webhook-url-display"
            readonly
          >
          <button
            class="btn btn-sm btn-primary"
            @click="emit('copyWebhookUrl', channel)"
          >
            複製
          </button>
        </div>
      </div>

      <div class="detail-section">
        <h4>使用統計</h4>
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-number">
              {{ getStats(channel).totalSent }}
            </div>
            <div class="stat-text">
              發送訊息
            </div>
          </div>
          <div class="stat-box">
            <div class="stat-number">
              {{ getStats(channel).totalReceived }}
            </div>
            <div class="stat-text">
              接收訊息
            </div>
          </div>
        </div>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { parseStats, parseWebhookConfig } from '@/api/channels'
import type { ChannelIntegration, ChannelPlatform } from '@/api/channels'
import Modal from '@/components/ui/Modal.vue'

defineProps<{
  show: boolean
  channel?: ChannelIntegration
}>()

const emit = defineEmits<{
  'update:show': [show: boolean]
  close: []
  copyWebhookUrl: [channel: ChannelIntegration]
}>()

const getPlatformName = (platform: ChannelPlatform): string => {
  const names = {
    line: 'LINE',
    facebook: 'Facebook',
    whatsapp: 'WhatsApp'
  }
  return names[platform] || platform
}

const getWebhookUrl = (channel: ChannelIntegration): string => {
  const webhookCfg = parseWebhookConfig(channel)
  return webhookCfg.url || ''
}

const getStats = (channel: ChannelIntegration) => {
  return parseStats(channel)
}

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-TW')
}
</script>

<style scoped>
.details-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.detail-section h4 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--gray-900);
  margin-bottom: var(--space-4);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.detail-label {
  font-size: 0.75rem;
  color: var(--gray-600);
  font-weight: 500;
}

.detail-value {
  font-size: 0.875rem;
  color: var(--gray-900);
}

.webhook-url-container {
  display: flex;
  gap: var(--space-2);
}

.webhook-url-display {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  font-family: monospace;
  background: var(--gray-50);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}

.stat-box {
  text-align: center;
  padding: var(--space-4);
  background: var(--primary-50);
  border-radius: var(--radius-md);
}

.stat-number {
  font-size: 2rem;
  font-weight: 700;
  color: var(--primary-600);
  margin-bottom: 0.5rem;
}

.stat-text {
  font-size: 0.875rem;
  color: var(--gray-600);
}

@media (max-width: 768px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
