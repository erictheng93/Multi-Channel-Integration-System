<!--
  LineIntegrationPage.vue
  Connection summary, message quota and credentials for the LINE official account.
  Desktop: two columns that end together (status + credentials | quota + webhook), danger zone full width last.
  Phone: one column in reading order, danger zone always the last block.
-->

<template>
  <div class="line-page">
    <div class="col col-a">
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
      <LineIntegrationForm
        class="item-cred"
        :settings="controller.settings.integrations.line"
        :credentials="controller.credentialStatus.value?.line"
        :saving="controller.saving.value"
        :testing="controller.testing.value"
        @save="controller.saveLineSettings"
        @update:settings="(data) => Object.assign(controller.settings.integrations.line, data)"
      />
    </div>
    <div class="col col-b">
      <SettingsLineQuota />
      <aside
        class="item-webhook"
        aria-label="Webhook 設定"
      >
        <LineSetupGuide />
      </aside>
    </div>
    <LineDangerZone
      v-if="hasStoredCredentials"
      class="item-danger"
      :disabled="controller.saving.value || controller.testing.value"
      @clear="controller.clearLineCredentials"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { SETTINGS_CONTROLLER_KEY } from '@/types/system-settings'
import { LineIntegrationForm } from '@/components/system-settings'
import IntegrationStatusCard from '@/components/system-settings/IntegrationStatusCard.vue'
import LineDangerZone from '@/components/system-settings/LineDangerZone.vue'
import LineSetupGuide from '@/components/system-settings/LineSetupGuide.vue'
import SettingsLineQuota from '@/components/system-settings/SettingsLineQuota.vue'

const controller = inject(SETTINGS_CONTROLLER_KEY)
if (!controller) {
  throw new Error('SystemSettingsController not provided')
}

const hasStoredCredentials = computed(() => {
  const creds = controller.credentialStatus.value?.line
  return !!creds && Object.values(creds).some(field => field.configured)
})
</script>

<style scoped>
.line-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 420px);
  gap: 22px;
  align-items: start;
  min-width: 0;
}

.col {
  display: grid;
  gap: 22px;
  min-width: 0;
}

.item-webhook {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.item-danger {
  grid-column: 1 / -1;
}

@media (max-width: 1024px) {
  .line-page {
    grid-template-columns: minmax(0, 1fr);
  }

  /* reading order on one column: status, credentials, quota, webhook, danger zone last */
  .col-a,
  .col-b {
    display: contents;
  }
}
</style>
