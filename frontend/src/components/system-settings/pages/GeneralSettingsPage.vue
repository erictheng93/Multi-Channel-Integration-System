<!--
  GeneralSettingsPage.vue
  Thin wrapper: injects controller, passes props to GeneralSettingsForm and shows the live preview beside it
-->

<template>
  <div class="general-split">
    <GeneralSettingsForm
      :settings="controller.settings.general"
      :saving="controller.saving.value"
      @save="controller.saveGeneralSettings"
      @update:settings="(data) => Object.assign(controller.settings.general, data)"
    />
    <aside
      class="general-aside"
      aria-label="說明與預覽"
    >
      <GeneralSettingsAside
        :system-name="controller.settings.general.systemName"
        :timezone="controller.settings.general.timezone"
      />
    </aside>
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { SETTINGS_CONTROLLER_KEY } from '@/types/system-settings'
import { GeneralSettingsForm } from '@/components/system-settings'
import GeneralSettingsAside from '@/components/system-settings/GeneralSettingsAside.vue'

const controller = inject(SETTINGS_CONTROLLER_KEY)
if (!controller) {
  throw new Error('SystemSettingsController not provided')
}
</script>

<style scoped>
/* Own layout (not SettingsSplit): the aside card stretches so both columns end together */
.general-split {
  display: grid;
  grid-template-columns: minmax(0, 720px) minmax(0, 1fr);
  gap: 22px;
  align-items: stretch;
  min-width: 0;
}

.general-aside {
  display: grid;
  min-width: 0;
  /* line the card up with the first form card, below its group caption */
  padding-top: 28px;
}

@media (max-width: 1024px) {
  .general-split {
    grid-template-columns: minmax(0, 1fr);
  }

  .general-aside {
    padding-top: 0;
  }
}
</style>
