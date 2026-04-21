<template>
  <AppLayout>
    <div class="channel-management">
      <!-- Page Header -->
      <div class="page-header">
        <div class="header-content">
          <h1 class="page-title">
            頻道管理
          </h1>
          <p class="page-description">
            管理所有通訊平台的頻道配置
          </p>
        </div>
        <button
          class="btn btn-primary"
          @click="openAddChannelDialog"
        >
          <span class="btn-icon">+</span>
          新增頻道
        </button>
      </div>

      <!-- Platform Filter -->
      <div class="filter-section">
        <div class="filter-buttons">
          <button
            class="filter-btn"
            :class="{ active: selectedPlatform === null }"
            @click="filterByPlatform(null)"
          >
            全部
            <span class="count-badge">{{ channels.length }}</span>
          </button>
          <button
            class="filter-btn"
            :class="{ active: selectedPlatform === 'line' }"
            @click="filterByPlatform('line')"
          >
            LINE
            <span class="count-badge">{{ getChannelCount('line') }}</span>
          </button>
          <button
            class="filter-btn"
            :class="{ active: selectedPlatform === 'facebook' }"
            @click="filterByPlatform('facebook')"
          >
            Facebook
            <span class="count-badge">{{ getChannelCount('facebook') }}</span>
          </button>
          <button
            class="filter-btn"
            :class="{ active: selectedPlatform === 'whatsapp' }"
            @click="filterByPlatform('whatsapp')"
          >
            WhatsApp
            <span class="count-badge">{{ getChannelCount('whatsapp') }}</span>
          </button>
        </div>

        <button
          class="btn btn-secondary btn-sm"
          @click="refreshChannels"
        >
          <span />
          重新整理
        </button>
      </div>

      <!-- Loading State -->
      <div
        v-if="isLoading"
        class="loading-state"
      >
        <div class="spinner" />
        <p>載入頻道資料中...</p>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="filteredChannels.length === 0"
        class="empty-state"
      >
        <div class="empty-icon" />
        <h3>尚未設定任何頻道</h3>
        <p>點擊「新增頻道」按鈕開始設定您的第一個通訊平台</p>
        <button
          class="btn btn-primary"
          @click="openAddChannelDialog"
        >
          新增頻道
        </button>
      </div>

      <!-- Channel List -->
      <div
        v-else
        class="channel-grid"
      >
        <div
          v-for="channel in filteredChannels"
          :key="channel.id"
          class="channel-card"
          :class="{ inactive: !channel.isActive }"
        >
          <!-- Card Header -->
          <div class="card-header">
            <div
              class="platform-badge"
              :class="`platform-${channel.platform}`"
            >
              <span class="platform-icon">{{ getPlatformIcon(channel.platform) }}</span>
              <span class="platform-name">{{ getPlatformName(channel.platform) }}</span>
            </div>

            <div class="card-actions">
              <button
                class="action-btn"
                :title="channel.isActive ? '停用' : '啟用'"
                @click="toggleChannelStatus(channel)"
              >
                {{ channel.isActive ? '●' : '○' }}
              </button>
              <button
                class="action-btn"
                title="更多選項"
                @click="toggleDropdown(channel.id)"
              >
                ⋮
              </button>

              <!-- Dropdown Menu -->
              <div
                v-if="activeDropdown === channel.id"
                class="dropdown-menu"
              >
                <button @click="viewChannelDetails(channel)">
                  查看詳情
                </button>
                <button @click="verifyChannel(channel)">
                  驗證配置
                </button>
                <button @click="viewStats(channel)">
                  查看統計
                </button>
                <button @click="editChannel(channel)">
                  編輯配置
                </button>
                <button
                  class="danger"
                  @click="deleteChannel(channel)"
                >
                  刪除頻道
                </button>
              </div>
            </div>
          </div>

          <!-- Card Body -->
          <div class="card-body">
            <div class="channel-info">
              <div class="info-item">
                <span class="label">Channel ID：</span>
                <span class="value">{{ getChannelId(channel) }}</span>
              </div>
              <div
                v-if="channel.configMetadata?.description"
                class="info-item"
              >
                <span class="label">說明：</span>
                <span class="value">{{ channel.configMetadata.description }}</span>
              </div>
            </div>

            <!-- Status Badges -->
            <div class="status-badges">
              <div
                class="status-badge"
                :class="channel.isActive ? 'success' : 'inactive'"
              >
                {{ channel.isActive ? '啟用中' : '已停用' }}
              </div>
              <div
                class="status-badge"
                :class="channel.isVerified ? 'success' : 'warning'"
              >
                {{ channel.isVerified ? '已驗證' : '未驗證' }}
              </div>
            </div>

            <!-- Statistics -->
            <div class="stats">
              <div class="stat-item">
                <div class="stat-label">
                  發送訊息
                </div>
                <div class="stat-value">
                  {{ getStats(channel).totalSent }}
                </div>
              </div>
              <div class="stat-divider" />
              <div class="stat-item">
                <div class="stat-label">
                  接收訊息
                </div>
                <div class="stat-value">
                  {{ getStats(channel).totalReceived }}
                </div>
              </div>
            </div>

            <!-- Last Activity -->
            <div
              v-if="getStats(channel).lastMessageAt"
              class="last-activity"
            >
              最後活動：{{ formatDate(getStats(channel).lastMessageAt!) }}
            </div>
          </div>

          <!-- Card Footer -->
          <div class="card-footer">
            <button
              class="btn btn-sm btn-secondary"
              @click="copyWebhookUrl(channel)"
            >
              複製 Webhook URL
            </button>
            <button
              class="btn btn-sm btn-primary"
              @click="verifyChannel(channel)"
            >
              驗證
            </button>
          </div>
        </div>
      </div>

      <!-- Channel Config Dialog -->
      <ChannelConfigDialog
        :show="showConfigDialog"
        :channel="selectedChannel"
        @update:show="showConfigDialog = $event"
        @close="closeConfigDialog"
        @success="handleChannelCreated"
      />

      <ChannelDetailsModal
        :show="showDetailsModal"
        :channel="selectedChannel"
        @update:show="showDetailsModal = $event"
        @close="showDetailsModal = false"
        @copy-webhook-url="copyWebhookUrl"
      />
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import AppLayout from '@/components/ui/AppLayout.vue'
import ChannelConfigDialog from '@/components/channels/ChannelConfigDialog.vue'
import ChannelDetailsModal from '@/components/channels/ChannelDetailsModal.vue'
import { useChannelManagement } from '@/composables/useChannelManagement'

const {
  activeDropdown,
  channels,
  closeConfigDialog,
  copyWebhookUrl,
  deleteChannel,
  editChannel,
  filterByPlatform,
  filteredChannels,
  formatDate,
  getChannelCount,
  getChannelId,
  getPlatformIcon,
  getPlatformName,
  getStats,
  handleChannelCreated,
  isLoading,
  openAddChannelDialog,
  refreshChannels,
  selectedChannel,
  selectedPlatform,
  showConfigDialog,
  showDetailsModal,
  toggleChannelStatus,
  toggleDropdown,
  verifyChannel,
  viewChannelDetails,
  viewStats
} = useChannelManagement()
</script>

<style scoped>
.channel-management {
  padding: var(--space-6);
  max-width: 1400px;
  margin: 0 auto;
}

/* Page Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-6);
}

.page-title {
  font-size: 2rem;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0 0 var(--space-2);
}

.page-description {
  color: var(--gray-600);
  margin: 0;
}

/* Filter Section */
.filter-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-6);
  padding: var(--space-4);
  background: white;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.filter-buttons {
  display: flex;
  gap: var(--space-2);
}

.filter-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--gray-300);
  background: white;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--gray-700);
}

.filter-btn:hover {
  background: var(--gray-50);
  border-color: var(--primary-300);
}

.filter-btn.active {
  background: var(--primary-50);
  border-color: var(--primary-500);
  color: var(--primary-700);
}

.count-badge {
  background: var(--gray-200);
  color: var(--gray-700);
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
}

.filter-btn.active .count-badge {
  background: var(--primary-200);
  color: var(--primary-800);
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12);
  color: var(--gray-600);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--gray-200);
  border-top-color: var(--primary-500);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: var(--space-4);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: var(--space-12);
  background: white;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: var(--space-4);
}

.empty-state h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--gray-900);
  margin-bottom: var(--space-2);
}

.empty-state p {
  color: var(--gray-600);
  margin-bottom: var(--space-6);
}

/* Channel Grid */
.channel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: var(--space-4);
}

/* Channel Card */
.channel-card {
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  transition: all 0.2s;
  overflow: hidden;
}

.channel-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.channel-card.inactive {
  opacity: 0.6;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4);
  border-bottom: 1px solid var(--gray-100);
}

.platform-badge {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 0.875rem;
}

.platform-line {
  background: var(--green-100);
  color: var(--green-800);
}

.platform-facebook {
  background: var(--blue-100);
  color: var(--blue-800);
}

.platform-whatsapp {
  background: var(--green-100);
  color: var(--green-800);
}

.platform-icon {
  font-size: 1.25rem;
}

.card-actions {
  display: flex;
  gap: var(--space-2);
  position: relative;
}

.action-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: var(--gray-100);
  color: var(--gray-600);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
}

.action-btn:hover {
  background: var(--gray-200);
  color: var(--gray-900);
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: var(--space-2);
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 10;
  min-width: 160px;
}

.dropdown-menu button {
  width: 100%;
  padding: var(--space-2) var(--space-4);
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  transition: background 0.2s;
  font-size: 0.875rem;
}

.dropdown-menu button:hover {
  background: var(--gray-50);
}

.dropdown-menu button.danger {
  color: var(--red-600);
}

.dropdown-menu button.danger:hover {
  background: var(--red-50);
}

.card-body {
  padding: var(--space-4);
}

.channel-info {
  margin-bottom: var(--space-4);
}

.info-item {
  display: flex;
  margin-bottom: var(--space-2);
  font-size: 0.875rem;
}

.info-item .label {
  color: var(--gray-600);
  min-width: 100px;
}

.info-item .value {
  color: var(--gray-900);
  font-weight: 500;
  word-break: break-all;
}

.status-badges {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
}

.status-badge.success {
  background: var(--green-100);
  color: var(--green-800);
}

.status-badge.inactive {
  background: var(--gray-100);
  color: var(--gray-800);
}

.status-badge.warning {
  background: var(--yellow-100);
  color: var(--yellow-800);
}

.stats {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-3);
  background: var(--gray-50);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-3);
}

.stat-item {
  flex: 1;
  text-align: center;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--gray-600);
  margin-bottom: 0.25rem;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--primary-600);
}

.stat-divider {
  width: 1px;
  background: var(--gray-200);
}

.last-activity {
  font-size: 0.75rem;
  color: var(--gray-500);
  text-align: center;
}

.card-footer {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3);
  border-top: 1px solid var(--gray-100);
}

.card-footer .btn {
  flex: 1;
}

/* Buttons */
.btn-icon {
  font-size: 1.25rem;
  line-height: 1;
}

/* Responsive */
@media (max-width: 768px) {
  .channel-management {
    padding: var(--space-4);
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-4);
  }

  .filter-section {
    flex-direction: column;
    gap: var(--space-4);
  }

  .filter-buttons {
    flex-wrap: wrap;
  }

  .channel-grid {
    grid-template-columns: 1fr;
  }

}
</style>
