<!--
  FacebookIntegrationPage.vue
  Connection summary and credential form for the Facebook Messenger page.
-->

<template>
  <div class="settings-stack">
    <IntegrationStatusCard
      platform="facebook"
      title="Facebook Messenger"
      :status="controller.settings.integrations.facebook.status"
      :last-test="controller.settings.integrations.facebook.lastTest"
      testable
      :testing="controller.testing.value"
      :disabled="controller.saving.value"
      @test="controller.testFacebookIntegration"
    />
    <FacebookIntegrationForm
      :settings="controller.settings.integrations.facebook"
      :credentials="controller.credentialStatus.value?.facebook"
      :saving="controller.saving.value"
      :testing="controller.testing.value"
      @save="controller.saveFacebookSettings"
      @clear="controller.clearFacebookCredentials"
      @update:settings="(data) => Object.assign(controller.settings.integrations.facebook, data)"
    />
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { SETTINGS_CONTROLLER_KEY } from '@/types/system-settings'
import { FacebookIntegrationForm } from '@/components/system-settings'
import IntegrationStatusCard from '@/components/system-settings/IntegrationStatusCard.vue'

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
