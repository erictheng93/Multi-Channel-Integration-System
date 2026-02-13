<!--
  BackupPage.vue
  Thin wrapper: injects controller and passes props to BackupManager
-->

<template>
  <BackupManager
    :backups="controller.backups.value"
    :processing="controller.processing.value"
    @backup="controller.backupDatabase"
    @restore="controller.restoreDatabase"
    @backup-credentials="controller.backupCredentials"
  />
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { SETTINGS_CONTROLLER_KEY } from '@/types/system-settings'
import { BackupManager } from '@/components/system-settings'

const controller = inject(SETTINGS_CONTROLLER_KEY)
if (!controller) {
  throw new Error('SystemSettingsController not provided')
}
</script>
