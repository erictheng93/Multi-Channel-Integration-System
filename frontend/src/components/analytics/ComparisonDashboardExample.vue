<template>
  <div class="comparison-dashboard-example">
    <div class="page-header">
      <h1>數據分析儀表板</h1>
      <p class="subtitle">
        期間比較與趨勢分析
      </p>
    </div>

    <!-- Tab 切換 -->
    <div class="dashboard-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        class="tab-button"
        :class="{ 'active': activeTab === tab.value }"
        @click="activeTab = tab.value"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- 對話指標 Dashboard -->
    <MetricsComparisonDashboard
      v-if="activeTab === 'conversation'"
      title="對話指標分析"
      preset="conversation"
      :auto-refresh="true"
      :refresh-interval="30000"
    />

    <!-- 消息指標 Dashboard -->
    <MetricsComparisonDashboard
      v-if="activeTab === 'message'"
      title="消息指標分析"
      preset="message"
      :auto-refresh="true"
      :refresh-interval="30000"
    />

    <!-- 用戶活動 Dashboard -->
    <MetricsComparisonDashboard
      v-if="activeTab === 'user-activity'"
      title="用戶活動分析"
      preset="user-activity"
      :auto-refresh="true"
      :refresh-interval="30000"
    />

    <!-- 自訂指標 Dashboard -->
    <MetricsComparisonDashboard
      v-if="activeTab === 'custom'"
      title="自訂指標分析"
      :preset="null"
      :auto-refresh="false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import MetricsComparisonDashboard from './MetricsComparisonDashboard.vue';

const activeTab = ref('conversation');

const tabs = [
  { label: '對話指標', value: 'conversation' },
  { label: '消息指標', value: 'message' },
  { label: '用戶活動', value: 'user-activity' },
  { label: '自訂指標', value: 'custom' }
];
</script>

<style scoped>
.comparison-dashboard-example {
  min-height: 100vh;
  background: #f9fafb;
}

.page-header {
  background: white;
  padding: 32px 24px;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 0;
}

.page-header h1 {
  font-size: 32px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 8px 0;
}

.subtitle {
  font-size: 16px;
  color: #6b7280;
  margin: 0;
}

.dashboard-tabs {
  display: flex;
  gap: 4px;
  padding: 0 24px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  overflow-x: auto;
}

.tab-button {
  padding: 16px 24px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: 15px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.tab-button:hover {
  color: #111827;
  background: #f9fafb;
}

.tab-button.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}

@media (max-width: 768px) {
  .page-header {
    padding: 24px 16px;
  }

  .page-header h1 {
    font-size: 24px;
  }

  .dashboard-tabs {
    padding: 0 16px;
  }

  .tab-button {
    padding: 12px 16px;
    font-size: 14px;
  }
}
</style>