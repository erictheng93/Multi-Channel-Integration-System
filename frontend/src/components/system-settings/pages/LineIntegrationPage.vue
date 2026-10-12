<!--
  LineIntegrationPage.vue
  Thin wrapper: injects controller and passes props to LineIntegrationForm
-->

<template>
  <div class="line-integration-page">
    <LineQuotaCard />
    <LineIntegrationForm
      :settings="controller.settings.integrations.line"
      :saving="controller.saving.value"
      :testing="controller.testing.value"
      @save="controller.saveLineSettings"
      @test="controller.testLineIntegration"
      @clear="controller.clearLineCredentials"
      @update:settings="(data) => Object.assign(controller.settings.integrations.line, data)"
    />
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { SETTINGS_CONTROLLER_KEY } from '@/types/system-settings'
import { LineIntegrationForm } from '@/components/system-settings'
import LineQuotaCard from '@/components/broadcast/LineQuotaCard.vue'

const controller = inject(SETTINGS_CONTROLLER_KEY)
if (!controller) {
  throw new Error('SystemSettingsController not provided')
}
</script>

<style scoped>
.line-integration-page {
  display: grid;
  gap: var(--space-6);
}
</style>
