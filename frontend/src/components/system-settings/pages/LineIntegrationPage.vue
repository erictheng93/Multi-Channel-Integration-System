<!--
  LineIntegrationPage.vue
  Connection summary, message quota and credential form for the LINE official account,
  with the webhook address and where to find each credential beside them.
-->

<template>
  <SettingsSplit aside-label="設定說明">
    <IntegrationStatusCard
      platform="line"
      title="LINE 官方帳號"
      :status="controller.settings.integrations.line.status"
      :last-test="controller.settings.integrations.line.lastTest"
      testable
      :testing="controller.testing.value"
      :disabled="controller.saving.value"
      @test="controller.testLineIntegration"
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
    <template #aside>
      <LineSetupGuide />
    </template>
  </SettingsSplit>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { SETTINGS_CONTROLLER_KEY } from '@/types/system-settings'
import { LineIntegrationForm } from '@/components/system-settings'
import IntegrationStatusCard from '@/components/system-settings/IntegrationStatusCard.vue'
import LineSetupGuide from '@/components/system-settings/LineSetupGuide.vue'
import SettingsLineQuota from '@/components/system-settings/SettingsLineQuota.vue'
import SettingsSplit from '@/components/system-settings/SettingsSplit.vue'

const controller = inject(SETTINGS_CONTROLLER_KEY)
if (!controller) {
  throw new Error('SystemSettingsController not provided')
}
</script>
