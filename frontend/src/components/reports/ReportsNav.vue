<template>
  <nav
    class="ui-seg reports-nav"
    aria-label="報表分頁"
  >
    <button
      v-for="tab in tabs"
      :key="tab.to"
      type="button"
      :aria-pressed="isActive(tab.to)"
      @click="go(tab.to)"
    >
      {{ tab.label }}
    </button>
  </nav>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const tabs = [
  { label: '總覽', to: '/reports/dashboard' },
  { label: '模板', to: '/reports/templates' },
  { label: '產生報表', to: '/reports/generate' }
]

function isActive(to: string): boolean {
  return route.path === to
}

function go(to: string) {
  if (route.path !== to) {
    void router.push(to)
  }
}
</script>

<style scoped>
.reports-nav {
  align-self: flex-start;
}

@media (max-width: 768px) {
  .reports-nav {
    align-self: stretch;
  }

  .reports-nav > button {
    flex: 1;
    justify-content: center;
    min-height: 44px;
  }
}
</style>
