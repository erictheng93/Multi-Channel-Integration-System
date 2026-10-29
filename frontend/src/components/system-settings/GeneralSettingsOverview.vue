<!--
  GeneralSettingsOverview.vue

  The settings hub strip: four live tiles (LINE, Facebook, system health, backup), each linking to the
  section that owns it. Every value is read from an endpoint the settings page already uses:
  the integration `status` / `lastTest` from /system/settings, the overall verdict from /health/system
  (the same plain check the health page runs), and the newest automatic backup from /data/backup.
-->
<template>
  <section
    class="ov"
    aria-label="系統概覽"
  >
    <router-link
      v-for="tile in tiles"
      :key="tile.key"
      :to="tile.to"
      class="ui-card ov-tile"
    >
      <span
        class="ov-ico"
        :class="tile.tone"
        aria-hidden="true"
      >
        <!-- eslint-disable vue/no-v-html -->
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          v-html="tile.icon"
        />
        <!-- eslint-enable vue/no-v-html -->
      </span>
      <span class="ov-body">
        <span class="ov-label">{{ tile.label }}</span>
        <span
          class="ov-state"
          :class="tile.tone"
        >{{ tile.state }}</span>
        <span class="ov-sub">{{ tile.sub }}</span>
      </span>
      <svg
        class="ov-chev"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      ><path d="m9 18 6-6-6-6" /></svg>
    </router-link>
  </section>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue'
import { SETTINGS_CONTROLLER_KEY } from '@/types/system-settings'
import type { IntegrationLastTest, IntegrationStatus } from '@/types/system-settings'
import { SETTINGS_SECTIONS } from './settings-pages'
import { listBackups } from '@/api/backup'
import type { BackupItem } from '@/api/backup'
import { formatRelativeTime as relative } from '@/utils/monitor-helpers'

/** "0 秒前" reads like a bug; anything under ten seconds is simply just now */
function formatRelativeTime(iso: string): string {
  return Date.now() - new Date(iso).getTime() < 10_000 ? '剛剛' : relative(iso)
}

type Tone = 'green' | 'orange' | 'red' | 'muted'

interface Tile {
  key: string
  label: string
  state: string
  sub: string
  tone: Tone
  icon: string
  to: string
}

const controller = inject(SETTINGS_CONTROLLER_KEY)
if (!controller) {
  throw new Error('SystemSettingsController not provided')
}

const lastAuto = ref<BackupItem | null>(null)
const backupCount = ref<number | null>(null)
const backupLoaded = ref(false)

onMounted(async () => {
  if (controller.healthCheckResults.value.length === 0) {
    void controller.healthCheck(false, false)
  }
  try {
    const res = await listBackups()
    if (res.success && res.data) {
      lastAuto.value = res.data.lastAuto
      backupCount.value = res.data.count
    }
  } catch {
    // the tile falls back to a plain state; nothing is invented
  } finally {
    backupLoaded.value = true
  }
})

function section(key: string) {
  const found = SETTINGS_SECTIONS.find(s => s.key === key)
  return { icon: found?.icon ?? '', to: found?.path ?? '/settings/general' }
}

function integrationTile(
  key: 'line' | 'facebook',
  label: string,
  status: IntegrationStatus,
  lastTest: IntegrationLastTest | null | undefined,
): Tile {
  const tone: Tone = status === 'connected' ? 'green' : (status === 'error' ? 'red' : 'muted')
  const state = status === 'connected' ? '已連線' : (status === 'error' ? '連線異常' : '未連線')
  let sub = '尚未測試連線'
  if (lastTest) {
    sub = `${lastTest.status === 'success' ? '測試' : '測試失敗'} ${formatRelativeTime(lastTest.testedAt)}`
    if (lastTest.status === 'success' && lastTest.latencyMs) {
      sub += ` · ${lastTest.latencyMs} ms`
    }
  }
  return { key, label, state, sub, tone, ...section(key) }
}

const healthTile = computed<Tile>(() => {
  const overall = controller.healthOverall.value
  const checked = controller.healthCheckedAt.value
  const rows = controller.healthCheckResults.value
  let tone: Tone = 'muted'
  let state = controller.processing.value ? '檢查中' : '尚未檢查'
  if (overall) {
    const bad = rows.some(r => r.status === 'critical') || overall.status === 'critical' || overall.status === 'unhealthy'
    const warn = rows.some(r => r.status === 'warning') || overall.status === 'warning' || overall.status === 'degraded'
    tone = bad ? 'red' : (warn ? 'orange' : 'green')
    state = bad ? '異常' : (warn ? '降級' : '正常')
  }
  const sub = overall && checked
    ? `${rows.length} 項服務 · ${formatRelativeTime(checked)}`
    : '前往健康檢查頁查看'
  return { key: 'health', label: '系統健康', state, sub, tone, ...section('health') }
})

const backupTile = computed<Tile>(() => {
  const item = lastAuto.value
  const tone: Tone = item ? 'green' : 'muted'
  const state = item ? formatRelativeTime(item.uploaded) : (backupLoaded.value ? '尚無備份' : '讀取中')
  const sub = backupCount.value === null ? '最近自動備份' : `自動備份 · 共 ${backupCount.value} 份`
  return {
    key: 'backup',
    label: '資料備份',
    state,
    sub,
    tone,
    icon: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    to: '/data/backup',
  }
})

const tiles = computed<Tile[]>(() => [
  integrationTile('line', 'LINE 官方帳號', controller.settings.integrations.line.status, controller.settings.integrations.line.lastTest),
  integrationTile('facebook', 'Facebook', controller.settings.integrations.facebook.status, controller.settings.integrations.facebook.lastTest),
  healthTile.value,
  backupTile.value,
])
</script>

<style scoped>
.ov {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.ov-tile {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 18px 16px 18px 20px;
  color: inherit;
  text-decoration: none;
  transition: box-shadow var(--ui-dur) var(--ui-ease);
}

.ov-tile:hover {
  box-shadow: var(--ui-shadow-raised);
}

.ov-tile:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: 2px;
}

.ov-ico {
  display: grid;
  flex: none;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 11px;
  background: var(--ui-fill);
  color: var(--ui-muted);
}

.ov-ico svg {
  width: 19px;
  height: 19px;
}

.ov-ico.green {
  background: var(--ui-green-soft);
  color: var(--ui-green-ink);
}

.ov-ico.orange {
  background: var(--ui-orange-soft);
  color: var(--ui-orange-ink);
}

.ov-ico.red {
  background: var(--ui-red-soft);
  color: var(--ui-red-ink);
}

.ov-body {
  display: grid;
  flex: 1;
  gap: 2px;
  min-width: 0;
}

.ov-label {
  font-size: var(--ui-t-meta);
  font-weight: 600;
  color: var(--ui-ink-2);
}

.ov-state {
  font: 600 22px / 1.2 var(--ui-font-display);
  letter-spacing: -0.01em;
  color: var(--ui-ink);
}

.ov-state.green {
  color: var(--ui-green-ink);
}

.ov-state.orange {
  color: var(--ui-orange-ink);
}

.ov-state.red {
  color: var(--ui-red-ink);
}

.ov-state.muted {
  color: var(--ui-muted);
}

.ov-sub {
  overflow: hidden;
  font-size: var(--ui-t-meta);
  line-height: 1.4;
  color: var(--ui-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ov-chev {
  flex: none;
  width: 16px;
  height: 16px;
  margin-top: 10px;
  color: var(--ui-faint);
}

@media (max-width: 1280px) {
  .ov {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* phone: a compact 2x2 so the form starts on the first screen; icon over label, status word, wrapping meta */
@media (max-width: 768px) {
  .ov {
    gap: 10px;
  }

  .ov-tile {
    flex-direction: column;
    gap: 8px;
    padding: 14px;
  }

  .ov-state {
    font-size: 18px;
  }

  .ov-sub {
    white-space: normal;
  }

  .ov-chev {
    display: none;
  }
}
</style>
