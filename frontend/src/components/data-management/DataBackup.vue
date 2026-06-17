<template>
  <div class="data-backup">
    <header class="page-head">
      <h1>資料備份</h1>
      <p>備份整個資料庫到雲端 (Cloudflare R2)，並可下載備份檔。僅限管理員。</p>
    </header>

    <!-- Automatic backup status -->
    <section class="card status-card">
      <div class="status-row">
        <div>
          <div class="status-label">
            自動備份
          </div>
          <div class="status-value">
            <template v-if="loading">
              載入中…
            </template>
            <template v-else-if="data && data.lastAuto">
              最近一次：{{ formatDate(data.lastAuto.uploaded) }}
              <span class="muted">· {{ formatBytes(data.lastAuto.size) }}</span>
            </template>
            <template v-else>
              尚未有自動備份記錄
            </template>
          </div>
          <div class="status-hint">
            每日 03:00 (台北時間) 自動執行 · 保留：每日 30 天 / 每月 365 天
          </div>
        </div>
        <button
          class="btn btn-primary"
          :disabled="running"
          @click="onBackupNow"
        >
          {{ running ? '備份中…' : '立即備份到雲端' }}
        </button>
      </div>
      <p
        v-if="message"
        class="message"
        :class="messageType"
      >
        {{ message }}
      </p>
    </section>

    <!-- Recent backups -->
    <section class="card">
      <div class="list-head">
        <h2>最近備份</h2>
        <button
          class="btn btn-ghost btn-sm"
          :disabled="loading"
          @click="load"
        >
          重新整理
        </button>
      </div>

      <div
        v-if="loading"
        class="empty"
      >
        載入中…
      </div>
      <div
        v-else-if="!data || data.items.length === 0"
        class="empty"
      >
        尚無備份檔
      </div>
      <ul
        v-else
        class="backup-list"
      >
        <li
          v-for="item in data.items"
          :key="item.key"
          class="backup-row"
        >
          <span
            class="tier-badge"
            :class="`tier-${item.tier}`"
          >{{ tierLabel(item.tier) }}</span>
          <span class="backup-name">{{ fileName(item.key) }}</span>
          <span class="backup-meta">{{ formatDate(item.uploaded) }} · {{ formatBytes(item.size) }}</span>
          <button
            class="btn btn-secondary btn-sm"
            :disabled="downloadingKey === item.key"
            @click="onDownload(item)"
          >
            {{ downloadingKey === item.key ? '下載中…' : '下載' }}
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { listBackups, runBackup, downloadBackup, type BackupItem, type BackupList } from '@/api/backup'

const loading = ref(true)
const running = ref(false)
const downloadingKey = ref<string | null>(null)
const data = ref<BackupList | null>(null)
const message = ref('')
const messageType = ref<'ok' | 'error'>('ok')

const TIER_LABELS: Record<string, string> = {
  daily: '每日',
  monthly: '每月',
  members: '人員',
  tags: '標籤',
  assignments: '指派',
  manual: '手動'
}
const tierLabel = (t: string) => TIER_LABELS[t] || t
const fileName = (key: string) => key.split('/').pop() || key

function formatBytes(n: number): string {
  if (!n) { return '0 B' }
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1)
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) { return iso }
  return d.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })
}

function setMessage(text: string, type: 'ok' | 'error') {
  message.value = text
  messageType.value = type
}

async function load() {
  loading.value = true
  const res = await listBackups()
  if (res.success && res.data) {
    data.value = res.data
  } else {
    setMessage(res.error || '無法載入備份列表', 'error')
  }
  loading.value = false
}

async function onBackupNow() {
  running.value = true
  setMessage('', 'ok')
  const res = await runBackup()
  if (res.success) {
    setMessage('備份已建立並上傳至雲端。', 'ok')
    await load()
  } else {
    setMessage(res.error || '備份失敗', 'error')
  }
  running.value = false
}

async function onDownload(item: BackupItem) {
  downloadingKey.value = item.key
  const res = await downloadBackup(item.key)
  if (res.success && res.data) {
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName(item.key)
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } else {
    setMessage(res.error || '下載失敗', 'error')
  }
  downloadingKey.value = null
}

onMounted(load)
</script>

<style scoped>
.data-backup {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 920px;
  margin: 0 auto;
}

.page-head h1 {
  font-size: 22px;
  font-weight: 600;
  color: #1c1c1e;
  margin: 0 0 4px;
}

.page-head p {
  font-size: 14px;
  color: #8e8e93;
  margin: 0;
}

.card {
  background: #ffffff;
  border-radius: 20px;
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.06);
  padding: 20px;
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.status-label {
  font-size: 13px;
  color: #8e8e93;
}

.status-value {
  font-size: 16px;
  font-weight: 600;
  color: #1c1c1e;
  margin-top: 2px;
}

.status-value .muted {
  font-weight: 400;
  color: #8e8e93;
}

.status-hint {
  font-size: 12px;
  color: #8e8e93;
  margin-top: 6px;
}

.message {
  margin: 12px 0 0;
  font-size: 13px;
}

.message.ok {
  color: #34c759;
}

.message.error {
  color: #ff3b30;
}

.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.list-head h2 {
  font-size: 16px;
  font-weight: 600;
  color: #1c1c1e;
  margin: 0;
}

.empty {
  padding: 24px 0;
  text-align: center;
  color: #8e8e93;
  font-size: 14px;
}

.backup-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.backup-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 4px;
}

.backup-row + .backup-row {
  border-top: 1px solid #f2f2f7;
}

.tier-badge {
  flex-shrink: 0;
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 999px;
  background: #eef1f6;
  color: #8e8e93;
}

.tier-badge.tier-manual {
  background: #fff2e5;
  color: #ff9500;
}

.tier-badge.tier-daily {
  background: #e8f3ff;
  color: #007aff;
}

.tier-badge.tier-monthly {
  background: #eafbef;
  color: #34c759;
}

.backup-name {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  color: #1c1c1e;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.backup-meta {
  flex-shrink: 0;
  font-size: 12px;
  color: #8e8e93;
}

@media (max-width: 640px) {
  .backup-meta {
    display: none;
  }
}
</style>
