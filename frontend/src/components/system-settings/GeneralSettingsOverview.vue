<!--
  GeneralSettingsOverview.vue
  The settings home lead: system status as Service Rings (services healthy, channels connected) beside the
  overall verdict, then an inset group of four rows (LINE, Facebook, system health, backup), each linking
  to the section that owns it. 
  Every value is read from an endpoint the settings page already uses: the integration `status` /
  `lastTest` from /system/settings, the overall verdict from /health/system (the same plain check the
  health page runs), and the newest automatic backup from /data/backup.
-->
<template>
  <section
    v-if="part === 'head'"
    class="ov-strip ui-lead"
    aria-label="系統概覽"
  >
    <div class="ov-lead">
      <div class="ov-kicker">
        <span
          class="ov-dot"
          :class="healthTile.tone"
          aria-hidden="true"
        />系統狀態
      </div>
      <div
        class="ov-big"
        :class="headline.tone"
      >
        {{ headline.text }}
      </div>
      <p class="ov-meaning">
        {{ meaning }}
        <router-link
          class="ui-link ov-strip-link"
          :to="healthTile.to"
        >
          健康檢查
        </router-link>
      </p>
    </div>
    <ul
      v-if="serviceChips.length > 0"
      class="ov-svcs"
      aria-label="各項服務回應時間"
    >
      <li
        v-for="svc in serviceChips"
        :key="svc.key"
        class="ov-svc"
        :class="svc.tone"
      >
        <span class="ov-svc-n">{{ svc.ms }}<small>ms</small></span>
        <span class="ov-svc-l">{{ svc.name }}</span>
      </li>
    </ul>
  </section>

  <ul
    v-else
    class="ov-list"
    aria-label="連線與備份狀態"
  >
    <li
      v-for="tile in tiles"
      :key="tile.key"
    >
      <router-link
        :to="tile.to"
        class="ov-row"
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
        <span class="ov-text">
          <span class="ov-label">{{ tile.label }}</span>
          <span
            class="ov-sub"
            :class="{ bad: tile.tone === 'red' }"
          >{{ tile.sub }}</span>
        </span>
        <span
          class="ov-state"
          :class="tile.tone"
        >{{ tile.state }}</span>
        <span
          v-if="tile.tone === 'red'"
          class="ov-fix"
        >重新連線</span>
        <svg
          v-else
          class="ov-chev"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        ><path d="m9 6 6 6-6 6" /></svg>
      </router-link>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue'
import { SETTINGS_CONTROLLER_KEY } from '@/types/system-settings'
import type { IntegrationLastTest, IntegrationStatus } from '@/types/system-settings'
import { SETTINGS_SECTIONS } from './settings-pages'
import { listBackups } from '@/api/backup'
import type { BackupItem } from '@/api/backup'
import { formatRelativeTime as relative } from '@/utils/monitor-helpers'

const props = withDefaults(defineProps<{ part?: 'head' | 'list' }>(), { part: 'head' })

/** "0 秒前" reads like a bug; anything under ten seconds is simply just now */
function formatRelativeTime(iso: string): string {
  return Date.now() - new Date(iso).getTime() < 10_000 ? '剛剛' : relative(iso)
}

const NBSP = ' '

type Tone = 'green' | 'orange' | 'red' | 'muted' | 'ink'

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
  if (props.part === 'head') {
    if (controller.healthCheckResults.value.length === 0) {
      void controller.healthCheck(false, false)
    }
    return
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
  const failed = status !== 'connected' && !!lastTest && lastTest.status !== 'success'
  const tone: Tone = status === 'connected' ? 'green' : (status === 'error' || failed ? 'red' : 'muted')
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


/**
 * The lead answers "does anything need me?": a service fault is the headline; a disconnected channel is a warning chip,
 * not a headline, so a settings page does not open on an error.
 */
const headline = computed<{ text: string, tone: Tone }>(() => {
  const state = healthTile.value.state
  if (state === '異常') { return { text: '服務異常', tone: 'red' } }
  if (state === '降級') { return { text: '服務降級', tone: 'orange' } }
  if (state === '正常') { return { text: '系統運作正常', tone: 'ink' as Tone } }
  return { text: state, tone: 'muted' }
})

const meaning = computed(() => {
  const rows = controller.healthCheckResults.value.length
  const state = healthTile.value.state
  if (state === '尚未檢查' || state === '檢查中') { return state }
  const when = healthTile.value.sub.split(' · ').pop()
  return state === '正常' && rows > 0 ? `${rows} 項服務皆通過 · ${when}` : `服務${state}${rows > 0 ? ` · ${rows} 項檢查` : ''} · ${when}`
})

/** Short service name (the part in parentheses when there is one) with its measured latency */
const serviceChips = computed(() =>
  controller.healthCheckResults.value
    .filter(r => typeof r.responseTime === 'number')
    .map(r => ({
      key: r.key,
      name: /\(([^)]+)\)\s*$/.exec(r.name)?.[1] ?? r.name,
      ms: r.responseTime as number,
      tone: r.status === 'healthy' ? 'ok' : (r.status === 'warning' ? 'warn' : 'bad'),
    })))

const tiles = computed<Tile[]>(() => [
  integrationTile('line', 'LINE 官方帳號', controller.settings.integrations.line.status, controller.settings.integrations.line.lastTest),
  integrationTile('facebook', 'Facebook', controller.settings.integrations.facebook.status, controller.settings.integrations.facebook.lastTest),
  backupTile.value,
])
</script>

<style scoped>
/* head: the answer to "does anything need me?" in type, with the measured services beside it */
.ov-strip {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 20px 40px;
  align-items: center;
  padding: 24px 32px;
}

.ov-kicker {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.ov-big {
  margin-top: 6px;
  font: 700 34px / 1.15 var(--ui-font-display);
  letter-spacing: -0.03em;
  color: var(--ui-ink);
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
  margin: 6px 0 0;
  font-size: 14px;
  color: var(--ui-ink-2);
}

.ov-strip-link {
  margin-left: 10px;
  font-size: 14px;
  font-weight: 600;
}

.ov-svcs {
  display: grid;
  grid-template-columns: repeat(5, auto);
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ov-svc {
  display: grid;
  gap: 2px;
  padding: 2px 22px;
  box-shadow: inset 0.5px 0 0 var(--ui-sep);
}

.ov-svc:first-child {
  box-shadow: none;
}

.ov-svc-n {
  font: 600 26px / 1.1 var(--ui-font-display);
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink);
}

.ov-svc-n small {
  margin-left: 2px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-muted);
}

.ov-svc.warn .ov-svc-n {
  color: var(--ui-orange-ink);
}

.ov-svc.bad .ov-svc-n {
  color: var(--ui-red-ink);
}

.ov-svc-l {
  font-size: 13px;
  color: var(--ui-muted);
}

.ov-dot {
  flex: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--ui-muted);
}

.ov-dot.green {
  background: var(--ui-green);
  box-shadow: 0 0 0 5px var(--ui-green-soft);
}

.ov-dot.orange {
  background: var(--ui-orange);
}

.ov-dot.red {
  background: var(--ui-red);
}

/* list: connections and backup, one row each */
.ov-list {
  display: grid;
  margin: 0;
  padding: 0 22px;
  list-style: none;
}

.ov-list li + li {
  box-shadow: inset 0 0.5px 0 var(--ui-sep);
}

.ov-row {
  display: flex;
  gap: 14px;
  align-items: center;
  min-height: 68px;
  padding: 10px 0;
  color: inherit;
  text-decoration: none;
}

.ov-text {
  display: grid;
  flex: 1;
  min-width: 0;
}

/* a failed channel carries its own next step instead of a quiet chevron */
.ov-fix {
  flex: none;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--ui-red-soft);
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-red-ink);
}

.ov-chev {
  flex: none;
  width: 14px;
  height: 14px;
  color: var(--ui-faint);
}

.ov-row:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: -2px;
}

.ov-ico {
  display: grid;
  flex: none;
  place-items: center;
  width: 36px;
  height: 36px;
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

.ov-sub.bad {
  color: var(--ui-red-ink);
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
  .ov-strip {
    grid-template-columns: minmax(0, 1fr);
  }

  .ov-svc:first-child {
    padding-left: 0;
  }
}

@media (max-width: 768px) {
  .ov-strip {
    padding: 18px;
  }

  .ov-big {
    font-size: 26px;
  }

  .ov-svcs {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px 0;
  }

  .ov-svc {
    padding: 0 12px;
  }

  .ov-svc:nth-child(3n + 1) {
    padding-left: 0;
    box-shadow: none;
  }

  .ov-svc-n {
    font-size: 21px;
  }

  .ov-list {
    padding: 0 18px;
  }

  .ov-sub {
    white-space: normal;
  }

  /* the fix pill already says it is not connected */
  .ov-state.red {
    display: none;
  }
}
</style>
