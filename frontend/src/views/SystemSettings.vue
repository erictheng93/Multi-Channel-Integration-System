<!--
  SystemSettings.vue

  Shared settings layout: page head (title and actions per section), section rail, content column.
  Instantiates the controller once and provides it to all child routes via inject.
-->

<template>
  <AppLayout>
    <div class="ui-page system-settings">
      <UiPageHead
        :subtitle="section ? section.subtitle : ''"
      >
        <template #title>
          {{ section?.title ?? '系統設定' }}
        </template>
        <template
          v-if="section && (section.key === 'health' || section.key === 'line' || section.key === 'facebook')"
          #actions
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
          <template v-else-if="section.key === 'line' || section.key === 'facebook'">
            <button
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
          </template>
        </template>
      </UiPageHead>

      <UiSectionNav section="settings" />

      <div
        v-if="controller.message.value"
        class="settings-message"
        :class="`is-${controller.messageType.value}`"
        role="status"
      >
        {{ controller.message.value }}
      </div>

      <div class="settings">
        <div
          class="scontent"
          :class="{ 'is-narrow': isForm }"
        >
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

      <UiActionBar
        v-if="isForm"
        class="settings-actions"
        label="儲存設定"
      >
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="!dirty || controller.saving.value || controller.loading.value"
          @click="controller.loadSettings"
        >
          還原
        </button>
        <button
          type="submit"
          class="btn btn-primary"
          :form="SETTINGS_FORM_ID"
          :disabled="!dirty || controller.saving.value || controller.testing.value"
        >
          {{ controller.saving.value ? '儲存中...' : '儲存變更' }}
        </button>
      </UiActionBar>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import UiPageHead from '@/components/ui/UiPageHead.vue'
import UiSectionNav from '@/components/ui/UiSectionNav.vue'
import UiActionBar from '@/components/ui/UiActionBar.vue'
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/components/ui/AppLayout.vue'
import { useSystemSettingsController } from '@/composables/useSystemSettingsController'
import { SETTINGS_FORM_ID, findSettingsSection } from '@/components/system-settings/settings-pages'
import { SETTINGS_CONTROLLER_KEY } from '@/types/system-settings'

// Controller — single instance shared with all child routes
const controller = useSystemSettingsController()
provide(SETTINGS_CONTROLLER_KEY, controller)

const route = useRoute()
const section = computed(() => findSettingsSection(route.name))

// Pages with a form and a save button (everything but the health check)
const isForm = computed(() => !!section.value && section.value.key !== 'health')

// Dirty tracking: general/advanced compare against the last loaded or saved values;
// the credential pages are dirty once something has been typed into a credential field.
function valuesSnapshot(): string {
  return JSON.stringify({ g: controller.settings.general, a: controller.settings.advanced })
}
const baseline = ref(valuesSnapshot())
const credentialsTyped = computed(() => {
  const key = section.value?.key
  if (key === 'line') {
    const l = controller.settings.integrations.line
    return [l.channelId, l.channelSecret, l.accessToken].some(v => !!v)
  }
  if (key === 'facebook') {
    const f = controller.settings.integrations.facebook
    return [f.appId, f.appSecret, f.pageId, f.pageToken].some(v => !!v)
  }
  return false
})
const dirty = computed(() => {
  const key = section.value?.key
  if (key === 'general' || key === 'advanced') {
    return valuesSnapshot() !== baseline.value
  }
  return credentialsTyped.value
})
watch(controller.loading, (now) => {
  if (!now) { baseline.value = valuesSnapshot() }
})
watch(controller.saving, (now) => {
  if (!now && controller.messageType.value === 'success') { baseline.value = valuesSnapshot() }
})

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

.settings {
  min-width: 0;
}

.scontent {
  display: grid;
  gap: 22px;
  min-width: 0;
}

@media (min-width: 769px) {
  .settings-actions {
    max-width: 720px;
  }
}

/* Form pages: one readable column instead of a 500px gap between label and control */
.scontent.is-narrow {
  max-width: 720px;
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

</style>
