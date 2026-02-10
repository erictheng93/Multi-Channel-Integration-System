<!--
  LineIntegrationPage.vue
  Thin wrapper: injects controller and passes props to LineIntegrationForm
-->

<template>
  <LineIntegrationForm
    :settings="controller.settings.integrations.line"
    :saving="controller.saving.value"
    :testing="controller.testing.value"
    @save="controller.saveLineSettings"
    @test="controller.testLineIntegration"
    @clear="controller.clearLineCredentials"
  />
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { SETTINGS_CONTROLLER_KEY } from '@/types/system-settings'
import { LineIntegrationForm } from '@/components/system-settings'

const controller = inject(SETTINGS_CONTROLLER_KEY)!
</script>
