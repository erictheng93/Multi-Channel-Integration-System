<!--
  SystemSettings.vue

  Shared settings layout: page head (title and actions per section), section rail, content column.
  Instantiates the controller once and provides it to all child routes via inject.
-->

<template>
  <AppLayout>
    <div class="system-settings">
      <header class="ui-page-head">
        <div>
          <div class="ui-eyebrow">
            系統設定
          </div>
          <h1 class="ui-page-title">
            {{ section?.title ?? '系統設定' }}
          </h1>
          <p
            v-if="section"
            class="ui-page-sub"
          >
            {{ section.subtitle }}
          </p>
        </div>
        <div
          v-if="section"
          class="ui-page-actions"
        >
          <template v-if="section.key === 'health'">
            <button
              type="button"
              class="btn btn-primary"
              :disabled="controller.processing.value"
              @click="controller.healthCheck(true)"
            >
              <svg
                class="act-ico"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              ><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
              {{ controller.processing.value ? '檢查中...' : '立即檢查' }}
            </button>
          </template>
          <template v-else>
            <button
              v-if="section.key === 'line' || section.key === 'facebook'"
              type="button"
              class="btn btn-secondary"
              :disabled="controller.testing.value || controller.saving.value"
              @click="testConnection"
            >
              <svg
                class="act-ico"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              ><path d="M5 12.5 10 17.5 19 7" /></svg>
              {{ controller.testing.value ? '測試中...' : '測試連線' }}
            </button>
            <button
              v-else
              type="button"
              class="btn btn-secondary"
              :disabled="controller.loading.value"
              @click="controller.loadSettings"
            >
              <svg
                class="act-ico"
                :class="{ spinning: controller.loading.value }"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              ><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M3 21v-5h5" /></svg>
              重新載入
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              :form="SETTINGS_FORM_ID"
              :disabled="controller.saving.value || controller.testing.value"
            >
              {{ controller.saving.value ? '儲存中...' : '儲存變更' }}
            </button>
          </template>
        </div>
      </header>

      <div
        v-if="controller.message.value"
        class="settings-message"
        :class="`is-${controller.messageType.value}`"
        role="status"
      >
        {{ controller.message.value }}
      </div>

      <div class="settings">
        <SettingsRail />
        <div class="scontent">
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
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/components/ui/AppLayout.vue'
import { useSystemSettingsController } from '@/composables/useSystemSettingsController'
import SettingsRail from '@/components/system-settings/SettingsRail.vue'
import { SETTINGS_FORM_ID, findSettingsSection } from '@/components/system-settings/settings-pages'
import { SETTINGS_CONTROLLER_KEY } from '@/types/system-settings'

// Controller — single instance shared with all child routes
const controller = useSystemSettingsController()
provide(SETTINGS_CONTROLLER_KEY, controller)

const route = useRoute()
const section = computed(() => findSettingsSection(route.name))

function testConnection(): void {
  if (section.value?.key === 'facebook') {
    void controller.testFacebookIntegration()
  } else {
    void controller.testLineIntegration()
  }
}

// Lifecycle
onMounted(() => controller.initialize())
onUnmounted(() => controller.cleanup())
</script>

<style scoped>
.system-settings {
  /* .page-content is a flex column: max-width + auto margins alone size to the content, so a long
     header pushed the page wider than the phone viewport */
  display: grid;
  gap: 20px;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
}

.settings {
  display: grid;
  grid-template-columns: 232px minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.scontent {
  display: grid;
  gap: 22px;
  min-width: 0;
}

.act-ico {
  width: 16px;
  height: 16px;
}

.act-ico.spinning {
  animation: settings-spin 0.8s linear infinite;
}

@keyframes settings-spin {
  to {
    transform: rotate(360deg);
  }
}

.settings-message {
  position: fixed;
  bottom: 24px;
  left: 50%;
  z-index: 40;
  max-width: calc(100vw - 32px);
  padding: 10px 18px;
  border-radius: 999px;
  box-shadow: var(--ui-shadow-raised);
  transform: translateX(-50%);
  background: var(--ui-surface);
  font-size: 13.5px;
  font-weight: 500;
  color: var(--ui-green-ink);
}

.settings-message.is-error {
  color: var(--ui-red-ink);
}

.settings-message.is-info {
  color: var(--ui-accent);
}

/* Page transition */
.settings-fade-enter-active,
.settings-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.settings-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.settings-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 1024px) {
  .settings {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
