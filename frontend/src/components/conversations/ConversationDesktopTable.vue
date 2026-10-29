<template>
  <div class="desktop-table ui-table-wrap">
    <table class="ui-table conversations-table">
      <thead>
        <tr>
          <th
            v-if="selectionMode"
            class="select-col"
          >
            <label class="select-hit">
              <input
                ref="selectAllRef"
                type="checkbox"
                class="select-checkbox"
                aria-label="全選本頁對話"
                :checked="allSelected"
                @change="$emit('toggle-select-all')"
              >
            </label>
          </th>
          <th class="customer-col">
            客戶
          </th>
          <th class="message-col">
            最後訊息
          </th>
          <th
            class="status-col"
            :title="LEGEND_TEXT"
          >
            <span class="status-head">
              狀態
              <span
                class="legend-i"
                aria-hidden="true"
              >i</span>
            </span>
            <span class="sr-only">{{ LEGEND_TEXT }}</span>
          </th>
          <th class="agent-col">
            負責人
          </th>
          <th class="time-col">
            更新
          </th>
        </tr>
      </thead>
      <TransitionGroup
        name="conversation-list"
        tag="tbody"
        appear
      >
        <tr
          v-for="conversation in conversations"
          :key="conversation.id"
          class="conversation-row"
          :class="{
            'has-unread': unreadOf(conversation) > 0,
            'is-selected': selectionMode && selectedIds.has(conversation.id)
          }"
          @click="handleRowClick(conversation.id)"
        >
          <td
            v-if="selectionMode"
            class="select-cell"
          >
            <label
              class="select-hit"
              @click.stop
            >
              <input
                type="checkbox"
                class="select-checkbox"
                :aria-label="`選取 ${getCustomerName(conversation)} 的對話`"
                :checked="selectedIds.has(conversation.id)"
                @change="$emit('toggle-select', conversation.id)"
              >
            </label>
          </td>
          <td class="customer-cell">
            <div class="customer-info">
              <div class="avatar">
                {{ initialOf(getCustomerName(conversation)) }}
                <span
                  v-if="platformOf(conversation) === 'line' || platformOf(conversation) === 'facebook'"
                  class="ui-ch ch"
                  :class="platformOf(conversation) === 'line' ? 'ui-ch-line' : 'ui-ch-fb'"
                ><svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.7 6.2L5 21l4.1-2.3c.9.2 1.9.3 2.9.3 5.5 0 10-3.6 10-8s-4.5-8-10-8Z" /></svg></span>
              </div>
              <div class="customer-text">
                <div class="customer-name">
                  <span
                    class="customer-name-text"
                    :title="getCustomerName(conversation)"
                  >{{ getCustomerName(conversation) }}</span>
                  <span
                    v-if="unreadOf(conversation) > 0"
                    class="unread-badge"
                    :title="UNREAD_HINT"
                    :aria-label="`未讀 ${unreadOf(conversation)} 則訊息（${UNREAD_HINT}）`"
                  >{{ unreadOf(conversation) }}</span>
                </div>
                <div class="customer-id">
                  {{ platformName(platformOf(conversation)) }}{{ sinceText(conversation) }}
                </div>
              </div>
            </div>
          </td>
          <td class="message-cell">
            <div
              class="last-message"
              :class="{ 'from-agent': conversation.lastMessage?.senderType === 'agent' }"
            >
              <template v-if="conversation.lastMessage?.senderType === 'agent'">
                你：
              </template>{{ getLastMessageText(conversation) }}
            </div>
          </td>
          <td class="status-cell">
            <template v-if="replyStateOf(conversation, now).state === 'stale'">
              <span
                class="ui-pill"
                :title="STALE_HINT"
              >{{ replyStateOf(conversation, now).text }}</span>
              <span
                v-if="conversation.neverReplied"
                class="ui-pill ui-pill-red never-pill"
                title="這位客戶從未收到客服回覆"
              >從未回覆</span>
            </template>
            <span
              v-else
              class="ui-pill"
              :class="replyPillClass(replyStateOf(conversation, now).state)"
              :title="replyStateOf(conversation, now).state === 'waiting' ? WAITING_HINT : undefined"
            >{{ replyStateOf(conversation, now).text }}</span>
            <span
              v-if="freeReplySeconds(conversation, now) !== null"
              class="ui-pill ui-pill-green ui-pill-dot free-pill"
              title="Reply API 免費回覆時間"
            >免費回覆 {{ freeReplySeconds(conversation, now) }} 秒</span>
          </td>
          <td class="agent-cell">
            <span
              v-if="conversation.assignedTeam?.name"
              class="ui-pill"
            >{{ conversation.assignedTeam.name }}</span>
            <span
              v-else
              class="ui-pill ui-pill-orange unassigned"
            >未指派</span>
          </td>
          <td
            class="time-cell"
            :title="formatFull(getUpdatedAt(conversation))"
          >
            {{ relativeTime(getUpdatedAt(conversation), now) }}
          </td>
        </tr>
      </TransitionGroup>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRef, watchEffect } from 'vue'
import type { Conversation } from '@/types'
import { convertEmojiForConversationList } from '@/utils/layered-emoji-processor'
import {
  LEGEND_TEXT,
  UNREAD_HINT,
  WAITING_HINT,
  freeReplySeconds,
  initialOf,
  STALE_HINT,
  replyStateOf,
  type ReplyState,
  platformName,
  relativeTime,
  unreadOf,
  useRowClock
} from '@/composables/conversation/useConversationRowMeta'

const props = withDefaults(defineProps<{
  conversations: Conversation[]
  selectionMode?: boolean
  selectedIds?: ReadonlySet<string>
}>(), {
  selectionMode: false,
  selectedIds: () => new Set<string>()
})

const emit = defineEmits<{
  select: [id: string]
  'toggle-select': [id: string]
  'toggle-select-all': []
}>()

const { now } = useRowClock(toRef(props, 'conversations'))

const selectAllRef = ref<HTMLInputElement | null>(null)

const selectedOnPage = computed(
  () => props.conversations.filter(c => props.selectedIds.has(c.id)).length
)
const allSelected = computed(
  () => props.conversations.length > 0 && selectedOnPage.value === props.conversations.length
)

// indeterminate 只能透過 DOM property 設定
watchEffect(() => {
  if (selectAllRef.value) {
    selectAllRef.value.indeterminate = selectedOnPage.value > 0 && !allSelected.value
  }
}, { flush: 'post' })

// 選取模式下，點擊整列切換選取而非導覽
const handleRowClick = (id: string) => {
  if (props.selectionMode) {
    emit('toggle-select', id)
  } else {
    emit('select', id)
  }
}

interface LegacyConversationFields {
  customer_name?: string
  updated_at?: string
}

type ConversationWithLegacyFields = Conversation & LegacyConversationFields

const withLegacyFields = (conversation: Conversation): ConversationWithLegacyFields => {
  return conversation as ConversationWithLegacyFields
}

const getCustomerName = (conversation: Conversation) => {
  const legacyConversation = withLegacyFields(conversation)
  return conversation.customer?.name || conversation.user?.name || legacyConversation.customer_name || '未知用戶'
}

const platformOf = (conversation: Conversation): string =>
  conversation.platform || conversation.user?.platform || 'line'

// Secondary identity line: the channel plus when the conversation began (real createdAt)
const sinceText = (conversation: Conversation): string => {
  const created = conversation.createdAt
  if (!created) { return '' }
  const text = relativeTime(created, now.value)
  return text ? ` · ${text}開始` : ''
}

const getUpdatedAt = (conversation: Conversation) => {
  const legacyConversation = withLegacyFields(conversation)
  return conversation.updatedAt || legacyConversation.updated_at
}

const replyPillClass = (state: ReplyState): string =>
  state === 'waiting' ? 'ui-pill-orange' : state === 'replied' ? 'ui-pill-green' : ''

const formatFull = (date?: Date | number | string) => {
  if (!date) { return '' }
  const dateObj = new Date(date)
  return Number.isNaN(dateObj.getTime()) ? '' : dateObj.toLocaleString('zh-TW')
}

const getLastMessageText = (conversation: Conversation) => {
  const content = conversation.lastMessage?.content || '暫無訊息'
  return convertEmojiForConversationList(content)
}
</script>

<style scoped>
.desktop-table {
  display: block;
}

.conversations-table {
  table-layout: fixed;
}

.conversation-list-enter-active,
.conversation-list-leave-active {
  transition: opacity 0.3s var(--ui-ease), transform 0.3s var(--ui-ease);
}

.conversation-list-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.conversation-list-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.conversation-list-move {
  transition: transform 0.3s var(--ui-ease);
}

.conversation-row {
  cursor: pointer;
}

.conversation-row.is-selected {
  background: var(--ui-sel-tint);
  box-shadow: var(--ui-sel-ring);
}

/* Selection column */
.select-col,
.select-cell {
  width: 56px;
  padding-right: 0 !important;
}

.select-hit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin: -12px 0;
  cursor: pointer;
}

.select-checkbox {
  width: 20px;
  height: 20px;
  accent-color: var(--ui-accent);
  cursor: pointer;
}

/* Column widths */
.customer-col {
  width: 26%;
}

.message-col {
  width: 31%;
}

.status-col {
  width: 17%;
}

.agent-col {
  width: 14%;
}

.time-col {
  width: 12%;
  text-align: right !important;
}

.status-head {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.legend-i {
  display: inline-grid;
  place-items: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--ui-fill-strong);
  color: var(--ui-muted);
  font-size: 13px;
  font-weight: 700;
  cursor: help;
}

.customer-info {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.avatar {
  position: relative;
  display: grid;
  flex: none;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(160deg, #b9b6f5, #6e6bd8);
  color: #fff;
  font: 600 15px var(--ui-font-display);
}

.avatar .ch {
  position: absolute;
  right: -4px;
  bottom: -4px;
  width: 16px;
  height: 16px;
  border-radius: 5px;
  box-shadow: 0 0 0 2px var(--ui-surface);
}

.avatar .ch svg {
  width: 10px;
  height: 10px;
}

.customer-text {
  min-width: 0;
}

.customer-name {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 14.5px;
  font-weight: 600;
  white-space: nowrap;
}

/* Long names truncate with an ellipsis (full name in the title); the unread badge always stays visible */
.customer-name-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.unread-badge {
  display: inline-grid;
  flex: none;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--ui-accent);
  color: #fff;
  font: 600 11px var(--ui-font-display);
  font-variant-numeric: tabular-nums;
}

.customer-id {
  overflow: hidden;
  font-size: 13px;
  color: var(--ui-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.last-message {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-clamp: 2;
  font-size: 13.5px;
  color: var(--ui-ink);
  word-break: break-word;
}

.has-unread .last-message {
  font-weight: 600;
}

.last-message.from-agent {
  color: var(--ui-muted);
}

.status-cell {
  white-space: nowrap;
}

.status-cell .never-pill {
  margin-left: 4px;
}

.free-pill {
  display: flex;
  width: fit-content;
  margin-top: 4px;
}

.time-cell {
  font-size: 13px;
  color: var(--ui-muted);
  text-align: right;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .desktop-table {
    display: none;
  }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
