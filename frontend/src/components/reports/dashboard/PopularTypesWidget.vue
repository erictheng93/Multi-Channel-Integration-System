<template>
  <div class="popular-types-widget">
    <div class="ui-card-head">
      <div>
        <h3 class="ui-card-title">
          熱門報表類型
        </h3>
        <p class="ui-card-sub">
          近 30 天產生次數
        </p>
      </div>
    </div>

    <div
      v-if="popularTypes.length === 0"
      class="empty-text"
    >
      近 30 天沒有產生過報表
    </div>

    <ul
      v-else
      class="types-list"
    >
      <li
        v-for="type in popularTypes"
        :key="type.type"
      >
        <button
          type="button"
          class="type-item"
          @click="$emit('filter-by-type', type.type)"
        >
          <span class="type-header">
            <span class="type-name">{{ type.label }}</span>
            <span class="type-count">{{ type.count }}</span>
          </span>
          <span
            class="progress-bar"
            aria-hidden="true"
          ><i
            class="progress-fill"
            :style="{ width: Math.max(type.percentage, 3) + '%' }"
          /></span>
        </button>
      </li>
    </ul>
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
  getReportTypeIcon: (_type: string) => string
}

defineProps<PopularTypesWidgetProps>()

defineEmits<{
  'filter-by-type': [type: string]
}>()
</script>

<style scoped>
.popular-types-widget {
  padding-bottom: 18px;
}

.empty-text {
  padding: 8px 22px 4px;
  font-size: 13.5px;
  color: var(--ui-muted);
}

.types-list {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0 14px;
  list-style: none;
}

.type-item {
  display: grid;
  width: 100%;
  gap: 6px;
  padding: 8px;
  border: 0;
  border-radius: 10px;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background var(--ui-dur) var(--ui-ease);
}

.type-item:hover {
  background: color-mix(in srgb, var(--ui-fill) 45%, transparent);
}

.type-header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 13.5px;
  font-weight: 500;
}

.type-count {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.progress-bar {
  display: block;
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-fill);
}

.progress-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--ui-accent);
}
</style>
