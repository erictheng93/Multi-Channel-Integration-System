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
        :tile="!brand"
      >
        <template #title>
          <span
            v-if="brand"
            class="brand-tile"
            :class="`is-${brand}`"
            aria-hidden="true"
          >
            <svg
              v-if="brand === 'line'"
              viewBox="0 0 24 24"
            ><path d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.7 6.2L5 21l4.1-2.3c.9.2 1.9.3 2.9.3 5.5 0 10-3.6 10-8s-4.5-8-10-8Z" /></svg>
            <svg
              v-else
              viewBox="0 0 24 24"
            ><path d="M12 2C6.4 2 2 6.1 2 11.7c0 2.9 1.2 5.4 3.2 7.2V22l3-1.6c1.2.3 2.4.5 3.8.5 5.6 0 10-4.1 10-9.7S17.6 2 12 2Zm1 12.4-2.6-2.7-5 2.7 5.5-5.8 2.6 2.7 4.9-2.7Z" /></svg>
          </span>{{ section?.title ?? '系統設定' }}
        </template>
        <template
          v-if="section && section.key === 'health'"
          #actions
        >
          <button
            type="button"
            class="btn btn-primary"
            :aria-busy="controller.processing.value || undefined"
            @click="!controller.processing.value && controller.healthCheck(true)"
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
          :class="{ 'is-narrow': isNarrow }"
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

      <Transition name="settings-bar">
        <UiActionBar
          v-if="isForm && (dirty || controller.saving.value)"
          class="settings-actions"
          label="儲存設定"
        >
          <span class="settings-state">有尚未儲存的變更</span>
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
      </Transition>
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
/** The two integration pages wear their platform's mark instead of the generic gear */
const brand = computed<'line' | 'facebook' | null>(() => {
  const key = section.value?.key
  return key === 'line' || key === 'facebook' ? key : null
})

const isForm = computed(() => !!section.value && section.value.key !== 'health')
// Facebook and advanced keep one readable column; general and LINE lay out a context column beside it
const isNarrow = computed(() => section.value?.key === 'facebook' || section.value?.key === 'advanced')

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

.brand-tile {
  display: inline-grid;
  flex: none;
  place-items: center;
  width: 40px;
  height: 40px;
  margin-right: 14px;
  border-radius: 11px;
  vertical-align: middle;
  box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.08);
}
.brand-tile.is-line {
  background: var(--ui-line);
}
.brand-tile.is-facebook {
  background: var(--ui-messenger);
}
.brand-tile svg {
  width: 24px;
  height: 24px;
  fill: #fff;
}
@media (max-width: 768px) {
  .brand-tile {
    width: 34px;
    height: 34px;
    margin-right: 11px;
    border-radius: 10px;
  }
  .brand-tile svg {
    width: 21px;
    height: 21px;
  }
}

/* the check button is an action, not a banner: on the phone it sits on the title row at its natural width */
@media (max-width: 768px) {
  .system-settings :deep(.ui-page-head) {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'crumb crumb'
      'title actions'
      'sub sub';
  }

  .system-settings :deep(.ui-page-actions) {
    padding-top: 0;
  }

  .system-settings :deep(.ui-page-actions) {
    justify-content: flex-end;
  }

  .system-settings :deep(.ui-page-actions > .btn) {
    flex: none;
    width: auto;
  }
}

@media (min-width: 769px) {
  .settings-actions {
    position: sticky;
    bottom: 16px;
    z-index: 4;
    padding: 10px 14px 10px 20px;
    border-radius: 18px;
    background: var(--ui-glass);
    box-shadow: var(--ui-shadow-raised);
    backdrop-filter: saturate(180%) blur(20px);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
  }
}

.settings-state {
  margin-right: auto;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-orange-ink);
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

/* Save bar appears only once something changed */
.settings-bar-enter-active,
.settings-bar-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.settings-bar-enter-from,
.settings-bar-leave-to {
  opacity: 0;
  transform: translateY(8px);
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
