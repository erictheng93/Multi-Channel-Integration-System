<template>
  <div class="mobile-cards">
    <TransitionGroup
      name="conversation-card"
      appear
    >
      <div
        v-for="conversation in conversations"
        :key="conversation.id"
        class="conversation-card"
        :class="{
          'has-unread': unreadOf(conversation) > 0,
          'is-selected': selectionMode && selectedIds.has(conversation.id)
        }"
        @click="handleCardClick(conversation.id)"
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

        <div class="avatar">
          {{ initialOf(getCustomerName(conversation)) }}
          <span
            v-if="platformOf(conversation) === 'line' || platformOf(conversation) === 'facebook'"
            class="ui-ch ch"
            :class="platformOf(conversation) === 'line' ? 'ui-ch-line' : 'ui-ch-fb'"
          ><svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.7 6.2L5 21l4.1-2.3c.9.2 1.9.3 2.9.3 5.5 0 10-3.6 10-8s-4.5-8-10-8Z" /></svg></span>
        </div>

        <div class="card-main">
          <div class="card-top">
            <span class="customer-name">{{ getCustomerName(conversation) }}</span>
            <span
              v-if="unreadOf(conversation) > 0"
              class="unread-badge"
              :title="UNREAD_HINT"
              :aria-label="`未讀 ${unreadOf(conversation)} 則訊息（${UNREAD_HINT}）`"
            >{{ unreadOf(conversation) }}</span>
            <span class="card-time">{{ relativeTime(getUpdatedAt(conversation), now) }}</span>
          </div>
          <div
            class="last-message"
            :class="{ 'from-agent': conversation.lastMessage?.senderType === 'agent' }"
          >
            <template v-if="conversation.lastMessage?.senderType === 'agent'">
              你：
            </template>{{ getLastMessageText(conversation) }}
          </div>
          <div class="card-pills">
            <span
              v-if="awaitingKind(conversation, now) === 'waiting'"
              class="ui-pill ui-pill-orange"
              :title="WAITING_HINT"
            >待回覆</span>
            <template v-else-if="awaitingKind(conversation, now) === 'stale'">
              <span
                class="ui-pill"
                :title="STALE_HINT"
              >{{ staleWaitText(conversation.awaitingSince, now) }}</span>
              <span
                v-if="conversation.neverReplied"
                class="ui-pill ui-pill-red never-pill"
              >從未回覆</span>
            </template>
            <span
              v-else-if="isReplied(conversation, now)"
              class="replied"
            >已回覆</span>
            <span
              v-if="freeReplySeconds(conversation, now) !== null"
              class="ui-pill ui-pill-green ui-pill-dot"
            >免費回覆 {{ freeReplySeconds(conversation, now) }} 秒</span>
            <span
              class="ui-pill"
              :class="statusPillClass(statusOf(conversation).tone)"
            >{{ statusOf(conversation).text }}</span>
            <span
              v-if="conversation.assignedTeam?.name"
              class="ui-pill"
            >{{ conversation.assignedTeam.name }}</span>
            <span
              v-else
              class="unassigned"
            >未指派</span>
          </div>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import type { Conversation } from '@/types'
import { convertEmojiForConversationList } from '@/utils/layered-emoji-processor'
import {
  UNREAD_HINT,
  WAITING_HINT,
  freeReplySeconds,
  initialOf,
  STALE_HINT,
  awaitingKind,
  staleWaitText,
  isReplied,
  relativeTime,
  statusOf,
  unreadOf,
  useRowClock,
  type StatusTone
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
}>()

const { now } = useRowClock(toRef(props, 'conversations'))

// 選取模式下，點擊整張卡片切換選取而非導覽
const handleCardClick = (id: string) => {
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

const getUpdatedAt = (conversation: Conversation) => {
  const legacyConversation = withLegacyFields(conversation)
  return conversation.updatedAt || legacyConversation.updated_at
}

const statusPillClass = (tone: StatusTone): string =>
  tone === 'active' ? 'ui-pill-blue' : tone === 'pending' ? 'ui-pill-orange' : ''

const getLastMessageText = (conversation: Conversation) => {
  const content = conversation.lastMessage?.content || '暫無訊息'
  return convertEmojiForConversationList(content)
}
</script>

<style scoped>
.mobile-cards {
  display: none;
}

.conversation-card {
  position: relative;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px 16px;
  cursor: pointer;
}

.conversation-card + .conversation-card::before {
  position: absolute;
  top: 0;
  right: 0;
  left: 68px;
  height: 0.5px;
  background: var(--ui-sep);
  content: '';
}

.conversation-card.is-selected {
  background: var(--ui-sel-tint);
  box-shadow: var(--ui-sel-ring);
}

.conversation-card-enter-active,
.conversation-card-leave-active {
  transition: opacity 0.3s var(--ui-ease), transform 0.3s var(--ui-ease);
}

.conversation-card-enter-from,
.conversation-card-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.select-hit {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin: -4px -8px -4px -12px;
  cursor: pointer;
}

.select-checkbox {
  width: 20px;
  height: 20px;
  accent-color: var(--ui-accent);
  cursor: pointer;
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

.card-main {
  min-width: 0;
  flex: 1;
}

.card-top {
  display: flex;
  gap: 6px;
  align-items: center;
}

.customer-name {
  overflow: hidden;
  font-size: 14.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
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
}

.card-time {
  flex: none;
  margin-left: auto;
  font-size: 13px;
  color: var(--ui-muted);
}

.last-message {
  display: -webkit-box;
  margin-top: 2px;
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

.card-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-top: 8px;
}

.replied {
  font-size: 13px;
  color: var(--ui-muted);
}

.unassigned {
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-orange-ink);
}

@media (max-width: 768px) {
  .mobile-cards {
    display: block;
  }
}
</style>
