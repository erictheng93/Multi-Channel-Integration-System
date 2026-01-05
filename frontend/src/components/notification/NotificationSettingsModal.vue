<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="visible"
        class="modal-overlay"
        @click.self="$emit('update:visible', false)"
      >
        <div class="settings-modal">
          <header class="modal-header">
            <h2>通知設定</h2>
            <button
              class="modal-close"
              @click="$emit('update:visible', false)"
            >
              <XIcon />
            </button>
          </header>

          <div class="modal-body">
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
          </div>

          <footer class="modal-footer">
            <button
              class="btn btn-secondary"
              @click="$emit('update:visible', false)"
            >
              關閉
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  XIcon,
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
/* Settings Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-4);
}

.settings-modal {
  width: 100%;
  max-width: 520px;
  background: white;
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-2xl);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  border-bottom: 1px solid var(--gray-200);
}

.modal-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--gray-500);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.modal-close:hover {
  background: var(--gray-100);
  color: var(--gray-700);
}

.modal-body {
  padding: var(--space-6);
  max-height: 60vh;
  overflow-y: auto;
}

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

.modal-footer {
  display: flex;
  justify-content: flex-end;
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--gray-200);
}

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

/* Animations */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .settings-modal,
.modal-leave-to .settings-modal {
  transform: scale(0.95) translateY(20px);
}
</style>
