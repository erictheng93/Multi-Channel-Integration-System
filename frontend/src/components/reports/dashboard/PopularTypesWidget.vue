<template>
  <div class="popular-types-widget">
    <div class="widget-header">
      <h3 class="widget-title">
        📊 熱門報表類型
      </h3>
      <span
        v-if="popularTypes.length > 0"
        class="header-subtitle"
      >
        Top {{ popularTypes.length }}
      </span>
    </div>

    <div class="widget-content">
      <!-- 空狀態 -->
      <div
        v-if="popularTypes.length === 0"
        class="empty-state"
      >
        <div class="empty-icon">
          📊
        </div>
        <p class="empty-text">
          暫無報表數據
        </p>
      </div>

      <!-- 類型列表 -->
      <div
        v-else
        class="types-list"
      >
        <div
          v-for="type in popularTypes"
          :key="type.type"
          class="type-item"
          @click="$emit('filter-by-type', type.type)"
        >
          <div class="type-header">
            <span class="type-icon">{{ getReportTypeIcon(type.type) }}</span>
            <span class="type-name">{{ type.label }}</span>
            <span class="type-count">{{ type.count }}</span>
          </div>
          <div class="type-progress">
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: `${type.percentage}%` }"
              />
            </div>
            <span class="percentage-text">{{ type.percentage }}%</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * PopularTypesWidget Component
 *
 * 热门报表类型小部件，显示最常用的报表类型统计
 *
 * @emits filter-by-type - 按类型筛选报表
 */

export interface PopularType {
  /**
   * 报表类型标识
   */
  type: string

  /**
   * 报表类型显示名称
   */
  label: string

  /**
   * 该类型报表数量
   */
  count: number

  /**
   * 占总报表的百分比
   */
  percentage: number
}

export interface PopularTypesWidgetProps {
  /**
   * 热门报表类型列表（已排序）
   */
  popularTypes: PopularType[]

  /**
   * 获取报表类型图标
   */
  getReportTypeIcon: (type: string) => string
}

defineProps<PopularTypesWidgetProps>()

defineEmits<{
  'filter-by-type': [type: string]
}>()
</script>

<style scoped>
.popular-types-widget {
  display: flex;
  flex-direction: column;
}

.widget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.header-subtitle {
  font-size: 0.8rem;
  color: #6b7280;
  font-weight: 500;
}

.widget-content {
  padding: 1rem;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  text-align: center;
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  opacity: 0.5;
}

.empty-text {
  color: #6b7280;
  font-size: 0.9rem;
  margin: 0;
}

/* Types List */
.types-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.type-item {
  padding: 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.type-item:hover {
  background: #f9fafb;
  border-color: #3b82f6;
  transform: translateX(2px);
}

.type-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.type-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.type-name {
  flex: 1;
  font-size: 0.9rem;
  font-weight: 500;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.type-count {
  font-size: 0.9rem;
  font-weight: 600;
  color: #3b82f6;
  flex-shrink: 0;
}

.type-progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #2563eb);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.percentage-text {
  font-size: 0.8rem;
  color: #6b7280;
  font-weight: 500;
  min-width: 40px;
  text-align: right;
}

/* Responsive */
@media (max-width: 768px) {
  .widget-content {
    padding: 0.75rem;
  }

  .types-list {
    gap: 0.75rem;
  }

  .type-item {
    padding: 0.5rem;
  }

  .type-icon {
    font-size: 1.1rem;
  }

  .type-name {
    font-size: 0.85rem;
  }

  .type-count {
    font-size: 0.85rem;
  }
}
</style>
