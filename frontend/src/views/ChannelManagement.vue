<template>
  <AppLayout>
    <div class="ui-page channel-management ui-rise">
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
                class="ui-switch"
                role="switch"
                :aria-checked="channel.isActive"
                :aria-label="channel.isActive ? '停用頻道' : '啟用頻道'"
                @click.stop="toggleChannelStatus(channel)"
              />
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
            <div
              v-if="channelDescription(channel)"
              class="meta-row"
            >
              <span class="k">說明</span>
              <span class="v">{{ channelDescription(channel) }}</span>
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

          <div
            v-if="webhookNotice(channel)"
            class="notice"
            :class="{ quiet: webhookNotice(channel)?.tone === 'quiet' }"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            ><circle
              cx="12"
              cy="12"
              r="9"
            /><path d="M12 8v5M12 16.5h.01" /></svg>
            <span>{{ webhookNotice(channel)?.text }}</span>
          </div>

          <!-- Activity (per platform, not per channel) -->
          <template v-if="channel.activity">
            <div class="scope">
              此平台訊息量 · 近 24 小時
            </div>
            <div class="stats">
              <div class="stat-i">
                <div class="l">
                  客戶來訊
                </div>
                <div class="n">
                  {{ formatCount(channel.activity.customerMessages24h) }}
                </div>
                <div class="s">
                  累計 {{ formatCount(channel.activity.customerMessagesTotal) }}
                </div>
              </div>
              <div class="stat-i">
                <div class="l">
                  客服發送
                </div>
                <div class="n">
                  {{ formatCount(channel.activity.agentMessages24h) }}
                </div>
                <div class="s">
                  累計 {{ formatCount(channel.activity.agentMessagesTotal) }}
                </div>
              </div>
            </div>
            <div class="last">
              此平台最後活動 {{ channel.activity.lastActivityAt ? formatLastLogin(channel.activity.lastActivityAt) : '尚無活動' }}
            </div>
          </template>
          <div
            v-else
            class="last"
          >
            暫時無法取得訊息量
          </div>

          <!-- Card Footer -->
          <div class="chfoot">
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              @click="copyWebhookUrl(channel)"
            >
              複製 Webhook URL
            </button>
            <button
              type="button"
              class="btn btn-sm"
              :class="hasWebhookProblem(channel) ? 'btn-primary' : 'btn-secondary'"
              @click="verifyChannel(channel)"
            >
              {{ hasWebhookProblem(channel) ? '重新驗證' : '驗證配置' }}
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
  return typeof name === 'string' && name.trim() ? name.trim() : getPlatformName(channel.platform)
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

interface WebhookNotice {
  tone: 'warn' | 'quiet'
  text: string
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

function webhookNotice(channel: ChannelIntegration): WebhookNotice | null {
  const problems = webhookProblems(channel)
  if (problems.length > 0) {
    return { tone: 'warn', text: problems.join(' ') }
  }
  if (!channel.isActive) {
    return { tone: 'quiet', text: channel.isVerified ? '已停用。' : '已停用，啟用前請先驗證配置。' }
  }
  if (channel.webhookHealth) {
    return { tone: 'quiet', text: '近 24 小時沒有 webhook 處理或簽章失敗紀錄。' }
  }
  return null
}

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
.chcard.off .meta {
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
.notice {
  display: flex;
  gap: 8px;
  margin: 12px 20px 0;
  padding: 10px 12px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-orange-soft);
  font-size: 13px;
  line-height: 1.45;
  color: var(--ui-orange-ink);
}
.notice svg {
  width: 16px;
  height: 16px;
  flex: none;
  margin-top: 1px;
}
.notice.quiet {
  background: var(--ui-surface-2);
  color: var(--ui-muted);
}
.scope {
  margin: 14px 20px 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-muted);
}
.stats {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin: 6px 20px 0;
  padding: 10px 0 12px;
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
.chcard > .last:first-of-type {
  padding-top: 14px;
}
.chfoot {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: auto;
  padding: 0 20px 18px;
}
.chfoot .btn {
  flex: 1;
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
}
</style>
