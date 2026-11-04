<!--
  GeneralSettingsOverview.vue
  Connections and backup as an inset group of three rows (LINE, Facebook, backup), each linking to the
  section that owns it. Values come from the integration `status` / `lastTest` in /system/settings and
  the newest automatic backup, which the page loads once and shares with the day ribbon.
-->
<template>
  <ul
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
import { computed, inject } from 'vue'
import { SETTINGS_CONTROLLER_KEY } from '@/types/system-settings'
import type { IntegrationLastTest, IntegrationStatus } from '@/types/system-settings'
import { SETTINGS_SECTIONS } from './settings-pages'
import type { BackupItem } from '@/api/backup'
import { formatRelativeTime as relative } from '@/utils/monitor-helpers'

const props = defineProps<{
  lastAuto: BackupItem | null
  backupCount: number | null
  backupLoaded: boolean
}>()

/** "0 秒前" reads like a bug; anything under ten seconds is simply just now */
function formatRelativeTime(iso: string): string {
  return Date.now() - new Date(iso).getTime() < 10_000 ? '剛剛' : relative(iso)
}

const NBSP = ' '

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

const backupTile = computed<Tile>(() => {
  const item = props.lastAuto
  const tone: Tone = item ? 'green' : 'muted'
  const state = item ? formatRelativeTime(item.uploaded) : (props.backupLoaded ? '尚無備份' : '讀取中')
  const sub = props.backupCount === null ? '最近自動備份' : `自動備份 · 共 ${props.backupCount} 份`
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
  backupTile.value,
])
</script>

<style scoped>
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

/* the fix pill already says it is not connected, so the red word is not repeated beside it */
.ov-row:has(.ov-fix) .ov-state.red {
  display: none;
}

.ov-state.muted {
  color: var(--ui-muted);
}

@media (max-width: 768px) {
  .ov-list {
    padding: 0 18px;
  }

  .ov-sub {
    white-space: normal;
  }

  }
</style>
