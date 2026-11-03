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

      <!-- Signature: customer messages vs agent replies per channel, one shared axis -->
      <ChannelBalance
        v-if="!isLoading && !loadFailed && channels.length > 0"
        :rows="balanceRows"
        :total="leadVolume.total"
        :in-n="leadVolume.inN"
        :out-n="leadVolume.outN"
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
            v-for="p in visiblePlatformFilters"
            :key="p.id"
            type="button"
            :aria-pressed="selectedPlatform === p.id"
            @click="filterByPlatform(p.id)"
          >
            {{ p.label }} <span class="ui-seg-n">{{ getChannelCount(p.id) }}</span>
          </button>
        </div>
      </div>

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
              <b>{{ channelHeading(channel) }}</b>
              <span>{{ PLATFORM_KIND[channel.platform] }}</span>
              <span
                class="ui-pill hd-pill"
                :class="channel.isVerified ? 'ui-pill-green' : 'ui-pill-orange'"
              >{{ channel.isVerified ? '已驗證' : '未驗證' }}</span>
              <button
                v-if="isUnnamed(channel)"
                type="button"
                class="name-it"
                @click.stop="editChannel(channel)"
              >
                命名此頻道
              </button>
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

          <div
            v-if="problemIds.has(channel.id)"
            class="chwarn"
            role="alert"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            ><path d="M12 3 2 20h20Z" /><path d="M12 10v4M12 17h.01" /></svg>
            <b class="chwarn-title">Webhook 需注意</b>
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              @click="verifyChannel(channel)"
            >
              重新驗證
            </button>
            <span class="chwarn-text">{{ webhookProblems(channel).join(' ') }}</span>
          </div>

          <div
            v-else-if="channel.isActive"
            class="chwarn is-ok"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            ><path d="M5 12.5 10 17.5 19 7" /></svg>
            <b class="chwarn-title">Webhook 無異常</b>
            <span class="chwarn-text">近 24 小時沒有處理失敗或簽章被拒的紀錄。</span>
          </div>

          <div class="pills">
            <span
              class="ui-pill"
              :class="channel.isVerified ? 'ui-pill-green' : 'ui-pill-orange'"
            >{{ channel.isVerified ? '已驗證' : '未驗證' }}</span>
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
              v-if="!problemIds.has(channel.id)"
              type="button"
              class="btn btn-secondary btn-sm chverify"
              @click="verifyChannel(channel)"
            >
              驗證配置
            </button>
          </div>
        </article>
      </div>

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
import { computed } from 'vue'
import AppLayout from '@/components/ui/AppLayout.vue'
import ChannelConfigDialog from '@/components/channels/ChannelConfigDialog.vue'
import ChannelDetailsModal from '@/components/channels/ChannelDetailsModal.vue'
import ChannelBalance, { type BalanceRow } from '@/components/channels/ChannelBalance.vue'
import { formatLastLogin } from '@/utils/team-tone'
import { platformVolume24h } from '@/utils/channel-volume'
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

/** A platform with no channel is not a tab (an empty WhatsApp tab read as an unavailable feature) */
const visiblePlatformFilters = computed(() =>
  PLATFORM_FILTERS.filter(p => getChannelCount(p.id) > 0 || selectedPlatform.value === p.id))

const problemIds = computed(() => new Set(problemChannels.value.map(c => c.id)))

/** Optional display name lives in configMetadata.name; fall back to the platform. */
function channelTitle(channel: ChannelIntegration): string {
  const name = channel.configMetadata?.name
  return typeof name === 'string' && name.trim() ? name.trim() : `${PLATFORM_KIND[channel.platform]}（未命名）`
}

function isUnnamed(channel: ChannelIntegration): boolean {
  const name = channel.configMetadata?.name
  return !(typeof name === 'string' && name.trim())
}

/** Card heading: the display name, or the plain platform name when none was given (a prompt offers to name it) */
function channelHeading(channel: ChannelIntegration): string {
  return isUnnamed(channel) ? PLATFORM_KIND[channel.platform] : channelTitle(channel)
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
    problems.push(`近 24 小時 ${health.processingFailures24h} 次處理失敗${last}。`)
  }
  if (health.signatureFailureMinutes24h > 0) {
    problems.push(`${health.signatureFailureMinutes24h} 個時段簽章被拒，請確認 Channel Secret。`)
  }
  return problems
}

function hasWebhookProblem(channel: ChannelIntegration): boolean {
  return webhookProblems(channel).length > 0
}

const problemChannels = computed(() => channels.value.filter(hasWebhookProblem))

/** One row per channel for the balance board: the same real counters the lead totals use (disabled channels are listed, not charted) */
const balanceRows = computed<BalanceRow[]>(() =>
  channels.value.map((c) => {
    const act = c.isActive ? c.activity : undefined
    return {
      key: String(c.id),
      label: channelTitle(c),
      platform: c.platform,
      off: !c.isActive,
      inN: act?.customerMessages24h ?? 0,
      outN: act?.agentMessages24h ?? 0,
      inTotal: act?.customerMessagesTotal ?? 0,
      outTotal: act?.agentMessagesTotal ?? 0,
      lastAt: act ? `最後活動 ${act.lastActivityAt ? formatLastLogin(act.lastActivityAt) : '尚無活動'}` : '暫時無法取得訊息量',
      problem: hasWebhookProblem(c)
    }
  }))

/** Never a made-up zero: no total when no active channel reports activity */
const leadVolume = computed(() => {
  const volume = platformVolume24h(channels.value)
  if (!volume) { return { total: null, inN: 0, outN: 0, meaning: '沒有啟用中的頻道提供訊息量' } }
  const { customer: inN, agent: outN } = volume
  return { total: inN + outN, inN, outN, meaning: `客戶來訊 ${formatCount(inN)} · 客服發送 ${formatCount(outN)}` }
})

/** The webhook problem has its own alert under the lead, so the head only counts channels */
const channelSummary = computed(() => {
  const total = channels.value.length
  const active = channels.value.filter(c => c.isActive).length
  return `${total} 個頻道，${active} 個啟用中。`
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
i.in {
  background: var(--ui-blue);
}
i.out {
  background: var(--ui-indigo);
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

/* The webhook warning lives on the card it concerns */
.chwarn {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  gap: 6px 10px;
  align-items: center;
  margin: 4px 20px 0;
  padding: 10px 10px 12px 14px;
  border-radius: 14px;
  background: var(--ui-orange-soft);
  color: var(--ui-orange-ink);
}
.chwarn > svg {
  width: 20px;
  height: 20px;
}
.chwarn-title {
  font: 600 15px / 1.3 var(--ui-font-display);
}
.chwarn-text {
  grid-column: 1 / -1;
  padding-right: 4px;
  font-size: 13.5px;
  line-height: 1.45;
  color: var(--ui-ink);
}
.chwarn.is-ok {
  grid-template-columns: 20px minmax(0, 1fr);
  background: var(--ui-green-soft);
  color: var(--ui-green-ink);
}
.chwarn .btn {
  min-height: 36px;
  background: var(--ui-orange-ink);
  color: #fff;
  font-weight: 600;
}
.name-it {
  display: block;
  margin-top: 2px;
  padding: 0;
  border: 0;
  background: none;
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-accent-ink, var(--ui-accent));
  cursor: pointer;
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
  width: 40px;
  height: 40px;
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
  font-size: 14px;
}
.meta-row .k {
  width: 84px;
  flex: none;
  color: var(--ui-ink-2);
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
  font-size: 14px;
  letter-spacing: 0.02em;
}
.pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 12px 20px 12px;
}
.chverify {
  min-height: 40px;
  padding-inline: 14px;
  background: transparent;
  font-weight: 600;
  color: var(--ui-accent);
}
.chverify:hover {
  background: var(--ui-accent-soft);
}
.chfoot {
  margin-top: auto;
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

/* the verified pill lives under the name on desktop rows, in its own line on cards */
.hd-pill { display: none; }

/* desktop: one wide row per channel (identity | webhook state and ids | 24 h numbers | switch), so a short card never leaves a void and a disabled channel is simply a shorter row */
@media (min-width: 1025px) {
  .chgrid {
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
  }
  .chcard {
    display: grid;
    grid-template-columns: 250px minmax(0, 1fr) minmax(0, 1fr) 120px;
    grid-template-areas: 'head warn meta foot';
    align-items: start;
    column-gap: 28px;
    padding: 20px 22px;
  }
  .chhead { grid-area: head; align-items: flex-start; padding: 0; align-self: start; }
  .pills { display: none; }
  .hd-pill { display: inline-flex; margin-top: 8px; }
  .chname { display: grid; justify-items: start; }
  .chwarn { grid-area: warn; margin: 0; }
  .meta { grid-area: meta; padding: 0; align-self: start; }
  .chcard:not(:has(.chwarn)) .meta { grid-column: 2 / 4; }
  .chfoot .toggle { justify-self: end; }
  .chfoot { grid-area: foot; display: grid; justify-items: end; align-content: space-between; gap: 12px; margin: 0; padding: 0; height: 100%; }
  .chfoot:not(:has(.chverify)) { align-content: start; }
}

@media (max-width: 1024px) {
}
@media (max-width: 1280px) {
  .chgrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 768px) {
  .toolbar .ui-seg button {
    min-height: 44px;
  }
  .more-btn {
    width: 44px;
    height: 44px;
  }
  .chverify {
    min-height: 44px;
  }
  /* phone cards: the ID and the numbers; the free-text description is one tap away in the details */
  .meta-row:nth-child(2) {
    display: none;
  }
  .chhead {
    padding-bottom: 8px;
  }
  .pills {
    padding-top: 10px;
  }
  .chgrid {
    grid-template-columns: minmax(0, 1fr);
  }
  /* a disabled channel is one slim row: who it is and its switch */
  .chcard.off .pills,
  .chcard.off .meta {
    display: none;
  }
  .chcard.off .chfoot {
    padding-top: 0;
  }
  .chwarn {
    margin: 4px 16px 0;
  }
  .chwarn .btn {
    min-height: 44px;
  }
}
</style>
