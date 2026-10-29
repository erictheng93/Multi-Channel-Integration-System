<template>
  <section class="header-wrap">
    <div class="ui-page-head">
      <div>
        <div class="ui-eyebrow">
          報表
        </div>
        <h1 class="ui-page-title">
          報表總覽
        </h1>
        <p
          v-if="subtitle"
          class="ui-page-sub"
        >
          {{ subtitle }}
        </p>
      </div>
      <div class="ui-page-actions">
        <button
          class="btn btn-secondary"
          :disabled="loading"
          @click="$emit('refresh')"
        >
          {{ loading ? '載入中...' : '重新整理' }}
        </button>
        <button
          class="btn btn-primary"
          @click="$emit('create-report')"
        >
          建立報表
        </button>
      </div>
    </div>
    <ReportsNav />
  </section>
</template>

<script setup lang="ts">
/**
 * DashboardHeader Component
 *
 * @emits refresh - 用户点击刷新按钮
 * @emits create-report - 用户点击创建报表按钮
 */
import ReportsNav from '../ReportsNav.vue'

export interface DashboardHeaderProps {
  /** 是否正在加载 */
  loading?: boolean
  /** One-line summary built from the list summary */
  subtitle?: string
}

withDefaults(defineProps<DashboardHeaderProps>(), {
  loading: false,
  subtitle: ''
})

defineEmits<{
  refresh: []
  'create-report': []
}>()
</script>

<style scoped>
.header-wrap {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
</style>
