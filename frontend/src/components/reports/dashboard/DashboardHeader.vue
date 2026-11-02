<template>
  <UiPageHead
    title="報表總覽"
    :subtitle="subtitle"
  >
    <template #actions>
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
    </template>
  </UiPageHead>
  <UiSectionNav section="reports" />
</template>

<script setup lang="ts">
/**
 * DashboardHeader Component
 *
 * @emits refresh - 用户点击刷新按钮
 * @emits create-report - 用户点击创建报表按钮
 */
import UiPageHead from '@/components/ui/UiPageHead.vue'
import UiSectionNav from '@/components/ui/UiSectionNav.vue'

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
