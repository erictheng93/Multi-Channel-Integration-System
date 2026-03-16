<template>
  <div class="quick-actions-widget">
    <div class="widget-header">
      <h3 class="widget-title">
        快速操作
      </h3>
    </div>

    <div class="widget-content">
      <!-- 建立報表 -->
      <button
        class="action-item primary"
        @click="$emit('create-report')"
      >
        <span class="action-icon" />
        <div class="action-content">
          <div class="action-title">
            建立報表
          </div>
          <div class="action-subtitle">
            生成新的報表
          </div>
        </div>
      </button>

      <!-- 重新整理 -->
      <button
        class="action-item"
        :disabled="loading"
        @click="$emit('refresh')"
      >
        <span class="action-icon" />
        <div class="action-content">
          <div class="action-title">
            重新整理
          </div>
          <div class="action-subtitle">
            {{ loading ? '載入中...' : '更新報表列表' }}
          </div>
        </div>
      </button>

      <!-- 匯出全部 -->
      <button
        class="action-item"
        :disabled="totalReports === 0"
        @click="$emit('export-all')"
      >
        <span class="action-icon" />
        <div class="action-content">
          <div class="action-title">
            匯出全部
          </div>
          <div class="action-subtitle">
            下載所有報表 ({{ totalReports }})
          </div>
        </div>
      </button>

      <!-- 報表設定 -->
      <button
        class="action-item"
        @click="$emit('view-settings')"
      >
        <span class="action-icon" />
        <div class="action-content">
          <div class="action-title">
            報表設定
          </div>
          <div class="action-subtitle">
            配置偏好選項
          </div>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * QuickActionsWidget Component
 *
 * 快速操作小部件，提供常用报表操作的快捷入口
 *
 * @emits create-report - 创建新报表
 * @emits refresh - 刷新报表列表
 * @emits export-all - 导出所有报表
 * @emits view-settings - 查看报表设置
 */

export interface QuickActionsWidgetProps {
  /**
   * 加载状态
   */
  loading?: boolean

  /**
   * 总报表数量
   */
  totalReports?: number
}

withDefaults(defineProps<QuickActionsWidgetProps>(), {
  loading: false,
  totalReports: 0
})

defineEmits<{
  'create-report': []
  'refresh': []
  'export-all': []
  'view-settings': []
}>()
</script>

<style scoped>
.quick-actions-widget {
  display: flex;
  flex-direction: column;
}

.widget-header {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
}

.widget-title {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.widget-content {
  display: flex;
  flex-direction: column;
  padding: 0.75rem;
  gap: 0.5rem;
}

.action-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.action-item:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #3b82f6;
  transform: translateX(2px);
}

.action-item:active:not(:disabled) {
  transform: translateX(4px);
}

.action-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-item.primary {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  border-color: #3b82f6;
}

.action-item.primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  border-color: #2563eb;
}

.action-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.action-content {
  flex: 1;
  min-width: 0;
}

.action-title {
  font-size: 0.95rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
  color: inherit;
}

.action-item.primary .action-title {
  color: white;
}

.action-subtitle {
  font-size: 0.8rem;
  color: #6b7280;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.action-item.primary .action-subtitle {
  color: rgba(255, 255, 255, 0.9);
}

/* Responsive */
@media (max-width: 768px) {
  .widget-content {
    padding: 0.5rem;
  }

  .action-item {
    padding: 0.75rem;
  }

  .action-icon {
    font-size: 1.25rem;
  }

  .action-title {
    font-size: 0.9rem;
  }

  .action-subtitle {
    font-size: 0.75rem;
  }
}
</style>
