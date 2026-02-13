<!--
  CacheMaintenancePage.vue
  Thin wrapper: injects controller and passes props to CacheManager
-->

<template>
  <CacheManager
    :processing="controller.processing.value"
    @clear-cache="controller.clearCache"
    @health-check="controller.healthCheck"
    @restart="controller.restartSystem"
  />
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { SETTINGS_CONTROLLER_KEY } from '@/types/system-settings'
import { CacheManager } from '@/components/system-settings'

const controller = inject(SETTINGS_CONTROLLER_KEY)
if (!controller) {
  throw new Error('SystemSettingsController not provided')
}
</script>
