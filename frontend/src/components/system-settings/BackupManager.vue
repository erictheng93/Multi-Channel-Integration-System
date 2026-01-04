<!--
  BackupManager.vue

  Database backup and restore management component
  Handles backup creation, restoration, and credentials backup
-->

<template>
  <div class="backup-manager">
    <div class="manager-header">
      <div>
        <h3 class="manager-title">
          {{ t('systemSettings.system.backup.title') }}
        </h3>
        <p class="manager-description">
          {{ t('systemSettings.system.backup.description') }}
        </p>
      </div>
      <button
        class="btn-primary"
        :disabled="processing"
        @click="handleBackup"
      >
        <span
          v-if="processing"
          class="spinner"
        />
        {{ processing ? t('common.processing') : t('systemSettings.system.backup.create') }}
      </button>
    </div>

    <div class="backup-list">
      <div
        v-if="backups.length === 0"
        class="empty-state"
      >
        <span class="empty-icon">📦</span>
        <p class="empty-text">
          {{ t('systemSettings.system.backup.noBackups') }}
        </p>
      </div>

      <div
        v-else
        class="backup-items"
      >
        <div
          v-for="backup in backups"
          :key="backup.id"
          class="backup-item"
        >
          <div class="backup-info">
            <span class="backup-filename">{{ backup.filename }}</span>
            <span class="backup-meta">
              {{ formatDate(backup.createdAt) }} • {{ formatSize(backup.size) }}
            </span>
          </div>
          <button
            class="btn-restore"
            :disabled="processing"
            @click="handleRestore(backup.id)"
          >
            {{ t('systemSettings.system.backup.restore') }}
          </button>
        </div>
      </div>
    </div>

    <div class="credentials-backup">
      <div class="credentials-info">
        <h4 class="credentials-title">
          {{ t('systemSettings.system.backup.credentialsTitle') }}
        </h4>
        <p class="credentials-description">
          {{ t('systemSettings.system.backup.credentialsDescription') }}
        </p>
      </div>
      <button
        class="btn-secondary"
        :disabled="processing"
        @click="handleBackupCredentials"
      >
        {{ t('systemSettings.system.backup.backupCredentials') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Backup } from '@/types/system-settings'

// Props
interface Props {
  backups: Backup[]
  processing: boolean
}

defineProps<Props>()

// Events
const emit = defineEmits<{
  backup: []
  restore: [backupId: string]
  'backup-credentials': []
}>()

// Composables
const { t } = useI18n()

// Methods
function handleBackup() {
  emit('backup')
}

function handleRestore(backupId: string) {
  emit('restore', backupId)
}

function handleBackupCredentials() {
  emit('backup-credentials')
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatSize(bytes: number): string {
  if (bytes < 1024) {return `${bytes} B`}
  if (bytes < 1024 * 1024) {return `${(bytes / 1024).toFixed(2)} KB`}
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
</script>

<style scoped>
.backup-manager {
  background: white;
  border-radius: 0.5rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin-bottom: 1.5rem;
}

.manager-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.manager-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a202c;
  margin: 0 0 0.25rem 0;
}

.manager-description {
  font-size: 0.875rem;
  color: #718096;
  margin: 0;
}

.backup-list {
  margin-bottom: 1.5rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  color: #a0aec0;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.empty-text {
  font-size: 0.875rem;
  margin: 0;
}

.backup-items {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.backup-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  transition: all 0.2s;
}

.backup-item:hover {
  background: #edf2f7;
  border-color: #cbd5e0;
}

.backup-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.backup-filename {
  font-size: 0.875rem;
  font-weight: 500;
  color: #2d3748;
}

.backup-meta {
  font-size: 0.8125rem;
  color: #718096;
}

.btn-restore {
  padding: 0.5rem 1rem;
  background: #4299e1;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-restore:hover:not(:disabled) {
  background: #3182ce;
}

.btn-restore:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.credentials-backup {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #fffaf0;
  border: 1px solid #fbd38d;
  border-radius: 0.375rem;
}

.credentials-info {
  flex: 1;
}

.credentials-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #744210;
  margin: 0 0 0.25rem 0;
}

.credentials-description {
  font-size: 0.8125rem;
  color: #975a16;
  margin: 0;
}

.btn-primary,
.btn-secondary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.5rem;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-primary {
  background: #4299e1;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #3182ce;
}

.btn-secondary {
  background: #ed8936;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #dd6b20;
}

.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid #ffffff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
