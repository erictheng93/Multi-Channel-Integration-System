<template>
  <Modal
    :show="visible"
    title="通知設定"
    size="md"
    @close="$emit('update:visible', false)"
  >
    <!-- Desktop Notifications (per-device) -->
    <div class="settings-group">
      <h3 class="settings-group-title">
        桌面通知（此裝置）
      </h3>

      <p
        v-if="desktopPermission === 'unsupported'"
        data-testid="desktop-unsupported-hint"
        class="desktop-hint"
      >
        此瀏覽器不支援桌面通知（需使用 HTTPS 與支援通知的瀏覽器）。
      </p>

      <template v-else-if="desktopPermission === 'default'">
        <p class="desktop-hint">
          啟用後，收到新客戶訊息時會跳出桌面通知（僅在此裝置生效）。
        </p>
        <button
          data-testid="desktop-enable-btn"
          class="btn btn-primary"
          @click="onEnableDesktop"
        >
          啟用桌面通知
        </button>
      </template>

      <p
        v-else-if="desktopPermission === 'denied'"
        data-testid="desktop-denied-hint"
        class="desktop-hint"
      >
        桌面通知已被瀏覽器封鎖，無法由系統重新開啟。請點擊網址列左側的鎖頭（或設定）圖示 → 網站設定 → 通知 → 改為「允許」，再重新整理頁面。若仍未跳出通知，請檢查 Windows「設定 → 系統 → 通知」已允許瀏覽器，且未開啟「專注助理」。
      </p>

      <!-- granted -->
      <template v-else>
        <label class="settings-toggle">
          <span class="toggle-label">
            <MonitorIcon class="toggle-icon" />
            <span>
              <strong>桌面通知</strong>
              <small>收到新客戶訊息時跳出系統通知</small>
            </span>
          </span>
          <input
            data-testid="desktop-enabled-toggle"
            type="checkbox"
            class="toggle-input"
            :checked="desktopPrefs.enabled"
            @change="onToggleDesktopEnabled(($event.target as HTMLInputElement).checked)"
          >
          <span class="toggle-switch" />
        </label>

        <label class="settings-toggle">
          <span class="toggle-label">
            <BellIcon class="toggle-icon" />
            <span>
              <strong>只提醒我所屬團隊</strong>
              <small>僅指派給我所屬團隊的對話才通知；關閉則所有對話都通知</small>
            </span>
          </span>
          <input
            data-testid="desktop-scope-toggle"
            type="checkbox"
            class="toggle-input"
            :checked="desktopPrefs.scope === 'my-teams'"
            @change="setDesktopPrefs({ scope: ($event.target as HTMLInputElement).checked ? 'my-teams' : 'all' })"
          >
          <span class="toggle-switch" />
        </label>

        <label class="settings-toggle">
          <span class="toggle-label">
            <VolumeIcon class="toggle-icon" />
            <span>
              <strong>通知音效（此裝置）</strong>
              <small>桌面通知時播放提示音</small>
            </span>
          </span>
          <input
            data-testid="desktop-sound-toggle"
            type="checkbox"
            class="toggle-input"
            :checked="desktopPrefs.soundEnabled"
            @change="setDesktopPrefs({ soundEnabled: ($event.target as HTMLInputElement).checked })"
          >
          <span class="toggle-switch" />
        </label>

        <!-- 瀏覽器權限為 granted 時，作業系統仍可能擋下通知（例如 Windows 關閉了 Chrome 的通知），
             頁面偵測不到，只能讓使用者自己驗證 -->
        <div class="desktop-test">
          <p
            data-testid="desktop-os-hint"
            class="desktop-hint"
          >
            看不到通知？請到 Windows「設定 → 系統 → 通知」，確認 Google Chrome（或 Microsoft Edge）已開啟，且未開啟「勿擾／專注助理」。
          </p>
          <button
            data-testid="desktop-test-btn"
            class="btn btn-secondary"
            @click="sendTestNotification"
          >
            發送測試通知
          </button>
          <p
            v-if="testSent"
            data-testid="desktop-test-sent"
            class="desktop-hint desktop-test-sent"
          >
            已送出。若右下角沒有出現，代表通知被 Windows 擋下，請依上方說明調整。
          </p>
        </div>
      </template>
    </div>

    <!-- Settings Groups -->
    <div class="settings-group">
      <h3 class="settings-group-title">
        通知偏好
      </h3>

      <label class="settings-toggle">
        <span class="toggle-label">
          <BellIcon class="toggle-icon" />
          <span>
            <strong>推送通知</strong>
            <small>在瀏覽器接收即時通知</small>
          </span>
        </span>
        <input
          v-model="localSettings.pushEnabled"
          type="checkbox"
          class="toggle-input"
          @change="$emit('save')"
        >
        <span class="toggle-switch" />
      </label>

      <label class="settings-toggle">
        <span class="toggle-label">
          <VolumeIcon class="toggle-icon" />
          <span>
            <strong>通知音效</strong>
            <small>收到通知時播放提示音</small>
          </span>
        </span>
        <input
          v-model="localSettings.soundEnabled"
          type="checkbox"
          class="toggle-input"
          @change="$emit('save')"
        >
        <span class="toggle-switch" />
      </label>

      <label class="settings-toggle">
        <span class="toggle-label">
          <MailIcon class="toggle-icon" />
          <span>
            <strong>郵件通知</strong>
            <small>重要通知發送至郵箱</small>
          </span>
        </span>
        <input
          v-model="localSettings.emailEnabled"
          type="checkbox"
          class="toggle-input"
          @change="$emit('save')"
        >
        <span class="toggle-switch" />
      </label>
    </div>

    <div class="settings-group">
      <h3 class="settings-group-title">
        通知類型
      </h3>

      <label class="settings-toggle">
        <span class="toggle-label">
          <MessageIcon class="toggle-icon" />
          <span>
            <strong>新訊息通知</strong>
            <small>收到新客戶訊息時通知</small>
          </span>
        </span>
        <input
          v-model="localSettings.messageEnabled"
          type="checkbox"
          class="toggle-input"
          @change="$emit('save')"
        >
        <span class="toggle-switch" />
      </label>

      <label class="settings-toggle">
        <span class="toggle-label">
          <UserPlusIcon class="toggle-icon" />
          <span>
            <strong>指派通知</strong>
            <small>對話指派給您時通知</small>
          </span>
        </span>
        <input
          v-model="localSettings.assignmentEnabled"
          type="checkbox"
          class="toggle-input"
          @change="$emit('save')"
        >
        <span class="toggle-switch" />
      </label>

      <label class="settings-toggle">
        <span class="toggle-label">
          <AtSignIcon class="toggle-icon" />
          <span>
            <strong>提及通知</strong>
            <small>被同事提及時通知</small>
          </span>
        </span>
        <input
          v-model="localSettings.mentionEnabled"
          type="checkbox"
          class="toggle-input"
          @change="$emit('save')"
        >
        <span class="toggle-switch" />
      </label>
    </div>

    <!-- Footer Actions -->
    <template #footer>
      <button
        class="btn btn-secondary"
        @click="$emit('update:visible', false)"
      >
        關閉
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import {
  BellIcon,
  VolumeIcon,
  MailIcon,
  MessageIcon,
  UserPlusIcon,
  AtSignIcon
} from '@/components/icons'
// MonitorIcon is not exported from the '@/components/icons' barrel (only as a standalone SFC);
// import it directly, matching the existing pattern in SidebarNav.vue.
import MonitorIcon from '@/components/icons/MonitorIcon.vue'
import { useDesktopNotificationPrefs } from '@/composables/notification/useDesktopNotificationPrefs'

const props = defineProps<{
  visible: boolean
  settings: {
    pushEnabled: boolean
    soundEnabled: boolean
    emailEnabled: boolean
    messageEnabled: boolean
    assignmentEnabled: boolean
    mentionEnabled: boolean
  }
}>()

defineEmits<{
  'update:visible': [value: boolean]
  save: []
}>()

const localSettings = computed(() => props.settings)

const {
  prefs: desktopPrefs,
  setPrefs: setDesktopPrefs,
  permission: desktopPermission,
  refreshPermission,
  requestDesktopPermission
} = useDesktopNotificationPrefs()

// 開啟 Modal 時重新讀取權限(使用者可能已在瀏覽器設定變更)
watch(() => props.visible, (visible) => {
  if (visible) {
    refreshPermission()
  }
})

const testSent = ref(false)

// 開啟當下自動送一則測試通知：瀏覽器權限 granted 不代表系統會顯示，只能讓使用者親眼確認
const onEnableDesktop = async (): Promise<void> => {
  const result = await requestDesktopPermission()
  if (result === 'granted') {
    setDesktopPrefs({ enabled: true })
    sendTestNotification()
  }
}

const onToggleDesktopEnabled = (enabled: boolean): void => {
  setDesktopPrefs({ enabled })
  if (enabled) {
    sendTestNotification()
  }
}

const sendTestNotification = (): void => {
  try {
    new window.Notification('測試通知', {
      body: '看到這則代表此裝置的桌面通知正常',
      tag: 'desktop-notification-test'
    })
  } catch {
    // 建構失敗與被系統擋下的處理相同：提示使用者檢查系統設定
  }
  testSent.value = true
}
</script>

<style scoped>
/* Settings Groups */

.settings-group {
  margin-bottom: var(--space-6);
}

.settings-group:last-child {
  margin-bottom: 0;
}

.settings-group-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--gray-500);
  margin: 0 0 var(--space-4);
}

.settings-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  margin-bottom: var(--space-2);
  background: var(--gray-50);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.settings-toggle:hover {
  background: var(--gray-100);
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.toggle-icon {
  width: 20px;
  height: 20px;
  color: var(--gray-500);
}

.toggle-label span {
  display: flex;
  flex-direction: column;
}

.toggle-label strong {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--gray-900);
}

.toggle-label small {
  font-size: 0.8125rem;
  color: var(--gray-500);
}

.toggle-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-switch {
  position: relative;
  width: 44px;
  height: 24px;
  background: var(--gray-300);
  border-radius: 12px;
  transition: background var(--transition-fast);
  flex-shrink: 0;
}

.toggle-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-sm);
  transition: transform var(--transition-fast);
}

.toggle-input:checked + .toggle-switch {
  background: var(--primary-500);
}

.toggle-input:checked + .toggle-switch::after {
  transform: translateX(20px);
}

.desktop-hint {
  font-size: 0.8125rem;
  color: var(--gray-500);
  margin: 0 0 var(--space-3);
  line-height: 1.6;
}

.desktop-test {
  padding: var(--space-4);
  background: var(--gray-50);
  border-radius: var(--radius-lg);
}

.desktop-test-sent {
  margin: var(--space-3) 0 0;
}

</style>
