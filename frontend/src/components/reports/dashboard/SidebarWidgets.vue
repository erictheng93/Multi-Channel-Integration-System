<template>
  <aside class="sidebar-widgets">
    <div class="widgets-container">
      <!-- 快速操作小部件 -->
      <div
        v-if="$slots['quick-actions']"
        class="widget-wrapper"
      >
        <slot name="quick-actions" />
      </div>

      <!-- 熱門報表類型小部件 -->
      <div
        v-if="$slots['popular-types']"
        class="widget-wrapper"
      >
        <slot name="popular-types" />
      </div>

      <!-- 最近活動小部件 -->
      <div
        v-if="$slots['recent-activity']"
        class="widget-wrapper"
      >
        <slot name="recent-activity" />
      </div>

      <!-- 額外小部件插槽 -->
      <div
        v-if="$slots.default"
        class="widget-wrapper"
      >
        <slot />
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
/**
 * SidebarWidgets Component
 *
 * 侧边栏小部件容器，用于组织和显示各种信息小部件
 *
 * @slot quick-actions - 快速操作小部件插槽
 * @slot popular-types - 热门报表类型小部件插槽
 * @slot recent-activity - 最近活动小部件插槽
 * @slot default - 默认插槽，用于其他自定义小部件
 */
</script>

<style scoped>
.sidebar-widgets {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.widgets-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.widget-wrapper {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

/* Responsive */
@media (max-width: 1024px) {
  .sidebar-widgets {
    display: none;
  }
}

/* Optional: Show widgets in a horizontal layout on tablets */
@media (min-width: 768px) and (max-width: 1024px) {
  .sidebar-widgets {
    display: block;
  }

  .widgets-container {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .widget-wrapper {
    flex: 1 1 calc(50% - 0.75rem);
    min-width: 300px;
  }
}
</style>
