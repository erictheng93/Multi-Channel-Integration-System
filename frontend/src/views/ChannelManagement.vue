<template>
  <AppLayout>
    <div class="ui-page rl-page channel-management ui-rise">
      <!-- Page Header -->
      <UiPageHead
        title="頻道"
        :subtitle="!isLoading && channels.length > 0 ? channelSummary : ''"
      >
        <template #actions>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            :disabled="isLoading"
            @click="refreshChannels"
          >
            <svg
              class="head-ico"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            ><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M3 21v-5h5" /></svg>重新整理
          </button>
          <button
            type="button"
            class="btn btn-primary"
            @click="openAddChannelDialog"
          >
            <svg
              class="head-ico"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            ><path d="M12 5v14M5 12h14" /></svg>新增頻道
          </button>
        </template>
      </UiPageHead>

      <!-- Lead: how much came through in the last 24 h, and how many channels are on and verified -->
      <RingLead
        v-if="!isLoading && !loadFailed && channels.length > 0"
        kicker="近 24 小時訊息"
        :value="leadVolume.total === null ? '—' : formatCount(leadVolume.total)"
        :unit="leadVolume.total === null ? '' : '則'"
        :meaning="leadVolume.meaning"
        :tone="leadVolume.total === null ? 'none' : ''"
        summary="頻道概況"
        :rings="channelRings"
        :size="144"
      />

      <!-- Platform Filter -->
      <div class="toolbar">
        <div
          class="ui-seg"
          role="group"
          aria-label="依平台篩選"
        >
          <button
            type="button"
            :aria-pressed="selectedPlatform === null"
            @click="filterByPlatform(null)"
          >
            全部 <span class="ui-seg-n">{{ channels.length }}</span>
          </button>
          <button
            v-for="p in PLATFORM_FILTERS"
            :key="p.id"
            type="button"
            :aria-pressed="selectedPlatform === p.id"
            @click="filterByPlatform(p.id)"
          >
            {{ p.label }} <span class="ui-seg-n">{{ getChannelCount(p.id) }}</span>
          </button>
        </div>
      </div>

      <!-- Webhook problems: one place, with the one primary action; the cards stay uniform -->
      <section
        v-if="!isLoading && !loadFailed && problemChannels.length > 0"
        class="alerts"
        aria-label="Webhook 需注意"
      >
        <article
          v-for="channel in problemChannels"
          :key="channel.id"
          class="ui-card alert-row"
        >
          <span
            class="alert-ico"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            ><path d="M12 3 2 20h20Z" /><path d="M12 10v4M12 17h.01" /></svg>
          </span>
          <div class="alert-main">
            <div class="alert-title">
              {{ channelTitle(channel) }} · Webhook 需注意
            </div>
            <div class="alert-text">
              {{ webhookProblems(channel).join(' ') }}
            </div>
          </div>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            @click="verifyChannel(channel)"
          >
            重新驗證
          </button>
        </article>
      </section>

      <!-- Loading State -->
      <UiEmptyState
        v-if="isLoading"
        class="ui-card"
        role="status"
        description="載入頻道資料中..."
      />

      <!-- Error State -->
      <div
        v-else-if="loadFailed"
        class="ui-card ui-empty"
        role="alert"
      >
        <h3>無法載入頻道</h3>
        <p>請檢查網路連線後再試一次。</p>
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          @click="refreshChannels"
        >
          重新載入
        </button>
      </div>

      <!-- Empty State -->
      <UiEmptyState
        v-else-if="filteredChannels.length === 0"
        class="ui-card"
        :title="selectedPlatform ? `尚未設定 ${selectedPlatformLabel} 頻道` : '尚未設定任何頻道'"
        :description="selectedPlatform ? '此平台還沒有頻道，新增後客戶訊息才會進到系統。' : '點擊右上角「新增頻道」開始設定您的第一個通訊平台。'"
      >
        <template #icon>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          ><path d="M4.9 19.1a10 10 0 0 1 0-14.2M19.1 4.9a10 10 0 0 1 0 14.2M8 16a5.5 5.5 0 0 1 0-8M16 8a5.5 5.5 0 0 1 0 8" /><circle
            cx="12"
            cy="12"
            r="1.5"
          /></svg>
        </template>
        <template
          v-if="selectedPlatform"
          #action
        >
          <button
            type="button"
            class="btn btn-secondary"
            @click="openAddChannelDialog"
          >
            新增頻道
          </button>
        </template>
      </UiEmptyState>

      <!-- Channel List -->
      <div
        v-else
        class="chgrid"
      >
        <article
          v-for="channel in filteredChannels"
          :key="channel.id"
          class="ui-card chcard"
          :class="{ off: !channel.isActive }"
        >
          <!-- Card Header -->
          <div class="chhead">
            <div
              class="tile"
              :class="`tile-${channel.platform}`"
            >
              <svg
                v-if="channel.platform === 'line'"
                viewBox="0 0 24 24"
                aria-hidden="true"
              ><path d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.7 6.2L5 21l4.1-2.3c.9.2 1.9.3 2.9.3 5.5 0 10-3.6 10-8s-4.5-8-10-8Z" /></svg>
              <svg
                v-else-if="channel.platform === 'facebook'"
                viewBox="0 0 24 24"
                aria-hidden="true"
              ><path d="M12 2C6.4 2 2 6.1 2 11.7c0 2.9 1.2 5.4 3.2 7.2V22l3-1.6c1.2.3 2.4.5 3.8.5 5.6 0 10-4.1 10-9.7S17.6 2 12 2Zm1 12.4-2.6-2.7-5 2.7 5.5-5.8 2.6 2.7 4.9-2.7Z" /></svg>
              <svg
                v-else
                viewBox="0 0 24 24"
                aria-hidden="true"
              ><path d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.7 6.2L5 21l4.1-2.3c.9.2 1.9.3 2.9.3 5.5 0 10-3.6 10-8s-4.5-8-10-8Z" /></svg>
            </div>
            <div class="chname">
              <b>{{ channelTitle(channel) }}</b>
              <span>{{ PLATFORM_KIND[channel.platform] }}</span>
            </div>
            <div class="chtools">
              <button
                type="button"
                class="more-btn"
                aria-label="更多選項"
                aria-haspopup="menu"
                :aria-expanded="activeDropdown === channel.id"
                @click.stop="toggleDropdown(channel.id)"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.4"
                  stroke-linecap="round"
                  aria-hidden="true"
                ><circle
                  cx="12"
                  cy="5"
                  r="1"
                /><circle
                  cx="12"
                  cy="12"
                  r="1"
                /><circle
                  cx="12"
                  cy="19"
                  r="1"
                /></svg>
              </button>

              <!-- Dropdown Menu -->
              <div
                v-if="activeDropdown === channel.id"
                class="menu"
                role="menu"
                @click.stop
              >
                <button
                  role="menuitem"
                  @click="viewChannelDetails(channel)"
                >
                  查看詳情
                </button>
                <button
                  role="menuitem"
                  @click="copyWebhookUrl(channel)"
                >
                  複製 Webhook URL
                </button>
                <button
                  role="menuitem"
                  @click="verifyChannel(channel)"
                >
                  驗證配置
                </button>
                <button
                  role="menuitem"
                  @click="viewStats(channel)"
                >
                  查看統計
                </button>
                <button
                  role="menuitem"
                  @click="editChannel(channel)"
                >
                  編輯配置
                </button>
                <button
                  role="menuitem"
                  class="danger"
                  @click="deleteChannel(channel)"
                >
                  刪除頻道
                </button>
              </div>
            </div>
          </div>

          <!-- Card Body -->
          <div class="meta">
            <div class="meta-row">
              <span class="k">{{ idLabel(channel.platform) }}</span>
              <span class="v mono">{{ getChannelId(channel) }}</span>
            </div>
            <div class="meta-row">
              <span class="k">說明</span>
              <span
                class="v"
                :class="{ none: !channelDescription(channel) }"
              >{{ channelDescription(channel) || '尚未填寫' }}</span>
            </div>
          </div>

          <div class="pills">
            <span
              class="ui-pill"
              :class="channel.isActive ? 'ui-pill-green ui-pill-dot' : ''"
            >{{ channel.isActive ? '啟用中' : '已停用' }}</span>
            <span
              class="ui-pill"
              :class="channel.isVerified ? 'ui-pill-green' : 'ui-pill-orange'"
            >{{ channel.isVerified ? '已驗證' : '未驗證' }}</span>
            <span
              v-if="channel.webhookHealth && hasWebhookProblem(channel)"
              class="ui-pill ui-pill-orange ui-pill-dot"
            >Webhook 需注意</span>
          </div>

          <!-- Activity: platform totals, so a disabled channel shows none of it -->
          <div class="activity">
            <div
              v-if="channel.isActive"
              class="stats"
            >
              <div class="stat-i">
                <div class="l">
                  客戶來訊 · 24 小時
                </div>
                <div class="n">
                  {{ activityValue(channel, 'customerMessages24h') }}
                </div>
                <div class="s">
                  累計 {{ activityValue(channel, 'customerMessagesTotal') }}
                </div>
              </div>
              <div class="stat-i">
                <div class="l">
                  客服發送 · 24 小時
                </div>
                <div class="n">
                  {{ activityValue(channel, 'agentMessages24h') }}
                </div>
                <div class="s">
                  累計 {{ activityValue(channel, 'agentMessagesTotal') }}
                </div>
              </div>
            </div>
            <div class="last">
              {{ activityCaption(channel) }}
            </div>
          </div>

          <!-- Card Footer: the on/off switch with its label, and the one action -->
          <div class="chfoot">
            <label class="toggle">
              <button
                type="button"
                class="ui-switch"
                role="switch"
                :aria-checked="channel.isActive"
                :aria-label="channel.isActive ? '停用頻道' : '啟用頻道'"
                @click.stop="toggleChannelStatus(channel)"
              />
              <span>{{ channel.isActive ? '啟用中' : '已停用' }}</span>
            </label>
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              @click="verifyChannel(channel)"
            >
              驗證配置
            </button>
          </div>
        </article>
      </div>

      <!-- Message volume by channel: the same real 24 h counters the cards show, side by side -->
      <section
        v-if="!isLoading && !loadFailed && volumeRows.length > 0"
        aria-label="近 24 小時各頻道訊息量"
      >
        <h2 class="ui-group-label">
          各頻道訊息量
          <span class="vol-legend">
            <span><i class="sw sw-in" />客戶來訊</span>
            <span><i class="sw sw-out" />客服發送</span>
          </span>
        </h2>
        <ul class="ui-group vol-list">
          <li
            v-for="row in volumeRows"
            :key="row.id"
            class="vol-row"
          >
            <span class="vol-name">{{ row.name }}</span>
            <span class="vol-bars">
              <span class="vol-line">
                <span class="vol-track"><span
                  class="vol-bar in"
                  :style="{ width: `${row.inPct}%` }"
                /></span>
                <b class="vol-n">{{ row.inText }}</b>
              </span>
              <span class="vol-line">
                <span class="vol-track"><span
                  class="vol-bar out"
                  :style="{ width: `${row.outPct}%` }"
                /></span>
                <b class="vol-n">{{ row.outText }}</b>
              </span>
            </span>
          </li>
        </ul>
        <p class="ui-group-foot">
          條長為各頻道 24 小時內的相對比例。
        </p>
      </section>

      <!-- Channel Config Dialog -->
      <ChannelConfigDialog
        :show="showConfigDialog"
        :channel="selectedChannel"
        @update:show="showConfigDialog = $event"
        @close="closeConfigDialog"
        @success="handleChannelCreated"
      />

      <ChannelDetailsModal
        :show="showDetailsModal"
        :channel="selectedChannel"
        @update:show="showDetailsModal = $event"
        @close="showDetailsModal = false"
        @copy-webhook-url="copyWebhookUrl"
      />
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import UiEmptyState from '@/components/ui/UiEmptyState.vue'
import UiPageHead from '@/components/ui/UiPageHead.vue'
import RingLead from '@/components/lead/RingLead.vue'
import type { ServiceRing } from '@/components/ui/ServiceRings.vue'
import { computed } from 'vue'
import AppLayout from '@/components/ui/AppLayout.vue'
import ChannelConfigDialog from '@/components/channels/ChannelConfigDialog.vue'
import ChannelDetailsModal from '@/components/channels/ChannelDetailsModal.vue'
import { formatLastLogin } from '@/utils/team-tone'
import { useChannelManagement } from '@/composables/useChannelManagement'
import type { ChannelIntegration, ChannelPlatform } from '@/api/channels'

const {
  activeDropdown,
  channels,
  closeConfigDialog,
  copyWebhookUrl,
  deleteChannel,
  editChannel,
  filterByPlatform,
  filteredChannels,
  getChannelCount,
  getChannelId,
  getPlatformName,
  handleChannelCreated,
  isLoading,
  loadFailed,
  openAddChannelDialog,
  refreshChannels,
  selectedChannel,
  selectedPlatform,
  showConfigDialog,
  showDetailsModal,
  toggleChannelStatus,
  toggleDropdown,
  verifyChannel,
  viewChannelDetails,
  viewStats
} = useChannelManagement()

const PLATFORM_KIND: Record<ChannelPlatform, string> = {
  line: 'LINE 官方帳號',
  facebook: 'Facebook 粉絲專頁',
  whatsapp: 'WhatsApp Business'
}

const PLATFORM_FILTERS: Array<{ id: ChannelPlatform; label: string }> = [
  { id: 'line', label: 'LINE' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'whatsapp', label: 'WhatsApp' }
]

/** Optional display name lives in configMetadata.name; fall back to the platform. */
function channelTitle(channel: ChannelIntegration): string {
  const name = channel.configMetadata?.name
  return typeof name === 'string' && name.trim() ? name.trim() : `${PLATFORM_KIND[channel.platform]}（未命名）`
}

function channelDescription(channel: ChannelIntegration): string {
  const description = channel.configMetadata?.description
  return typeof description === 'string' ? description : ''
}

function idLabel(platform: ChannelPlatform): string {
  if (platform === 'facebook') { return 'Page ID' }
  if (platform === 'whatsapp') { return '電話號碼' }
  return 'Channel ID'
}

const number = new Intl.NumberFormat('zh-TW')
function formatCount(value: number): string {
  return number.format(value)
}

/** Webhook failure records (KV alerts, 7-day retention). Failures only: no records means no failures were recorded, not proof of liveness. */
function webhookProblems(channel: ChannelIntegration): string[] {
  const health = channel.webhookHealth
  if (!health) { return [] }
  const problems: string[] = []
  if (health.processingFailures24h > 0) {
    const last = health.lastProcessingFailureAt ? `，最近一次 ${formatLastLogin(health.lastProcessingFailureAt)}` : ''
    problems.push(`近 24 小時有 ${health.processingFailures24h} 次 webhook 處理失敗${last}。`)
  }
  if (health.signatureFailureMinutes24h > 0) {
    problems.push(`近 24 小時有 ${health.signatureFailureMinutes24h} 個時段的簽章驗證被拒，請確認 Channel Secret 設定。`)
  }
  return problems
}

function hasWebhookProblem(channel: ChannelIntegration): boolean {
  return webhookProblems(channel).length > 0
}

const problemChannels = computed(() => channels.value.filter(hasWebhookProblem))

type ActivityKey = 'customerMessages24h' | 'customerMessagesTotal' | 'agentMessages24h' | 'agentMessagesTotal'

/** Real counters only: a disabled channel or one without activity data shows a dash, never a made-up zero */
function activityValue(channel: ChannelIntegration, key: ActivityKey): string {
  if (!channel.isActive || !channel.activity) { return '—' }
  return formatCount(channel.activity[key])
}

function activityCaption(channel: ChannelIntegration): string {
  if (!channel.isActive) { return '已停用 · 啟用後才會顯示訊息量' }
  if (!channel.activity) { return '暫時無法取得訊息量' }
  const at = channel.activity.lastActivityAt
  return `平台合計 · 最後活動 ${at ? formatLastLogin(at) : '尚無活動'}`
}

/** Active channels with activity data, bars scaled to the largest 24 h figure on the page */
const volumeRows = computed(() => {
  const rows = channels.value.filter(c => c.isActive && c.activity)
  const max = Math.max(1, ...rows.flatMap(c => [c.activity?.customerMessages24h ?? 0, c.activity?.agentMessages24h ?? 0]))
  return rows.map((c) => {
    const inN = c.activity?.customerMessages24h ?? 0
    const outN = c.activity?.agentMessages24h ?? 0
    return {
      id: c.id,
      name: channelTitle(c),
      inText: formatCount(inN),
      outText: formatCount(outN),
      inPct: inN === 0 ? 0 : Math.max(2, Math.round((inN / max) * 100)),
      outPct: outN === 0 ? 0 : Math.max(2, Math.round((outN / max) * 100))
    }
  })
})

/** 24 h totals over the active channels that report activity; null when none does (never a made-up zero) */
const leadVolume = computed(() => {
  const rows = channels.value.filter(c => c.isActive && c.activity)
  if (rows.length === 0) { return { total: null, meaning: '沒有啟用中的頻道提供訊息量' } }
  const inN = rows.reduce((sum, c) => sum + (c.activity?.customerMessages24h ?? 0), 0)
  const outN = rows.reduce((sum, c) => sum + (c.activity?.agentMessages24h ?? 0), 0)
  return { total: inN + outN, meaning: `客戶來訊 ${formatCount(inN)} · 客服發送 ${formatCount(outN)}` }
})

const channelRings = computed<ServiceRing[]>(() => {
  const total = channels.value.length
  return [
    { label: '啟用中', value: channels.value.filter(c => c.isActive).length, total, of: '個頻道', hue: 'var(--section-hue)' },
    { label: '已驗證', value: channels.value.filter(c => c.isVerified).length, total, of: '個頻道', hue: 'var(--ui-blue)' }
  ]
})

const channelSummary = computed(() => {
  const total = channels.value.length
  const active = channels.value.filter(c => c.isActive).length
  const problem = channels.value.filter(hasWebhookProblem)
  let text = `${total} 個頻道，${active} 個啟用中`
  const [first] = problem
  if (problem.length === 1 && first) {
    text += `；${channelTitle(first)} 近 24 小時有 webhook 失敗紀錄，建議重新驗證`
  } else if (problem.length > 1) {
    text += `；${problem.length} 個頻道近 24 小時有 webhook 失敗紀錄，建議重新驗證`
  }
  return `${text}。`
})

const selectedPlatformLabel = computed(() =>
  selectedPlatform.value ? getPlatformName(selectedPlatform.value) : ''
)
</script>

<style scoped>
.head-ico {
  width: 16px;
  height: 16px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.toolbar .ui-seg {
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
}

.alerts {
  display: grid;
  gap: 12px;
}
.alert-row {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 14px 18px;
}
.alert-ico {
  display: grid;
  flex: none;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 11px;
  background: var(--ui-orange-soft);
  color: var(--ui-orange-ink);
}
.alert-ico svg {
  width: 19px;
  height: 19px;
}
.alert-main {
  flex: 1;
  min-width: 0;
}
.alert-title {
  font: 600 15px / 1.3 var(--ui-font-display);
}
.alert-text {
  margin-top: 2px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ui-ink-2);
}

/* Every card has the same parts in the same order, so rows line up without any grid trickery */
.chgrid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  align-items: stretch;
}
.chcard {
  display: flex;
  flex-direction: column;
}
/* Disabled channel: muted text, not opacity (opacity drops text below WCAG AA contrast) */
.chcard.off .chhead,
.chcard.off .stats,
.chcard.off .meta,
.chcard.off .toggle {
  color: var(--ui-muted);
}
.chhead {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px 12px;
}
.tile {
  display: grid;
  flex: none;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 13px;
}
.tile svg {
  width: 24px;
  height: 24px;
  fill: #fff;
}
.tile-line {
  background: var(--ui-line);
}
.tile-facebook {
  background: var(--ui-messenger);
}
.tile-whatsapp {
  background: var(--ui-faint);
}
.chname {
  min-width: 0;
  flex: 1;
}
.chname b {
  display: block;
  overflow: hidden;
  font: 600 16px / 1.25 var(--ui-font-display);
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chname span {
  font-size: 13px;
  color: var(--ui-muted);
}
.chtools {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
}
.more-btn {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--ui-ink-2);
  cursor: pointer;
  transition: background var(--ui-dur) var(--ui-ease);
}
.more-btn:hover {
  background: var(--ui-fill);
}
.more-btn svg {
  width: 18px;
  height: 18px;
}
.menu {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 10;
  min-width: 168px;
  margin-top: 6px;
  padding: 6px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow-raised);
}
.menu button {
  display: block;
  width: 100%;
  padding: 9px 12px;
  border: 0;
  border-radius: 9px;
  background: none;
  font-size: 13.5px;
  color: var(--ui-ink);
  text-align: left;
  cursor: pointer;
}
.menu button:hover {
  background: var(--ui-fill);
}
.menu button.danger {
  color: var(--ui-red);
}

.meta {
  display: grid;
  gap: 8px;
  padding: 0 20px;
}
.meta-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 13px;
}
.meta-row .k {
  width: 84px;
  flex: none;
  color: var(--ui-muted);
  white-space: nowrap;
}
.meta-row .v.none {
  color: var(--ui-muted);
}
.meta-row .v {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mono {
  font-family: var(--ui-font-mono);
}
.pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 12px 20px 0;
}
.activity {
  min-width: 0;
}
.activity {
  margin-top: auto;
}
.stats {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin: 16px 20px 0;
  padding: 14px 0 10px;
  box-shadow: inset 0 0.5px 0 var(--ui-sep);
}
.stat-i + .stat-i {
  position: relative;
  padding-left: 16px;
}
.stat-i + .stat-i::before {
  content: '';
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 0.5px;
  background: var(--ui-sep);
}
.stat-i .l {
  font-size: 13px;
  color: var(--ui-muted);
}
.stat-i .n {
  font: 600 22px / 1.2 var(--ui-font-display);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.stat-i .s {
  font-size: 13px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}
.last {
  padding: 0 20px 14px;
  font-size: 13px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}
/* a disabled channel has no counters: one quiet line states it is off, under the same hairline */
.chcard.off .last {
  margin: 16px 20px 0;
  padding: 14px 0 16px;
  box-shadow: inset 0 0.5px 0 var(--ui-sep);
}
.chfoot {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px 18px;
}
.toggle {
  display: inline-flex;
  gap: 10px;
  align-items: center;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--ui-ink-2);
}

/* Volume comparison */
.vol-legend {
  display: inline-flex;
  gap: 14px;
  margin-left: auto;
  font-size: 13px;
  font-weight: 400;
  color: var(--ui-muted);
}
.vol-legend span {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}
.sw {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}
.sw-in,
.vol-bar.in {
  background: var(--ui-accent);
}
.sw-out,
.vol-bar.out {
  background: var(--ui-indigo);
}
.vol-list {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}
.vol-row {
  display: grid;
  grid-template-columns: minmax(140px, 220px) minmax(0, 1fr);
  gap: 20px;
  align-items: center;
  padding: 14px 22px;
}
.vol-row + .vol-row {
  box-shadow: inset 0 0.5px 0 var(--ui-sep);
}
.vol-name {
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vol-bars {
  display: grid;
  gap: 6px;
}
.vol-line {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 52px;
  gap: 12px;
  align-items: center;
}
.vol-n {
  font-size: 13px;
  font-weight: 600;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.vol-track {
  display: block;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-fill);
}
.vol-bar {
  display: block;
  height: 100%;
  border-radius: 999px;
}

@media (max-width: 1280px) {
  .chgrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 768px) {
  .chgrid {
    grid-template-columns: minmax(0, 1fr);
  }
  .alert-row {
    flex-wrap: wrap;
  }
  .alert-main {
    flex-basis: calc(100% - 60px);
  }
  .alert-row .btn {
    margin-left: 50px;
  }
  .vol-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    padding: 12px 16px;
  }
}
</style>
