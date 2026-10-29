<!--
  GeneralSettingsPage.vue
  Thin wrapper: injects controller, passes props to GeneralSettingsForm and shows the live preview beside it
-->

<template>
  <SettingsSplit>
    <GeneralSettingsForm
      :settings="controller.settings.general"
      :saving="controller.saving.value"
      @save="controller.saveGeneralSettings"
      @update:settings="(data) => Object.assign(controller.settings.general, data)"
    />
    <template #aside>
      <GeneralSettingsAside
        :system-name="controller.settings.general.systemName"
        :timezone="controller.settings.general.timezone"
      />
    </template>
  </SettingsSplit>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { SETTINGS_CONTROLLER_KEY } from '@/types/system-settings'
import { GeneralSettingsForm } from '@/components/system-settings'
import GeneralSettingsAside from '@/components/system-settings/GeneralSettingsAside.vue'
import SettingsSplit from '@/components/system-settings/SettingsSplit.vue'

const controller = inject(SETTINGS_CONTROLLER_KEY)
if (!controller) {
  throw new Error('SystemSettingsController not provided')
}
</script>
