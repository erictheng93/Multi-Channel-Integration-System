<template>
  <AppLayout>
    <div class="dashboard ui-rise">
      <!-- Page head -->
      <section class="ui-page-head">
        <div>
          <div class="ui-eyebrow">
            {{ dateLabel }}
          </div>
          <h1 class="ui-page-title">
            {{ greeting }}，{{ displayName }}
          </h1>
          <p class="ui-page-sub">
            <template v-if="summary.data.value">
              {{ subtitle }}
            </template>
            <template v-else-if="summary.error.value">
              無法取得待回覆狀態。
            </template>
            <template v-else>
              &nbsp;
            </template>
          </p>
        </div>
        <div class="ui-page-actions">
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            :disabled="refreshing"
            aria-label="重新整理"
            @click="refreshAll"
          >
            <svg
              class="ico"
              :class="{ spinning: refreshing }"
              viewBox="0 0 24 24"
            ><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M3 21v-5h5" /></svg>
            重新整理
          </button>
          <router-link
            to="/conversations"
            class="btn btn-primary"
          >
            開始回覆
            <svg
              class="ico"
              viewBox="0 0 24 24"
            ><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </router-link>
        </div>
      </section>

      <!-- KPI row -->
      <section class="ui-grid ui-cols-4">
        <article class="ui-card ui-kpi">
          <div class="ui-kpi-top">
            <span
              class="ui-kpi-ico"
              style="background: var(--ui-orange-soft); color: var(--ui-orange-ink)"
            ><svg
              class="ico"
              viewBox="0 0 24 24"
            ><circle
              cx="12"
              cy="12"
              r="9"
            /><path d="M12 7v5l3 2" /></svg></span>
            待回覆
          </div>
          <template v-if="summary.data.value">
            <div class="ui-kpi-value">
              {{ summary.data.value.waiting.count }}
            </div>
            <div
              class="ui-kpi-foot"
              title="待回覆＝客戶來訊後尚無客服回覆"
            >
              客戶來訊後尚無客服回覆
            </div>
          </template>
          <template v-else>
            <div class="ui-kpi-value">
              <span
                v-if="summary.error.value"
                class="dash"
              >—</span>
              <span
                v-else
                class="sk sk-num"
              />
            </div>
            <div class="ui-kpi-foot">
              <span
                v-if="summary.error.value"
                class="retry-text"
              >無法載入 <button
                type="button"
                class="ui-link as-btn"
                @click="refreshAll"
              >重試</button></span>
              <span
                v-else
                class="sk sk-line"
              />
            </div>
          </template>
        </article>

        <article class="ui-card ui-kpi">
          <div class="ui-kpi-top">
            <span
              class="ui-kpi-ico"
              style="background: var(--ui-accent-soft); color: var(--ui-accent)"
            ><svg
              class="ico"
              viewBox="0 0 24 24"
            ><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z" /></svg></span>
            處理中
          </div>
          <template v-if="summary.data.value">
            <div class="ui-kpi-value">
              {{ summary.data.value.openConversations }}
            </div>
            <div class="ui-kpi-foot">
              <template v-if="teamSplit.length > 0">
                {{ teamSplit.map((t) => `${t.name} ${t.open}`).join(' · ') }}
              </template>
              <template v-else>
                尚未結案的對話
              </template>
            </div>
          </template>
          <template v-else>
            <div class="ui-kpi-value">
              <span
                v-if="summary.error.value"
                class="dash"
              >—</span>
              <span
                v-else
                class="sk sk-num"
              />
            </div>
            <div class="ui-kpi-foot">
              <span
                v-if="!summary.error.value"
                class="sk sk-line"
              />
            </div>
          </template>
        </article>

        <article class="ui-card ui-kpi">
          <div class="ui-kpi-top">
            <span
              class="ui-kpi-ico"
              style="background: var(--ui-green-soft); color: var(--ui-green-ink)"
            ><svg
              class="ico"
              viewBox="0 0 24 24"
            ><path d="M4 4h16v12H8l-4 4Z" /></svg></span>
            今日訊息
          </div>
          <template v-if="summary.data.value">
            <div class="ui-kpi-value">
              {{ summary.data.value.customerMessages.today.toLocaleString('en-US') }}
            </div>
            <div class="ui-kpi-foot">
              <template v-if="messagesDelta">
                <span
                  class="ui-delta"
                  :class="deltaClass(messagesDelta.direction)"
                >{{ messagesDelta.text }}</span>
                較昨日同時段
              </template>
              <template v-else>
                客戶傳來的訊息
              </template>
            </div>
          </template>
          <template v-else>
            <div class="ui-kpi-value">
              <span
                v-if="summary.error.value"
                class="dash"
              >—</span>
              <span
                v-else
                class="sk sk-num"
              />
            </div>
            <div class="ui-kpi-foot">
              <span
                v-if="!summary.error.value"
                class="sk sk-line"
              />
            </div>
          </template>
        </article>

        <article class="ui-card ui-kpi">
          <div class="ui-kpi-top">
            <span
              class="ui-kpi-ico"
              style="background: var(--ui-indigo-soft); color: var(--ui-indigo)"
            ><svg
              class="ico"
              viewBox="0 0 24 24"
            ><circle
              cx="9"
              cy="8"
              r="4"
            /><path d="M2 21v-1a6 6 0 0 1 12 0v1M17 11a3 3 0 1 0 0-6M22 21v-1a5 5 0 0 0-4-4.9" /></svg></span>
            線上客服
          </div>
          <template v-if="presence.data.value && presence.data.value.available">
            <div class="ui-kpi-value">
              {{ onlineIds.size }}<small v-if="activeMembers.length > 0">/ {{ activeMembers.length }}</small>
            </div>
            <div class="ui-kpi-foot">
              目前在線的客服
            </div>
          </template>
          <template v-else-if="presence.data.value || presence.error.value">
            <div class="ui-kpi-value">
              <span class="dash">—</span>
            </div>
            <div class="ui-kpi-foot">
              暫時無法取得在線狀態
            </div>
          </template>
          <template v-else>
            <div class="ui-kpi-value">
              <span class="sk sk-num" />
            </div>
            <div class="ui-kpi-foot">
              <span class="sk sk-line" />
            </div>
          </template>
        </article>
      </section>

      <!-- Focus + team -->
      <section class="bento">
        <article class="ui-card focus">
          <div class="focus-lead">
            <div class="lbl">
              等待最久
            </div>
            <template v-if="summary.data.value && topWaiting.length > 0">
              <div class="big">
                {{ oldestWait.value }}<span class="big-unit">{{ oldestWait.unit }}</span>
              </div>
              <div class="lead-sub">
                {{ topWaiting[0]?.customerName || '未命名客戶' }} · {{ teamLabel(topWaiting[0]?.assignedTeamId ?? null) }}
              </div>
            </template>
            <template v-else-if="summary.data.value">
              <div class="big dim">
                0
              </div>
              <div class="lead-sub">
                沒有待回覆的客戶
              </div>
            </template>
            <template v-else-if="summary.error.value">
              <div class="big dim">
                —
              </div>
            </template>
            <template v-else>
              <span class="sk sk-big" />
            </template>
            <p class="note">
              待回覆＝客戶來訊後尚無客服回覆。依等待時間排序，超過 30 分鐘標為紅色。
            </p>
          </div>

          <div class="focus-list">
            <ul
              v-if="topWaiting.length > 0"
              class="ui-list"
            >
              <li
                v-for="item in topWaiting"
                :key="item.conversationId"
                class="ui-row"
              >
                <router-link
                  :to="`/conversations/${item.conversationId}`"
                  class="row-link"
                  :aria-label="`開啟 ${item.customerName || '客戶'} 的對話`"
                />
                <div class="avatar">
                  <img
                    v-if="item.avatarUrl"
                    :src="item.avatarUrl"
                    alt=""
                  >
                  <template v-else>
                    {{ initialOf(item.customerName) }}
                  </template>
                  <span
                    v-if="item.platform === 'line' || item.platform === 'facebook'"
                    class="ui-ch ch"
                    :class="item.platform === 'line' ? 'ui-ch-line' : 'ui-ch-fb'"
                  ><svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.7 6.2L5 21l4.1-2.3c.9.2 1.9.3 2.9.3 5.5 0 10-3.6 10-8s-4.5-8-10-8Z" /></svg></span>
                </div>
                <div class="ui-row-main">
                  <div class="ui-row-title">
                    {{ item.customerName || '未命名客戶' }}
                    <span
                      v-if="item.assignedTeamId === null"
                      class="ui-pill ui-pill-orange"
                    >未指派</span>
                    <span
                      v-else
                      class="ui-pill"
                    >{{ teamLabel(item.assignedTeamId) }}</span>
                  </div>
                  <div class="ui-row-sub">
                    {{ item.lastCustomerMessage || '（非文字訊息）' }}
                  </div>
                </div>
                <div class="ui-row-meta">
                  <div
                    class="wait"
                    :class="waitClass(waitSeconds(item.waitingSince))"
                  >
                    {{ formatWaitText(waitSeconds(item.waitingSince)) }}
                  </div>
                  {{ platformName(item.platform) }}
                </div>
              </li>
            </ul>
            <div
              v-else-if="summary.data.value"
              class="ui-empty"
            >
              <div class="ui-empty-art">
                <svg
                  class="ico"
                  viewBox="0 0 24 24"
                ><path d="m5 12 5 5L20 7" /></svg>
              </div>
              <h3>目前沒有待回覆的客戶</h3>
              <p>客戶來訊後，尚未有客服回覆的對話會依等待時間排在這裡。</p>
            </div>
            <div
              v-else-if="summary.error.value"
              class="ui-empty"
            >
              <h3>無法載入待回覆清單</h3>
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                @click="refreshAll"
              >
                重試
              </button>
            </div>
            <div
              v-else
              class="skel-rows"
            >
              <span
                v-for="n in 4"
                :key="n"
                class="sk sk-row"
              />
            </div>
            <div
              v-if="summary.data.value && waitingCount > topWaiting.length"
              class="focus-foot"
            >
              <router-link
                to="/conversations"
                class="ui-link"
              >
                還有 {{ waitingCount - topWaiting.length }} 件待回覆，前往對話管理
              </router-link>
            </div>
          </div>
        </article>

        <article class="ui-card team-card">
          <div class="ui-card-head">
            <div>
              <h2 class="ui-card-title">
                團隊狀態
              </h2>
              <div class="ui-card-sub">
                <template v-if="presence.data.value && !presence.data.value.available">
                  暫時無法取得在線狀態
                </template>
                <template v-else-if="presence.data.value">
                  {{ onlineIds.size }} 位在線 · 共 {{ activeMembers.length }} 位
                </template>
                <template v-else>
                  &nbsp;
                </template>
              </div>
            </div>
          </div>
          <ul
            v-if="teamRows.length > 0"
            class="people"
          >
            <li
              v-for="p in teamRows"
              :key="p.id"
              class="person"
            >
              <div class="avatar sm">
                {{ initialOf(p.name) }}
                <span
                  v-if="presence.data.value?.available"
                  class="presence"
                  :class="{ off: !p.online }"
                />
              </div>
              <div class="person-main">
                <div class="person-name">
                  {{ p.name }}
                </div>
                <div class="person-sub">
                  {{ p.sub }}
                </div>
              </div>
              <span
                v-if="presence.data.value?.available"
                class="ui-pill"
                :class="p.online ? 'ui-pill-green ui-pill-dot' : ''"
              >{{ p.online ? '在線' : '離線' }}</span>
            </li>
          </ul>
          <div
            v-else-if="members.data.value || members.error.value"
            class="ui-empty compact"
          >
            <p>{{ members.error.value ? '無法載入成員清單' : '尚無團隊成員' }}</p>
          </div>
          <div
            v-else
            class="skel-rows pad"
          >
            <span
              v-for="n in 4"
              :key="n"
              class="sk sk-row"
            />
          </div>
        </article>
      </section>

      <!-- Chart + today -->
      <section class="bento">
        <article class="ui-card">
          <div class="ui-card-head">
            <div>
              <h2 class="ui-card-title">
                訊息量
              </h2>
              <div class="ui-card-sub">
                近 {{ volumeDays }} 天，每日客戶訊息數
              </div>
            </div>
            <div class="ui-card-end">
              <div
                class="ui-seg"
                role="tablist"
                aria-label="訊息量期間"
              >
                <button
                  v-for="d in volumeRanges"
                  :key="d"
                  type="button"
                  role="tab"
                  :class="{ 'is-on': volumeDays === d }"
                  :aria-selected="volumeDays === d"
                  @click="setVolumeDays(d)"
                >
                  {{ d }} 天
                </button>
              </div>
            </div>
          </div>
          <MessageVolumeChart
            v-if="volume.data.value"
            :data="volume.data.value"
          />
          <div
            v-else-if="volume.error.value"
            class="ui-empty compact"
          >
            <h3>無法載入訊息量</h3>
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              @click="refreshAll"
            >
              重試
            </button>
          </div>
          <div
            v-else
            class="chart-skel"
          >
            <span class="sk sk-chart" />
          </div>
        </article>

        <article class="ui-card today-card">
          <div class="ui-card-head">
            <h2 class="ui-card-title">
              今日表現
            </h2>
          </div>
          <div
            v-if="summary.data.value"
            class="stat-list"
          >
            <div class="stat">
              <span class="k">平均首次回覆</span>
              <span class="v">
                <template v-if="firstResponseAvg">{{ firstResponseAvg.value }}<small>{{ firstResponseAvg.unit }}</small></template>
                <template v-else>—</template>
              </span>
              <span
                v-if="firstResponsePrev"
                class="cap"
              >昨天同時段 {{ firstResponsePrev }}</span>
            </div>
            <div class="stat">
              <span class="k">今日已結案</span>
              <span class="v">{{ summary.data.value.resolved.today }}</span>
              <span
                v-if="resolvedDelta"
                class="cap"
              >
                <span
                  class="ui-delta"
                  :class="deltaClass(resolvedDelta.direction)"
                >{{ resolvedDelta.text }}</span>
                較昨日同時段
              </span>
            </div>
            <div class="stat">
              <span class="k">今日已首次回覆</span>
              <span class="v">{{ summary.data.value.firstResponse.today.count }}<small>個新對話</small></span>
            </div>
          </div>
          <div
            v-else-if="summary.error.value"
            class="ui-empty compact"
          >
            <p>無法載入今日表現</p>
          </div>
          <div
            v-else
            class="skel-rows pad"
          >
            <span
              v-for="n in 3"
              :key="n"
              class="sk sk-row"
            />
          </div>

          <template v-if="feed.length > 0">
            <div class="ui-card-head feed-head">
              <h2 class="ui-card-title small">
                最近動態
              </h2>
              <router-link
                v-if="isAdmin"
                to="/activities"
                class="ui-link ui-card-end"
              >
                全部
              </router-link>
            </div>
            <ul class="feed">
              <li
                v-for="a in feed"
                :key="a.id"
              >
                <span
                  class="ico-tile"
                  :class="`tone-${feedKind(a.action)}`"
                >
                  <svg
                    class="ico"
                    viewBox="0 0 24 24"
                  >
                    <path
                      v-if="feedKind(a.action) === 'close'"
                      d="m5 12 5 5L20 7"
                    />
                    <template v-else-if="feedKind(a.action) === 'assign'">
                      <circle
                        cx="9"
                        cy="8"
                        r="4"
                      />
                      <path d="M2 21v-1a6 6 0 0 1 12 0v1" />
                    </template>
                    <path
                      v-else-if="feedKind(a.action) === 'broadcast'"
                      d="m22 2-7 20-4-9-9-4Z"
                    />
                    <path
                      v-else-if="feedKind(a.action) === 'login'"
                      d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"
                    />
                    <template v-else>
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                      />
                      <path d="M12 8v4l2.5 2.5" />
                    </template>
                  </svg>
                </span>
                <div>
                  {{ a.userName }} {{ describeActivity(a) }}
                  <time :datetime="a.createdAt">{{ relativeTime(a.createdAt) }}</time>
                </div>
              </li>
            </ul>
          </template>
        </article>
      </section>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useTokenRefresh } from '@/composables/useTokenRefresh'
import { useActivityTracker } from '@/composables/useActivityTracker'
import {
  useDashboardOverview,
  compareDelta,
  formatWait,
  formatWaitText,
  type VolumeDays
} from '@/composables/dashboard/useDashboardOverview'
import { useUnreadStore } from '@/stores/unread'
import { getActivityDescription, hasActivityLabel } from '@/components/activity/utils'
import type { ActivityLog } from '@/api/activities'
import AppLayout from '@/components/ui/AppLayout.vue'
import MessageVolumeChart from '@/components/dashboard/MessageVolumeChart.vue'

const router = useRouter()
const { currentAgent, isAdmin } = useAuth()
const unreadStore = useUnreadStore()

const {
  summary, volume, stats, presence, members, activities,
  teamNames, volumeDays, waitingCount, oldestWaitSeconds, waitSeconds,
  onlineIds, activeMembers, setVolumeDays, refresh, now
} = useDashboardOverview()

const volumeRanges: VolumeDays[] = [7, 30, 90]

// ---- header ----
const displayName = computed(() => currentAgent.value?.displayName || currentAgent.value?.name || '')
const greeting = computed(() => {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Taipei' })
    .format(new Date(now.value)))
  if (hour >= 5 && hour < 12) { return '早安' }
  if (hour >= 12 && hour < 18) { return '午安' }
  return '晚安'
})
const dateLabel = computed(() => new Intl.DateTimeFormat('zh-TW', {
  month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Taipei'
}).format(new Date(now.value)))

// No spaces around full-width punctuation: sentences are joined here, not in the template
const subtitle = computed(() => {
  const waitPart = waitingCount.value > 0
    ? `${waitingCount.value} 件待回覆，最久已等 ${oldestWaitText.value}。`
    : '目前沒有待回覆的客戶。'
  const unreadPart = unreadStore.total > 0 ? `我的未讀 ${unreadStore.total} 件。` : ''
  return `${waitPart}${unreadPart}`
})

const oldestWaitText = computed(() =>
  oldestWaitSeconds.value === null ? '' : formatWaitText(oldestWaitSeconds.value))

// ---- 待回覆 focus ----
const topWaiting = computed(() => summary.data.value?.waiting.top ?? [])
const oldestWait = computed(() => formatWait(oldestWaitSeconds.value ?? 0))
const waitClass = (seconds: number): string => seconds >= 30 * 60 ? 'hot' : seconds >= 15 * 60 ? 'warm' : ''

const teamLabel = (teamId: number | null): string => {
  if (teamId === null) { return '未指派' }
  return teamNames.value[teamId]
    ?? currentAgent.value?.teams?.find((t) => t.id === teamId)?.name
    ?? `團隊 ${teamId}`
}

const platformName = (platform: string | null): string =>
  platform === 'line' ? 'LINE' : platform === 'facebook' ? 'Messenger' : ''

const initialOf = (name: string | null | undefined): string => (name?.trim().charAt(0) || '?').toUpperCase()

// ---- 處理中 split by team ----
const teamSplit = computed(() => (stats.data.value?.byTeam ?? [])
  .filter((t) => t.open > 0)
  .map((t) => ({ name: teamLabel(t.teamId), open: t.open })))

// ---- deltas ----
const messagesDelta = computed(() => {
  const m = summary.data.value?.customerMessages
  return m ? compareDelta(m.today, m.yesterdaySameTime) : null
})
const resolvedDelta = computed(() => {
  const r = summary.data.value?.resolved
  return r ? compareDelta(r.today, r.yesterdaySameTime) : null
})
const deltaClass = (direction: 'up' | 'down' | 'flat'): string =>
  direction === 'up' ? 'ui-delta-up' : direction === 'down' ? 'ui-delta-down' : ''

const minutesFormat = (seconds: number | null): { value: string; unit: string } | null => {
  if (seconds === null) { return null }
  const { value, unit } = formatWait(seconds)
  return { value, unit: unit === '分' ? '分鐘' : unit }
}
const firstResponseAvg = computed(() => minutesFormat(summary.data.value?.firstResponse.today.avgSeconds ?? null))
const firstResponsePrev = computed(() => {
  const prev = minutesFormat(summary.data.value?.firstResponse.yesterdaySameTime.avgSeconds ?? null)
  return prev ? `${prev.value} ${prev.unit}` : ''
})

// ---- team presence (online / offline only) ----
const ROLE_IN_TEAM: Record<string, string> = { member: '成員', lead: '組長', supervisor: '主管' }
const teamRows = computed(() => activeMembers.value
  .map((m) => {
    const primary = m.teams?.find((t) => t.isPrimary) ?? m.teams?.[0]
    const teamName = m.primaryTeamName ?? primary?.teamName
    const role = m.role === 'admin' ? '管理員' : primary ? ROLE_IN_TEAM[primary.roleInTeam] : '客服'
    return {
      id: String(m.id),
      name: m.name || m.email || '未命名',
      online: onlineIds.value.has(String(m.id)),
      sub: teamName ? `${teamName} · ${role}` : role
    }
  })
  .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name, 'zh-Hant'))
  .slice(0, 8))

// ---- recent activity (hidden when empty) ----
const feed = computed<ActivityLog[]>(() => activities.data.value ?? [])
// Always Chinese: actions without a label fall back to a generic phrase instead of the raw code
const describeActivity = (a: ActivityLog): string =>
  hasActivityLabel(a.action) ? getActivityDescription(a) : '進行了操作'

type FeedKind = 'close' | 'assign' | 'broadcast' | 'login' | 'generic'
const feedKind = (action: string): FeedKind => {
  if (action === 'conversation_close' || action === 'conversation_auto_close' || action === 'conversation_reopen') { return 'close' }
  if (action === 'conversation_assign' || action === 'conversation_bulk_assign' || action === 'conversation_transfer') { return 'assign' }
  if (action.startsWith('broadcast_')) { return 'broadcast' }
  if (action === 'user_login' || action === 'user_logout') { return 'login' }
  return 'generic'
}
const relativeTime = (iso: string): string => {
  const diff = Math.max(0, now.value - Date.parse(iso)) / 1000
  if (diff < 60) { return '剛剛' }
  const m = Math.floor(diff / 60)
  if (m < 60) { return `${m} 分鐘前` }
  const h = Math.floor(m / 60)
  if (h < 24) { return `${h} 小時前` }
  return `${Math.floor(h / 24)} 天前`
}

// ---- refresh / lifecycle ----
const refreshing = ref(false)
const refreshAll = async (): Promise<void> => {
  refreshing.value = true
  try { await refresh() } finally { refreshing.value = false }
}

// Re-entering /dashboard via the router refreshes the numbers
watch(() => router.currentRoute.value.path, (path, oldPath) => {
  if (path === '/dashboard' && oldPath !== path) { void refreshAll() }
})

const tokenRefresh = useTokenRefresh()
const activityTracker = useActivityTracker()

onMounted(() => {
  tokenRefresh.startTokenRefreshCheck()
  activityTracker.startTracking()
})

onBeforeUnmount(() => {
  tokenRefresh.stopTokenRefreshCheck()
  activityTracker.stopTracking()
})
</script>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.ico {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.btn .ico {
  width: 16px;
  height: 16px;
}

.ico.spinning {
  animation: dash-spin 0.9s linear infinite;
}

@keyframes dash-spin {
  to {
    transform: rotate(360deg);
  }
}

.bento {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 16px;
}

.bento > :first-child {
  grid-column: span 8;
}

.bento > :last-child {
  grid-column: span 4;
}

.dash {
  color: var(--ui-faint);
}

.retry-text {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.as-btn {
  padding: 0;
  border: 0;
  background: none;
}

/* ---- focus card ---- */
.focus {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  overflow: hidden;
}

.focus-lead {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 22px;
  background: linear-gradient(180deg, var(--ui-orange-soft), transparent 85%);
}

.focus-lead .lbl {
  font-weight: 600;
  color: var(--ui-ink-2);
}

.focus-lead .big {
  font: 600 52px / 1 var(--ui-font-display);
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
}

.focus-lead .big.dim {
  color: var(--ui-faint);
}

.big-unit {
  margin-left: 4px;
  font-size: 20px;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--ui-muted);
}

.lead-sub {
  font-size: 13px;
  color: var(--ui-muted);
}

.focus-lead .note {
  margin: auto 0 0;
  padding-top: 12px;
  font-size: 12.5px;
  color: var(--ui-muted);
}

.focus-list {
  padding: 6px 0;
  min-width: 0;
}

.focus-list .ui-row {
  cursor: pointer;
}

.row-link {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.focus-foot {
  padding: 8px 22px 10px;
}

.wait {
  font: 600 13px var(--ui-font-display);
  font-variant-numeric: tabular-nums;
  color: var(--ui-ink);
}

.wait.hot {
  color: var(--ui-red-ink);
}

.wait.warm {
  color: var(--ui-orange-ink);
}

.avatar {
  position: relative;
  display: grid;
  flex: none;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: linear-gradient(160deg, #b9b6f5, #6e6bd8);
  color: #fff;
  font: 600 14px var(--ui-font-display);
}

.avatar img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.avatar .ch {
  position: absolute;
  right: -4px;
  bottom: -4px;
  width: 15px;
  height: 15px;
  border-radius: 5px;
  box-shadow: 0 0 0 2px var(--ui-surface);
}

.avatar .ch svg {
  width: 9px;
  height: 9px;
}

.avatar.sm {
  width: 32px;
  height: 32px;
  font-size: 13px;
  background: linear-gradient(160deg, #5aa8ff, #1d6fe0);
}

.avatar .presence {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--ui-green);
  box-shadow: 0 0 0 2px var(--ui-surface);
}

.avatar .presence.off {
  background: var(--ui-faint);
}

/* ---- team card ---- */
.people {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0 0 8px;
  list-style: none;
}

.person {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 8px 22px;
}

.person-main {
  min-width: 0;
  flex: 1;
}

.person-name {
  overflow: hidden;
  font-size: 13.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.person-sub {
  overflow: hidden;
  font-size: 12px;
  color: var(--ui-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---- today card ---- */
.stat-list {
  display: grid;
  padding: 4px 0 10px;
}

.stat {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 2px 10px;
  align-items: baseline;
  padding: 12px 22px;
}

.stat + .stat::before {
  position: absolute;
  top: 0;
  right: 22px;
  left: 22px;
  height: 0.5px;
  background: var(--ui-sep);
  content: '';
}

.stat .k {
  font-size: 13.5px;
  color: var(--ui-ink-2);
}

.stat .v {
  margin-left: auto;
  font: 600 22px var(--ui-font-display);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.stat .v small {
  margin-left: 2px;
  font-size: 13px;
  font-weight: 500;
  color: var(--ui-muted);
}

.stat .cap {
  flex-basis: 100%;
  font-size: 11.5px;
  color: var(--ui-muted);
}

.feed-head {
  padding-top: 6px;
}

.ui-card-title.small {
  font-size: 15px;
}

.feed {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 0 22px 18px;
  list-style: none;
}

.feed li {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 10px;
  font-size: 13px;
  line-height: 1.45;
}

.ico-tile {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 9px;
  background: var(--ui-fill);
  color: var(--ui-muted);
}

.ico-tile.tone-close {
  background: var(--ui-green-soft);
  color: var(--ui-green-ink);
}

.ico-tile.tone-assign {
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
}

.ico-tile.tone-broadcast {
  background: var(--ui-p-lavender);
  color: var(--ui-p-lavender-ink);
}

.ico-tile.tone-login {
  background: var(--ui-orange-soft);
  color: var(--ui-orange-ink);
}

.feed time {
  display: block;
  font-size: 11.5px;
  color: var(--ui-muted);
}

/* ---- empty / skeleton ---- */
.ui-empty.compact {
  padding: 28px 24px 32px;
}

.skel-rows {
  display: grid;
  gap: 14px;
  padding: 14px 22px;
}

.skel-rows.pad {
  padding-bottom: 20px;
}

.chart-skel {
  padding: 8px 22px 22px;
}

.sk {
  display: block;
  border-radius: 8px;
  background: linear-gradient(90deg, var(--ui-fill) 25%, var(--ui-surface-2) 50%, var(--ui-fill) 75%);
  background-size: 200% 100%;
  animation: dash-shimmer 1.5s ease-in-out infinite;
}

.sk-num {
  width: 64px;
  height: 34px;
}

.sk-line {
  width: 60%;
  height: 12px;
}

.sk-big {
  width: 100px;
  height: 52px;
}

.sk-row {
  height: 38px;
}

.sk-chart {
  height: 200px;
  border-radius: 14px;
}

@keyframes dash-shimmer {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sk,
  .ico.spinning {
    animation: none;
  }
}

@media (max-width: 1280px) {
  .bento > :first-child,
  .bento > :last-child {
    grid-column: span 12;
  }
}

@media (max-width: 768px) {
  .focus {
    grid-template-columns: minmax(0, 1fr);
  }

  .focus-lead .note {
    display: none;
  }
}
</style>
