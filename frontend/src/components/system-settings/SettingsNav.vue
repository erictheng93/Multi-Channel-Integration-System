<!--
  SettingsNav.vue

  Tab navigation component for System Settings
  Manages tab switching with icons and labels
-->

<template>
  <div class="settings-nav">
    <div class="nav-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="nav-tab"
        :class="{ active: modelValue === tab.key }"
        @click="$emit('update:modelValue', tab.key)"
      >
        <component :is="tab.icon" class="tab-icon" />
        <span class="tab-label">{{ tab.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SettingsTab, TabConfig } from '@/types/system-settings'

// Props
interface Props {
  modelValue: SettingsTab
  tabs: TabConfig[]
}

defineProps<Props>()

// Events
defineEmits<{
  'update:modelValue': [value: SettingsTab]
}>()
</script>

<style scoped>
.settings-nav {
  margin-bottom: 2rem;
}

.nav-tabs {
  display: flex;
  gap: 0.5rem;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 0;
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: transparent;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  color: #718096;
  transition: all 0.2s;
  position: relative;
  bottom: -2px;
}

.nav-tab:hover {
  color: #4299e1;
  background: #edf2f7;
}

.nav-tab.active {
  color: #4299e1;
  border-bottom-color: #4299e1;
  background: #edf2f7;
}

.tab-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.tab-label {
  white-space: nowrap;
}

@media (max-width: 768px) {
  .nav-tabs {
    flex-wrap: wrap;
  }

  .nav-tab {
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
  }

  .tab-icon {
    width: 1rem;
    height: 1rem;
  }
}
</style>
