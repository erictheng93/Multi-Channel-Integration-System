<!--
  LineIntegrationPage.vue
  Connection summary, message quota and credential form for the LINE official account.
-->

<template>
  <div class="settings-stack">
    <IntegrationStatusCard
      platform="line"
      title="LINE 官方帳號"
      :status="controller.settings.integrations.line.status"
      :last-test="controller.settings.integrations.line.lastTest"
    />
    <SettingsLineQuota />
    <LineIntegrationForm
      :settings="controller.settings.integrations.line"
      :credentials="controller.credentialStatus.value?.line"
      :saving="controller.saving.value"
      :testing="controller.testing.value"
      @save="controller.saveLineSettings"
      @clear="controller.clearLineCredentials"
      @update:settings="(data) => Object.assign(controller.settings.integrations.line, data)"
    />
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { SETTINGS_CONTROLLER_KEY } from '@/types/system-settings'
import { LineIntegrationForm } from '@/components/system-settings'
import IntegrationStatusCard from '@/components/system-settings/IntegrationStatusCard.vue'
import SettingsLineQuota from '@/components/system-settings/SettingsLineQuota.vue'

const controller = inject(SETTINGS_CONTROLLER_KEY)
if (!controller) {
  throw new Error('SystemSettingsController not provided')
}
</script>

<style scoped>
.settings-stack {
  display: grid;
  gap: 22px;
  min-width: 0;
}
</style>
