<!--
  DataSubnav.vue
  Pill sub-navigation shared by the data pages (匯出對話 / 備份). 備份 is admin-only, like its route.
-->

<template>
  <nav
    class="subnav"
    aria-label="資料區段"
  >
    <router-link
      to="/data/export"
      class="subnav-item"
      active-class="is-on"
    >
      匯出對話
    </router-link>
    <router-link
      v-if="isAdmin"
      to="/data/backup"
      class="subnav-item"
      active-class="is-on"
    >
      備份
    </router-link>
  </nav>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { storeToRefs } from 'pinia'

const { isAdmin } = storeToRefs(useAuthStore())
</script>

<style scoped>
.subnav {
  display: flex;
  max-width: 100%;
  gap: 4px;
  margin-top: 14px;
  overflow-x: auto;
  scrollbar-width: none;
}

.subnav::-webkit-scrollbar {
  display: none;
}

.subnav-item {
  display: inline-flex;
  align-items: center;
  height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-muted);
  text-decoration: none;
  white-space: nowrap;
  transition:
    background var(--ui-dur) var(--ui-ease),
    color var(--ui-dur) var(--ui-ease);
}

.subnav-item:hover {
  background: var(--ui-fill);
  color: var(--ui-ink-2);
}

.subnav-item.is-on {
  background: var(--ui-accent-soft);
  font-weight: 600;
  color: var(--ui-accent);
}

.subnav-item:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: 1px;
}
</style>
