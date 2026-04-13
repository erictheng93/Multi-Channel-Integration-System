<template>
  <header
    class="page-header"
    role="banner"
  >
    <div class="header-content">
      <div class="header-title-section">
        <h1 class="page-title">
          <span class="title-icon">
            <BellIcon />
          </span>
          通知中心
        </h1>
        <p class="page-subtitle">
          管理您的所有通知和提醒
        </p>
      </div>

      <div class="header-actions">
        <button
          v-if="hasUnread"
          class="btn btn-secondary"
          :disabled="markingAllRead"
          @click="$emit('mark-all-read')"
        >
          <CheckAllIcon v-if="!markingAllRead" />
          <LoadingSpinner
            v-else
            size="sm"
          />
          <span>全部標記已讀</span>
        </button>
        <button
          class="btn btn-icon"
          title="通知設定"
          @click="$emit('open-settings')"
        >
          <SettingsIcon />
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { BellIcon, CheckAllIcon, SettingsIcon } from '@/components/icons'
import { LoadingSpinner } from '@/components/ui'

defineProps<{
  hasUnread: boolean
  markingAllRead: boolean
}>()

defineEmits<{
  'mark-all-read': []
  'open-settings': []
}>()
</script>

<style scoped>
/* Header */
.page-header {
  margin-bottom: var(--space-8);
}

.header-content {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-6);
}

.header-title-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.page-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0;
}

.title-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, var(--primary-500), var(--primary-600));
  border-radius: var(--radius-xl);
  color: white;
}

.title-icon svg {
  width: 24px;
  height: 24px;
}

.page-subtitle {
  color: var(--gray-600);
  margin: 0;
  font-size: 1rem;
}

.header-actions {
  display: flex;
  gap: var(--space-3);
}

/* Buttons */
.btn-icon {
  width: 40px;
  height: 40px;
  padding: 0;
  background: var(--gray-100);
  color: var(--gray-600);
  border-radius: var(--radius-lg);
}

.btn-icon:hover {
  background: var(--gray-200);
  color: var(--gray-900);
}

.btn svg {
  width: 18px;
  height: 18px;
}

/* Responsive */
@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    gap: var(--space-4);
  }

  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
