<template>
  <div class="dashboard-header">
    <div class="header-content">
      <h1 class="dashboard-title">
         報表儀表板
      </h1>
      <p class="dashboard-subtitle">
        管理和監控您的報表生成與使用情況
      </p>
    </div>
    <div class="header-actions">
      <button
        class="btn btn-secondary"
        :disabled="loading"
        @click="$emit('refresh')"
      >
        <span v-if="loading"> 載入中...</span>
        <span v-else> 重新整理</span>
      </button>
      <button
        class="btn btn-primary"
        @click="$emit('create-report')"
      >
         建立報表
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * DashboardHeader Component
 *
 * 报表仪表板页面头部
 *
 * @emits refresh - 用户点击刷新按钮
 * @emits create-report - 用户点击创建报表按钮
 */

export interface DashboardHeaderProps {
  /**
   * 是否正在加载
   */
  loading?: boolean
}

withDefaults(defineProps<DashboardHeaderProps>(), {
  loading: false
})

defineEmits<{
  refresh: []
  'create-report': []
}>()
</script>

<style scoped>
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e5e7eb;
}

.header-content {
  flex: 1;
}

.dashboard-title {
  font-size: 2.5rem;
  font-weight: bold;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
}

.dashboard-subtitle {
  color: #6b7280;
  font-size: 1.2rem;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 1rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  font-size: 1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-primary {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #2563eb, #1e40af);
  transform: translateY(-1px);
}

.btn-primary:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover:not(:disabled) {
  background: #e5e7eb;
}

@media (max-width: 768px) {
  .dashboard-header {
    flex-direction: column;
    gap: 1rem;
  }

  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
