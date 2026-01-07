<template>
  <Modal
    :show="visible"
    title="通知設定"
    size="md"
    @close="$emit('update:visible', false)"
  >
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
import { computed } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import {
  BellIcon,
  VolumeIcon,
  MailIcon,
  MessageIcon,
  UserPlusIcon,
  AtSignIcon
} from '@/components/icons'

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

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border: none;
  border-radius: var(--radius-lg);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-secondary {
  background: var(--gray-100);
  color: var(--gray-700);
}

.btn-secondary:hover {
  background: var(--gray-200);
}
</style>
