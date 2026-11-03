<!--
  GeneralSettingsPage.vue
  The settings home. Signature: today as a 24 hour ribbon in the system's time zone (the time zone select
  drives it), then the identity form beside the connections, then the parameters in force as a strip.
-->

<template>
  <div class="general">
    <GeneralDayRibbon
      class="g-ribbon"
      :model-value="controller.settings.general.timezone"
      :form-id="SETTINGS_FORM_ID"
      :status="healthStatus"
      :events="ribbonEvents"
      @update:model-value="(zone) => (controller.settings.general.timezone = zone)"
    />

    <GeneralSettingsForm
      class="g-form"
      :settings="controller.settings.general"
      :saving="controller.saving.value"
      @save="controller.saveGeneralSettings"
      @update:settings="(data) => Object.assign(controller.settings.general, data)"
    />

    <SettingsGroup
      class="g-conn"
      title="連線與備份"
    >
      <GeneralSettingsOverview
        :last-auto="lastAuto"
        :backup-count="backupCount"
        :backup-loaded="backupLoaded"
      />
    </SettingsGroup>

    <SettingsGroup
      class="g-adv"
      title="目前生效的進階參數"
    >
      <template #action>
        <router-link to="/settings/advanced">
          調整參數
        </router-link>
      </template>
      <ul class="adv-list">
        <li
          v-for="item in advancedRows"
          :key="item.label"
        >
          <router-link
            class="adv-item"
            to="/settings/advanced"
          >
            <span class="adv-label">{{ item.label }}</span>
            <svg
              class="adv-chev"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            ><path d="m9 6 6 6-6 6" /></svg>
            <span
              class="adv-value"
              :class="item.state"
            >{{ item.value }}</span>
            <span class="adv-note">{{ item.note }}</span>
          </router-link>
        </li>
      </ul>
    </SettingsGroup>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue'
import { SETTINGS_CONTROLLER_KEY } from '@/types/system-settings'
import { GeneralSettingsForm } from '@/components/system-settings'
import GeneralSettingsOverview from '@/components/system-settings/GeneralSettingsOverview.vue'
import GeneralDayRibbon from '@/components/system-settings/GeneralDayRibbon.vue'
import type { RibbonEvent } from '@/components/system-settings/GeneralDayRibbon.vue'
import SettingsGroup from '@/components/system-settings/SettingsGroup.vue'
import { SETTINGS_FORM_ID, SETTINGS_SECTIONS } from '@/components/system-settings/settings-pages'
import { listBackups } from '@/api/backup'
import type { BackupItem, BackupPolicy } from '@/api/backup'

const controller = inject(SETTINGS_CONTROLLER_KEY)
if (!controller) {
  throw new Error('SystemSettingsController not provided')
}

const lastAuto = ref<BackupItem | null>(null)
const backupCount = ref<number | null>(null)
const backupLoaded = ref(false)
const schedule = ref<BackupPolicy['schedule'] | null>(null)

onMounted(async () => {
  if (controller.healthCheckResults.value.length === 0) {
    void controller.healthCheck(false, false)
  }
  try {
    const res = await listBackups()
    if (res.success && res.data) {
      lastAuto.value = res.data.lastAuto
      backupCount.value = res.data.count
      schedule.value = res.data.policy?.schedule ?? null
    }
  } catch {
    // the ribbon and the row simply have no backup mark; nothing is invented
  } finally {
    backupLoaded.value = true
  }
})

const HEALTH_PATH = SETTINGS_SECTIONS.find(s => s.key === 'health')?.path ?? '/settings/maintenance/health'
const LINE_ICON = SETTINGS_SECTIONS.find(s => s.key === 'line')?.icon ?? ''
const BACKUP_ICON = '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>'

/** One line for "does anything need me?": the plain health verdict, with the on-demand LINE webhook called out */
const healthStatus = computed(() => {
  const overall = controller.healthOverall.value
  const rows = controller.healthCheckResults.value
  const to = HEALTH_PATH
  if (!overall) {
    return { tone: 'muted' as const, text: controller.processing.value ? '檢查中' : '尚未檢查服務狀態', to }
  }
  const bad = rows.some(r => r.status === 'critical') || overall.status === 'critical' || overall.status === 'unhealthy'
  const warn = rows.some(r => r.status === 'warning') || overall.status === 'warning' || overall.status === 'degraded'
  if (bad) { return { tone: 'red' as const, text: `服務異常，共 ${rows.length} 項檢查`, to } }
  if (warn) { return { tone: 'orange' as const, text: `服務降級，共 ${rows.length} 項檢查`, to } }
  if (rows.length > 0 && !controller.healthLineWebhook.value) {
    return { tone: 'green' as const, text: `${rows.length} 項正常，Webhook 待測`, to }
  }
  return { tone: 'green' as const, text: rows.length > 0 ? `${rows.length} 項服務皆正常` : '系統運作正常', to }
})

/** The next run of the daily backup: the schedule's wall time in the schedule's own zone, first occurrence after now */
function nextScheduled(sched: BackupPolicy['schedule'], from: number): number | null {
  const [hh = Number.NaN, mm = Number.NaN] = sched.localTime.split(':').map(Number)
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) { return null }
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: sched.timezone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    const wall = (ms: number) => {
      const p: Record<string, number> = Object.fromEntries(fmt.formatToParts(new Date(ms)).map(x => [x.type, Number(x.value)]))
      return Date.UTC(p.year ?? 0, (p.month ?? 1) - 1, p.day ?? 1, p.hour ?? 0, p.minute ?? 0, p.second ?? 0)
    }
    const nowWall = wall(from)
    const offset = nowWall - Math.floor(from / 1000) * 1000
    const dayStartWall = nowWall - (nowWall % 86_400_000)
    let target = dayStartWall + (hh * 60 + mm) * 60_000 - offset
    if (target <= from) { target += 86_400_000 }
    return target
  } catch {
    return null
  }
}

const ribbonEvents = computed<RibbonEvent[]>(() => {
  const out: RibbonEvent[] = []
  const auto = lastAuto.value
  if (auto) {
    out.push({
      key: 'backup',
      at: new Date(auto.uploaded).getTime(),
      what: '自動備份完成',
      icon: BACKUP_ICON,
      tone: 'green',
    })
  }
  const test = controller.settings.integrations.line.lastTest
  if (test) {
    const ok = test.status === 'success'
    out.push({
      key: 'line-test',
      at: new Date(test.testedAt).getTime(),
      what: ok ? 'LINE 連線測試成功' : 'LINE 連線測試失敗',
      icon: LINE_ICON,
      tone: ok ? 'green' : 'red',
    })
  }
  if (schedule.value) {
    const next = nextScheduled(schedule.value, Date.now())
    if (next !== null) {
      out.push({ key: 'next-backup', at: next, what: '下次自動備份', icon: BACKUP_ICON, tone: 'accent', future: true })
    }
  }
  return out
})

/** Same unit conversions the advanced form uses (ms, seconds -> seconds, minutes, hours) */
const advancedRows = computed(() => {
  const a = controller.settings.advanced
  return [
    { label: '訊息可撤回時間', value: a.recallWindowSeconds > 0 ? `${a.recallWindowSeconds} 秒` : '關閉', note: '延遲發送，期間可撤回' },
    { label: '訊息處理逾時', value: `${Math.round(a.messageTimeout / 1000)} 秒`, note: '處理逾時前的等待時間' },
    { label: '登入有效期限', value: `${Math.round(a.sessionExpiry / 3600)} 小時`, note: '登入狀態可保持的時間' },
    { label: '速率限制', value: a.enableRateLimit ? '已開啟' : '已關閉', note: '限制過量請求以保護服務', state: a.enableRateLimit ? 'on' : 'off' },
  ]
})
</script>

<style scoped>
/* bento: the day ribbon on top; the form beside the connections; the parameters in force as a strip */
.general {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 20px;
  align-items: stretch;
  min-width: 0;
}

.g-ribbon,
.g-adv {
  grid-column: 1 / -1;
}

.g-conn {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
}

.g-conn :deep(.ui-card) {
  display: grid;
}

.g-conn :deep(.ov-list) {
  grid-auto-rows: 1fr;
}

/* read-only values: one cell each, label over value, every cell opens the advanced page */
.adv-list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}

.adv-list li + li {
  box-shadow: inset 0.5px 0 0 var(--ui-sep);
}

.adv-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 8px;
  align-items: center;
  padding: 20px 24px 22px;
  color: inherit;
  text-decoration: none;
}

.adv-item:focus-visible {
  outline: 2px solid var(--ui-accent);
  outline-offset: -2px;
}

.adv-item {
  transition: background-color 0.2s ease-out;
}

.adv-item:hover {
  background: var(--ui-surface-2);
}

/* the cell is a link: the chevron sits in a small round fill so it reads as a control, not a glyph */
.adv-chev {
  box-sizing: content-box;
  width: 14px;
  height: 14px;
  padding: 5px;
  border-radius: 50%;
  background: var(--ui-fill);
  color: var(--ui-ink-2);
}

.adv-value,
.adv-note {
  grid-column: 1 / -1;
}

.adv-value.on {
  color: var(--ui-green-ink);
}

.adv-value.off {
  color: var(--ui-muted);
}

.adv-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.adv-note {
  font-size: 13px;
  line-height: 1.4;
  color: var(--ui-muted);
}

.adv-value {
  font: 600 22px / 1.2 var(--ui-font-display);
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink);
}

@media (max-width: 1024px) {
  .general {
    grid-template-columns: minmax(0, 1fr);
  }

  .adv-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .adv-list li:nth-child(n) {
    box-shadow: none;
  }

  .adv-list li:nth-child(2n) {
    box-shadow: inset 0.5px 0 0 var(--ui-sep);
  }

  .adv-list li:nth-child(n + 3) {
    box-shadow: inset 0 0.5px 0 var(--ui-sep);
  }

  .adv-list li:nth-child(4) {
    box-shadow: inset 0.5px 0.5px 0 var(--ui-sep);
  }
}

@media (max-width: 768px) {
  .adv-item {
    padding: 14px 18px 16px;
  }

  .adv-value {
    font-size: 20px;
  }

  /* the label already says what each value is; the one-line gloss is desktop-only on a phone page this long */
  .adv-note {
    display: none;
  }
}
</style>
