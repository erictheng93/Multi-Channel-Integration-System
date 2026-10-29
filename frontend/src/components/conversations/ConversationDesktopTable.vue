<template>
  <div class="desktop-table">
    <!-- Selection mode: one "select all" row heads the group -->
    <label
      v-if="selectionMode"
      class="select-all"
    >
      <input
        ref="selectAllRef"
        type="checkbox"
        class="select-checkbox"
        aria-label="全選本頁對話"
        :checked="allSelected"
        @change="$emit('toggle-select-all')"
      >
      全選本頁
    </label>
    <TransitionGroup
      name="conversation-list"
      tag="ul"
      class="conv-list"
      appear
    >
      <li
        v-for="conversation in conversations"
        :key="conversation.id"
        class="conversation-row"
        :class="{
          'has-unread': unreadOf(conversation) > 0,
          'is-selected': selectionMode && selectedIds.has(conversation.id)
        }"
        tabindex="0"
        @click="handleRowClick(conversation.id)"
        @keydown.enter.self="handleRowClick(conversation.id)"
      >
        <label
          v-if="selectionMode"
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
        <div
          class="last-message"
          :class="{ 'from-agent': conversation.lastMessage?.senderType === 'agent' }"
        >
          <template v-if="conversation.lastMessage?.senderType === 'agent'">
            你：
          </template>{{ getLastMessageText(conversation) }}
        </div>
        <div class="status-cell">
          <!-- A pill only for the exceptions that need an agent (waiting / stale); every other state is quiet text -->
          <div class="status-line">
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
              v-else-if="replyStateOf(conversation, now).state === 'waiting'"
              class="ui-pill ui-pill-orange"
              :title="WAITING_HINT"
            >{{ replyStateOf(conversation, now).text }}</span>
            <span
              v-else
              class="state-text"
              :class="`state-${replyStateOf(conversation, now).state}`"
            >{{ replyStateOf(conversation, now).text }}</span>
          </div>
          <span
            v-if="conversation.assignedTeam?.name"
            class="team-text"
          >{{ conversation.assignedTeam.name }}</span>
          <span
            v-else
            class="team-text unassigned"
          >未指派</span>
        </div>
        <div
          class="time-cell"
          :title="formatFull(getUpdatedAt(conversation))"
        >
          <span class="time-text">{{ relativeTime(getUpdatedAt(conversation), now) }}</span>
          <span
            v-if="freeReplySeconds(conversation, now) !== null"
            class="free-pill"
            title="Reply API 免費回覆時間"
          >免費回覆 {{ freeReplySeconds(conversation, now) }} 秒</span>
        </div>
      </li>
    </TransitionGroup>
    <span class="sr-only">{{ LEGEND_TEXT }}</span>
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

.conv-list {
  margin: 0;
  padding: 0;
  list-style: none;
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

/* One inset-grouped row: identity | last message | state + team | time (+ free reply) */
.conversation-row {
  position: relative;
  display: grid;
  grid-template-columns: minmax(220px, 0.9fr) minmax(0, 1.3fr) 150px 128px;
  gap: 8px 24px;
  align-items: center;
  padding: 13px 20px 13px 28px;
  cursor: pointer;
  transition: background var(--ui-dur) var(--ui-ease);
}

.conversation-row + .conversation-row::before {
  position: absolute;
  top: 0;
  right: 20px;
  left: 86px;
  height: 0.5px;
  background: var(--ui-sep);
  content: '';
}

.conversation-row:hover {
  background: color-mix(in srgb, var(--section-hue) 5%, var(--ui-surface));
}

.conversation-row:focus-visible {
  outline: none;
  background: color-mix(in srgb, var(--section-hue) 7%, var(--ui-surface));
  box-shadow: inset 3px 0 0 var(--section-hue);
}

.conversation-row.is-selected {
  background: color-mix(in srgb, var(--section-hue) 8%, var(--ui-surface));
  box-shadow: var(--ui-sel-ring);
}

/* Unread: a section-hue dot in the gutter (Mail style) plus a heavier message line */
.conversation-row.has-unread::after {
  position: absolute;
  top: 50%;
  left: 11px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--section-hue);
  transform: translateY(-50%);
  content: '';
}

.select-all {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 500;
  color: var(--ui-ink-2);
  box-shadow: inset 0 -0.5px 0 var(--ui-sep);
  cursor: pointer;
}

.select-hit {
  position: absolute;
  top: 50%;
  left: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  transform: translateY(-50%);
  cursor: pointer;
}

.conversation-row:has(.select-hit) {
  padding-left: 68px;
}

.conversation-row:has(.select-hit)::before {
  left: 126px !important;
}

.select-checkbox {
  width: 20px;
  height: 20px;
  accent-color: var(--ui-accent);
  cursor: pointer;
}

.customer-info {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.avatar {
  position: relative;
  display: grid;
  flex: none;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(160deg, #b9b6f5, #6e6bd8);
  color: #fff;
  font: 600 16px var(--ui-font-display);
}

.avatar .ch {
  position: absolute;
  right: -4px;
  bottom: -4px;
  width: 17px;
  height: 17px;
  border-radius: 6px;
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
  font-size: 15px;
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
  background: var(--section-ink);
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
  font-size: 14px;
  line-height: 1.45;
  color: var(--ui-ink-2);
  word-break: break-word;
}

.has-unread .last-message {
  font-weight: 600;
  color: var(--ui-ink);
}

.last-message.from-agent {
  color: var(--ui-muted);
}

.status-cell {
  display: grid;
  gap: 4px;
  justify-items: start;
  white-space: nowrap;
}

.status-line .ui-pill-orange {
  font-weight: 600;
}

.status-line {
  display: flex;
  gap: 4px;
  align-items: center;
}

/* Quiet states: a dot and plain text instead of a pill on every row */
.state-text,
.team-text {
  font-size: 13px;
  color: var(--ui-muted);
}

.state-text {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.state-text::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ui-faint);
}

.state-text.state-replied::before {
  background: var(--ui-green);
}

.team-text:not(.unassigned) {
  color: var(--ui-ink-2);
}

/* Free-reply countdown is time-critical: a green capsule under the timestamp */
.free-pill {
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--ui-green-soft);
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--ui-green-ink);
}

.time-cell {
  display: grid;
  gap: 4px;
  justify-items: end;
  font-size: 13px;
  color: var(--ui-muted);
  text-align: right;
  white-space: nowrap;
}

@media (max-width: 1024px) {
  .conversation-row {
    grid-template-columns: minmax(180px, 1fr) minmax(0, 1.2fr) 130px;
  }

  .time-cell {
    grid-column: 3;
    justify-items: start;
    text-align: left;
  }
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
