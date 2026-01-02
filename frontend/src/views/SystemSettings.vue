<!--
  SystemSettings.refactored.vue

  Refactored System Settings main component
  Uses Controller Pattern + Component Composition architecture

  Size: ~100 lines (down from 1,822 lines)
  Components: 8 reusable components
  Controller: useSystemSettingsController composable
-->

<template>
  <AppLayout>
    <div class="system-settings">
      <SettingsHeader
        :loading="controller.loading.value"
        :message="controller.message.value"
        :message-type="controller.messageType.value"
        @refresh="controller.loadSettings"
      />

      <div class="settings-content">
        <SettingsNav
          v-model="controller.activeTab.value"
          :tabs="controller.tabs.value"
        />

        <div class="settings-panel">
          <!-- General Settings Tab -->
          <GeneralSettingsForm
            v-if="controller.activeTab.value === 'general'"
            :settings="controller.settings.general"
            :saving="controller.saving.value"
            @save="controller.saveGeneralSettings"
          />

          <!-- Integrations Tab -->
          <div v-if="controller.activeTab.value === 'integrations'" class="integrations-container">
            <LineIntegrationForm
              :settings="controller.settings.integrations.line"
              :saving="controller.saving.value"
              :testing="controller.testing.value"
              @save="controller.saveLineSettings"
              @test="controller.testLineIntegration"
              @clear="controller.clearLineCredentials"
            />

            <FacebookIntegrationForm
              :settings="controller.settings.integrations.facebook"
              :saving="controller.saving.value"
              :testing="controller.testing.value"
              @save="controller.saveFacebookSettings"
              @test="controller.testFacebookIntegration"
              @clear="controller.clearFacebookCredentials"
            />
          </div>

          <!-- Advanced Settings Tab -->
          <AdvancedSettingsForm
            v-if="controller.activeTab.value === 'advanced'"
            :settings="controller.settings.advanced"
            :saving="controller.saving.value"
            @save="controller.saveAdvancedSettings"
          />

          <!-- System Maintenance Tab -->
          <div v-if="controller.activeTab.value === 'system'" class="system-container">
            <BackupManager
              :backups="controller.backups.value"
              :processing="controller.processing.value"
              @backup="controller.backupDatabase"
              @restore="controller.restoreDatabase"
              @backup-credentials="controller.backupCredentials"
            />

            <CacheManager
              :processing="controller.processing.value"
              @clear-cache="controller.clearCache"
              @health-check="controller.healthCheck"
              @restart="controller.restartSystem"
            />
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import AppLayout from '@/components/ui/AppLayout.vue'
import { useSystemSettingsController } from '@/composables/useSystemSettingsController'
import {
  SettingsHeader,
  SettingsNav,
  GeneralSettingsForm,
  LineIntegrationForm,
  FacebookIntegrationForm,
  AdvancedSettingsForm,
  BackupManager,
  CacheManager
} from '@/components/system-settings'

// Controller
const controller = useSystemSettingsController()

// Lifecycle
onMounted(() => controller.initialize())
onUnmounted(() => controller.cleanup())
</script>

<style scoped>
.system-settings {
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

.settings-content {
  display: flex;
  flex-direction: column;
}

.settings-panel {
  min-height: 400px;
}

.integrations-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.system-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

@media (max-width: 768px) {
  .system-settings {
    padding: 1rem;
  }
}
</style>
