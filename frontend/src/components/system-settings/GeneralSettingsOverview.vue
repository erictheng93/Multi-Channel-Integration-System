<!--
  GeneralSettingsOverview.vue
  The settings home lead: system status as Service Rings (services healthy, channels connected) beside the
  overall verdict, then an inset group of four rows (LINE, Facebook, system health, backup), each linking
  to the section that owns it. The page puts its own context group (service latency) in the #aside slot.
  Every value is read from an endpoint the settings page already uses: the integration `status` /
  `lastTest` from /system/settings, the overall verdict from /health/system (the same plain check the
  health page runs), and the newest automatic backup from /data/backup.
-->
<template>
  <section
    class="ov"
    aria-label="系統概覽"
  >
    <article class="ui-lead ov-lead">
      <div class="ov-main">
        <div class="ov-kicker">
          系統狀態
        </div>
        <div
          class="ov-big"
          :class="healthTile.tone"
        >
          {{ healthTile.state }}
        </div>
        <div class="ov-meaning">
          {{ healthTile.sub }}
        </div>
        <div
          v-if="backupTile.tone === 'green'"
          class="ov-meaning"
        >
          最近自動備份 {{ backupTile.state }}
        </div>
      </div>
      <div class="ov-rings">
        <ServiceRings
          summary="系統狀態"
          :rings="rings"
          :size="144"
          tagged
        />
      </div>
    </article>

    <div class="ov-grid">
      <div class="ov-col">
        <h2 class="ui-group-label">
          連線與備份
        </h2>
        <div class="ui-group ov-group">
          <router-link
            v-for="tile in tiles"
            :key="tile.key"
            :to="tile.to"
            class="ui-row is-nav ov-row"
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
            <span class="ui-row-main">
              <span class="ov-label">{{ tile.label }}</span>
              <span class="ov-sub">{{ tile.sub }}</span>
            </span>
            <span
              class="ov-state"
              :class="tile.tone"
            >{{ tile.state }}</span>
          </router-link>
        </div>
      </div>
      <div class="ov-col">
        <slot name="aside" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue'
import ServiceRings, { type ServiceRing } from '@/components/ui/ServiceRings.vue'
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

const NBSP = ' '

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
      sub += ` · ${lastTest.latencyMs}${NBSP}ms`
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

// Service Rings of the system: healthy services of those checked, connected channels of the two integrations
const rings = computed<ServiceRing[]>(() => {
  const rows = controller.healthCheckResults.value
  const list: ServiceRing[] = []
  if (rows.length > 0) {
    list.push({
      label: '服務正常',
      value: rows.filter(r => r.status === 'healthy').length,
      total: rows.length,
      of: '項服務',
      hue: 'var(--ui-green)',
    })
  }
  const channels = [controller.settings.integrations.line.status, controller.settings.integrations.facebook.status]
  list.push({
    label: '頻道已連線',
    value: channels.filter(status => status === 'connected').length,
    total: channels.length,
    of: '個頻道',
    hue: 'var(--section-hue)',
  })
  return list
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
  gap: 20px;
  min-width: 0;
}

.ov-lead {
  display: grid;
  grid-template-columns: auto auto;
  justify-content: center;
  gap: 24px 72px;
  align-items: center;
  padding: 24px 40px;
}

.ov-main {
  display: grid;
  gap: 4px;
  justify-items: start;
  min-width: 0;
}

.ov-kicker {
  font-size: 15px;
  font-weight: 600;
  color: var(--section-ink);
}

.ov-big {
  font: 600 52px / 1.1 var(--ui-font-display);
  letter-spacing: -0.035em;
  color: var(--ui-ink);
}

.ov-big.green {
  color: var(--ui-green-ink);
}

.ov-big.orange {
  color: var(--ui-orange-ink);
}

.ov-big.red {
  color: var(--ui-red-ink);
}

.ov-big.muted {
  color: var(--ui-muted);
}

.ov-meaning {
  font-size: 15px;
  color: var(--ui-ink-2);
}

.ov-rings {
  position: relative;
  display: flex;
  justify-content: center;
}

.ov-rings::before {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: -36px;
  width: 0.5px;
  background: var(--ui-sep);
  content: '';
}

.ov-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 20px 16px;
  align-items: stretch;
}

/* both columns end together: the aside group stretches to the height of the link list */
.ov-col {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.ov-col > :deep(.ui-group) {
  flex: 1;
}

.ov-row {
  color: inherit;
  text-decoration: none;
}

.ov-row:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: -2px;
}

.ov-ico {
  display: grid;
  flex: none;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
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

.ov-label {
  display: block;
  font-size: 15px;
  font-weight: 600;
  color: var(--ui-ink);
}

.ov-sub {
  display: block;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.4;
  color: var(--ui-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ov-state {
  flex: none;
  font: 600 15px var(--ui-font-display);
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

@media (max-width: 1024px) {
  .ov-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 768px) {
  .ov-lead {
    grid-template-columns: minmax(0, 1fr);
    justify-content: stretch;
    padding: 20px;
  }

  .ov-big {
    font-size: 44px;
  }

  .ov-rings {
    justify-content: flex-start;
  }

  .ov-rings::before {
    display: none;
  }

  .ov-sub {
    white-space: normal;
  }
}
</style>
