<!--
  LineIntegrationPage.vue
  The LINE official account: the message path (signature visual) on top, credentials | webhook steps below,
  a quiet danger row last. Phone: one column in that order.
-->

<template>
  <div class="line-page">
    <LineSignalPath class="item-path" />

    <div class="col col-a">
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
      <aside
        class="item-webhook"
        aria-label="Webhook 設定步驟"
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
import LineDangerZone from '@/components/system-settings/LineDangerZone.vue'
import LineSetupGuide from '@/components/system-settings/LineSetupGuide.vue'
import LineSignalPath from '@/components/system-settings/LineSignalPath.vue'

const controller = inject(SETTINGS_CONTROLLER_KEY)
if (!controller) {
  throw new Error('SystemSettingsController not provided')
}

const hasStoredCredentials = computed(() => {
  const creds = controller.credentialStatus.value?.line
  return creds ? Object.values(creds).some(field => field.configured) : false
})
</script>

<style scoped>
.line-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 520px);
  gap: 22px;
  align-items: stretch;
  min-width: 0;
}

.item-path,
.item-danger {
  grid-column: 1 / -1;
}

.col {
  display: contents;
}

.item-webhook,
.item-cred {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

@media (max-width: 1024px) {
  .line-page {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
