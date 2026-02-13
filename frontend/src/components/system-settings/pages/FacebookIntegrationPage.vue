<!--
  FacebookIntegrationPage.vue
  Thin wrapper: injects controller and passes props to FacebookIntegrationForm
-->

<template>
  <FacebookIntegrationForm
    :settings="controller.settings.integrations.facebook"
    :saving="controller.saving.value"
    :testing="controller.testing.value"
    @save="controller.saveFacebookSettings"
    @test="controller.testFacebookIntegration"
    @clear="controller.clearFacebookCredentials"
  />
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { SETTINGS_CONTROLLER_KEY } from '@/types/system-settings'
import { FacebookIntegrationForm } from '@/components/system-settings'

const controller = inject(SETTINGS_CONTROLLER_KEY)
if (!controller) {
  throw new Error('SystemSettingsController not provided')
}
</script>
