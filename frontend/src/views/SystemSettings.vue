<!--
  SystemSettings.vue

  Shell layout for System Settings with nested route pages.
  Instantiates the controller once and provides it to all child routes via inject.
  Sub-navigation lives in AppLayout sidebar (expandable menu, like Reports).
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
        <router-view v-slot="{ Component }">
          <transition
            name="settings-fade"
            mode="out-in"
          >
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, provide } from 'vue'
import AppLayout from '@/components/ui/AppLayout.vue'
import { useSystemSettingsController } from '@/composables/useSystemSettingsController'
import { SettingsHeader } from '@/components/system-settings'
import { SETTINGS_CONTROLLER_KEY } from '@/types/system-settings'

// Controller — single instance shared with all child routes
const controller = useSystemSettingsController()
provide(SETTINGS_CONTROLLER_KEY, controller)

// Lifecycle
onMounted(() => controller.initialize())
onUnmounted(() => controller.cleanup())
</script>

<style scoped>
.system-settings {
  max-width: 900px;
  margin: 0 auto;
}

.settings-content {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06);
  padding: 1.5rem 2rem;
  min-height: 400px;
}

/* Page transition */
.settings-fade-enter-active,
.settings-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.settings-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.settings-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 768px) {
  .settings-content {
    padding: 1rem;
    border-radius: 8px;
  }
}
</style>
