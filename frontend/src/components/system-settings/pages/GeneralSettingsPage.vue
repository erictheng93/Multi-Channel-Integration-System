<!--
  GeneralSettingsPage.vue
  Thin wrapper: injects controller and passes props to GeneralSettingsForm
-->

<template>
  <GeneralSettingsForm
    :settings="controller.settings.general"
    :saving="controller.saving.value"
    @save="controller.saveGeneralSettings"
  />
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { SETTINGS_CONTROLLER_KEY } from '@/types/system-settings'
import { GeneralSettingsForm } from '@/components/system-settings'

const controller = inject(SETTINGS_CONTROLLER_KEY)!
</script>
