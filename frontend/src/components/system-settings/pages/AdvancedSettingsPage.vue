<!--
  AdvancedSettingsPage.vue
  Thin wrapper: injects controller and passes props to AdvancedSettingsForm
-->

<template>
  <AdvancedSettingsForm
    :settings="controller.settings.advanced"
    :saving="controller.saving.value"
    @save="controller.saveAdvancedSettings"
  />
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { SETTINGS_CONTROLLER_KEY } from '@/types/system-settings'
import { AdvancedSettingsForm } from '@/components/system-settings'

const controller = inject(SETTINGS_CONTROLLER_KEY)
if (!controller) {
  throw new Error('SystemSettingsController not provided')
}
</script>
