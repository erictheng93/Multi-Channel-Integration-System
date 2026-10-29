<template>
  <!-- Extracted Header Component - Simplified -->
  <div class="conversation-header">
    <div class="header-left">
      <button
        class="back-button"
        aria-label="返回列表"
        @click="$emit('back')"
      >
        <ArrowLeftIcon />
        <span class="back-label">返回列表</span>
      </button>

      <div class="conversation-info">
        <div class="customer-details">
          <div class="customer-avatar">
            {{ customerInitials }}
          </div>
          <div class="customer-meta">
            <CustomerNameEditor
              :customer-id="customerIdNumber"
              :display-name="conversation?.customer?.name"
              :custom-name="conversation?.customer?.customName"
              :platform-name="conversation?.customer?.platformName"
              :platform="conversation?.platform || conversation?.customer?.platform"
            />
            <div class="customer-badges">
              <PlatformBadge
                v-if="conversation"
                :platform="conversation.platform || 'unknown'"
                show-icon
              />
              <StatusBadge
                v-if="conversation"
                :status="conversation.status"
              />
              <!--  指派資訊徽章 -->
              <!-- Note: Individual assignment removed - only team-based assignment is supported now -->
              <AssignmentBadge
                v-if="conversation"
                :team-id="conversation.assignedTeamId"
                :team-name="conversation.assignedTeam?.name"
              />

              <!--  New Customer Badge - Shows for customers who joined within 7 days -->
              <NewCustomerBadge
                v-if="conversation?.customer?.createdAt"
                :created-at="conversation.customer.createdAt"
                size="medium"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="header-actions">
      <!-- 標示為未讀按鈕：設定手動未讀標記，讓其他客服在列表看到未讀徽章
           （即使最後一則訊息是客服傳送，後端也會將未讀數下限設為 1） -->
      <button
        class="header-action-btn"
        :disabled="!conversation || isClosed"
        :title="isClosed ? '已結案的對話不會顯示未讀' : '標示為未讀'"
        @click="$emit('markUnread')"
      >
        <MailIcon :size="18" />
      </button>

      <!-- 搜索按鈕 -->
      <button
        class="header-action-btn"
        title="搜索消息"
        @click="$emit('search')"
      >
        <SearchIcon :size="18" />
      </button>

      <!-- 匯出對話記錄按鈕 -->
      <button
        class="header-action-btn"
        title="匯出此對話記錄"
        @click="$emit('export')"
      >
        <DownloadIcon :size="18" />
      </button>

      <!-- 指派管理按鈕 - Redesigned -->
      <div
        v-if="conversation"
        class="assign-action-wrapper"
      >
        <!-- Note: Individual assignment (assignedUserId) removed - only team-based assignment is supported now -->
        <button
          class="assign-action-btn"
          :class="{
            'has-assignment': conversation.assignedTeamId,
            'opened': showAssignPanel
          }"
          @click="toggleAssignPanel"
        >
          <!-- Status Indicator Dot -->
          <span
            class="status-dot"
            :class="{ 'active': conversation.assignedTeamId }"
          />

          <!-- User Icon with Animation Container -->
          <span class="icon-container">
            <UserPlusIcon class="action-icon" />
          </span>

          <!-- Text with Truncation -->
          <span class="button-text">
            <span v-if="conversation.assignedTeamId && conversation.assignedTeam?.name">
              {{ conversation.assignedTeam.name }}
            </span>
            <span v-else>指派管理</span>
          </span>

          <!-- Dropdown Icon with Smooth Rotation -->
          <span class="chevron-container">
            <ChevronDownIcon
              :class="showAssignPanel ? 'dropdown-icon rotated' : 'dropdown-icon'"
            />
          </span>
        </button>
      </div>

      <!-- 指派面板 - 使用 Teleport 移到 body 層級 -->
      <Teleport to="body">
        <div
          v-if="showAssignPanel && conversation"
          ref="assignPanelRef"
          class="assign-panel-dropdown"
          :style="assignPanelStyle"
          @click.stop
        >
          <AdvancedAssignActions
            :conversation="conversation"
            @assigned="handleAssigned"
            @unassigned="handleUnassigned"
            @error="handleAssignError"
          />
        </div>
      </Teleport>

      <!-- 客戶標籤管理按鈕 -->
      <div
        v-if="conversation?.customer?.id && customerIdNumber"
        class="tag-selector-wrapper"
      >
        <TagSelector
          v-model="selectedTagIds"
          :customer-id="customerIdNumber"
          button-label="客戶標籤"
          @change="handleTagsChange"
        />
      </div>
      <!-- 結案 / 重新開啟按鈕 -->
      <button
        v-if="conversation"
        class="btn btn-secondary btn-sm close-toggle-btn"
        :disabled="togglingClosed"
        @click="handleToggleClosed"
      >
        <RefreshIcon
          v-if="isClosed"
          :size="16"
        />
        <CheckIcon
          v-else
          :size="16"
        />
        <span>{{ isClosed ? '重新開啟' : '結案' }}</span>
      </button>

      <button
        class="header-action-btn"
        title="重新整理"
        aria-label="重新整理"
        :disabled="loading"
        @click="$emit('refresh')"
      >
        <RefreshIcon :spinning="loading" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { createLogger } from '@/utils/logger'

const props = defineProps<Props>()
const emit = defineEmits<{
  back: []
  refresh: []
  search: []
  export: []
  markUnread: []
  'tags-change': [tags: Tag[]]
}>()
const frontendLogger = createLogger('ConversationHeader')
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ArrowLeftIcon, RefreshIcon, UserPlusIcon, ChevronDownIcon, SearchIcon, DownloadIcon, MailIcon, CheckIcon } from '@/components/icons'
import PlatformBadge from '../ui/PlatformBadge.vue'
import StatusBadge from '../ui/StatusBadge.vue'
import AssignmentBadge from '../ui/AssignmentBadge.vue'
// New Customer Badge Component
import NewCustomerBadge from '../ui/NewCustomerBadge.vue'
import TagSelector from '@/components/customer/TagSelector.vue'
import AdvancedAssignActions from './AdvancedAssignActions.vue'
import CustomerNameEditor from './CustomerNameEditor.vue'
import type { Conversation } from '@/types'
import { getCustomerTags, setCustomerTags, type Tag } from '@/api/tags'
import { useToast } from '@/composables/useToast'
import { useConversationsStore } from '@/stores/conversations'

interface Props {
  conversation?: Conversation
  loading?: boolean
}

const customerTags = ref<Tag[]>([])
const selectedTagIds = ref<number[]>([])
const showAssignPanel = ref(false)
const assignPanelRef = ref<HTMLElement | null>(null)
const assignPanelStyle = ref<Record<string, string>>({})

// 防止 stale 請求覆蓋新數據的 request ID
let tagLoadRequestId = 0

// Toast notifications
const { showSuccess, showError } = useToast()
const conversationsStore = useConversationsStore()

const togglingClosed = ref(false)
const isClosed = computed(() => props.conversation?.status === 'closed')

const handleToggleClosed = async () => {
  const conv = props.conversation
  if (!conv || togglingClosed.value) { return }
  const closing = !isClosed.value
  togglingClosed.value = true
  try {
    const ok = await conversationsStore.setConversationClosed(String(conv.id), closing)
    if (ok) {
      showSuccess(closing ? '已結案' : '已重新開啟')
    } else {
      showError(closing ? '結案失敗' : '重新開啟失敗')
    }
  } finally {
    togglingClosed.value = false
  }
}

const customerInitials = computed(() => {
  const name = props.conversation?.customer?.name
  if (!name) {return '?'}
  return name.slice(0, 1).toUpperCase()
})

// 將 customer.id (string) 轉為數字
const customerIdNumber = computed(() => {
  const id = props.conversation?.customer?.id
  if (!id) {return null}
  const num = parseInt(id, 10)
  return isNaN(num) ? null : num
})

// 載入客戶標籤（帶 stale request 防護）
const loadCustomerTags = async () => {
  if (!customerIdNumber.value) {return}

  // 遞增 request ID，記錄本次請求的 ID
  const currentRequestId = ++tagLoadRequestId

  try {
    const response = await getCustomerTags(customerIdNumber.value)
    // 只有當這是最新的請求時才更新數據，防止 stale 回應覆蓋
    if (response.success && currentRequestId === tagLoadRequestId) {
      customerTags.value = response.data
      selectedTagIds.value = response.data.map(t => t.id)
      emit('tags-change', response.data)
    }
  } catch (error) {
    console.error('Failed to load customer tags:', error)
  }
}

// 處理客戶標籤變更
const handleTagsChange = async (tags: Tag[]) => {
  // 計算變化
  const previousTagIds = new Set(customerTags.value.map(t => t.id))
  const newTagIds = new Set(tags.map(t => t.id))

  const added = tags.filter(t => !previousTagIds.has(t.id))
  const removed = customerTags.value.filter(t => !newTagIds.has(t.id))

  customerTags.value = tags
  emit('tags-change', tags)

  // 自動同步到後端 - 使用 setCustomerTags 替換所有標籤
  if (customerIdNumber.value) {
    try {
      const tagIds = tags.map(t => t.id)
      await setCustomerTags(customerIdNumber.value, tagIds)

      // 顯示成功提示（參考團隊管理的 Toast 風格）
      if (added.length > 0 && removed.length > 0) {
        showSuccess('客戶標籤更新成功', `已新增 ${added.length} 個標籤，移除 ${removed.length} 個標籤`)
      } else if (added.length > 0) {
        const tagNames = added.map(t => t.name).join('、')
        showSuccess('客戶標籤新增成功', `已成功新增標籤：${tagNames}`)
      } else if (removed.length > 0) {
        const tagNames = removed.map(t => t.name).join('、')
        showSuccess('客戶標籤移除成功', `已成功移除標籤：${tagNames}`)
      } else {
        showSuccess('客戶標籤更新成功', '客戶標籤已更新')
      }
    } catch (error) {
      console.error('Failed to update customer tags:', error)
      showError('客戶標籤更新失敗', '無法更新客戶標籤，請稍後再試')
    }
  }
}

// 指派管理功能
const toggleAssignPanel = () => {
  const before = showAssignPanel.value
  showAssignPanel.value = !showAssignPanel.value
  const after = showAssignPanel.value

  // 計算下拉選單位置（使用 Teleport 時需要）
  if (after) {
    nextTick(() => {
      const assignButton = document.querySelector('.assign-action-btn') as HTMLElement
      if (assignButton) {
        const rect = assignButton.getBoundingClientRect()
        assignPanelStyle.value = {
          position: 'fixed',
          top: `${rect.bottom + 8}px`,
          left: `${rect.left + rect.width / 2}px`,
          transform: 'translateX(-50%)',
          zIndex: '10000'
        }
      }
    })
  }

  // DEBUG: 添加调试日志
  frontendLogger.debug('[AssignPanel] Toggle clicked', {
    before,
    after,
    conversation: {
      id: props.conversation?.id,
      status: props.conversation?.status,
      assignedTeamId: props.conversation?.assignedTeamId
      // Note: assignedUserId removed - only team-based assignment is supported now
    },
    timestamp: new Date().toISOString()
  })

  // 验证 DOM 渲染
  setTimeout(() => {
    const dropdown = document.querySelector('.assign-panel-dropdown')
    frontendLogger.debug('[AssignPanel] Dropdown element:', dropdown)

    if (dropdown) {
      const rect = dropdown.getBoundingClientRect()
      const styles = window.getComputedStyle(dropdown)
      frontendLogger.debug('[AssignPanel] Dropdown styles:', {
        display: styles.display,
        visibility: styles.visibility,
        opacity: styles.opacity,
        position: styles.position,
        zIndex: styles.zIndex,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        }
      })

      // 检查 AdvancedAssignActions 内容
      const content = dropdown.innerHTML
      frontendLogger.debug('[AssignPanel] Dropdown content length:', content.length)
      if (content.length < 100) {
        console.warn('[AssignPanel] Dropdown content seems empty or very small!')
      }
    } else {
      console.error('[AssignPanel] Dropdown element NOT found in DOM!')
    }
  }, 100)
}

const handleAssigned = (conversation: Conversation, assignedTo: string) => {
  frontendLogger.debug('Conversation assigned:', { conversationId: conversation.id, assignedTo })
  showAssignPanel.value = false
  // 刷新對話以獲取最新狀態
  setTimeout(() => {
    if (props.conversation?.id) {
      // 通知父組件刷新
      // emit('refresh') // 如果需要的話可以添加這個事件
    }
  }, 500)
}

const handleUnassigned = (conversation: Conversation) => {
  frontendLogger.debug('Conversation unassigned:', conversation.id)
  showAssignPanel.value = false
}

const handleAssignError = (message: string) => {
  console.error('Assignment error:', message)
  showError('指派失敗', message)
}

// 點擊外部關閉指派面板
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  const assignWrapper = document.querySelector('.assign-action-wrapper')

  if (showAssignPanel.value && assignWrapper && !assignWrapper.contains(target)) {
    showAssignPanel.value = false
  }
}

// 監聽全局點擊事件
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})

// 監聽客戶變化 — 切換時立即清空舊標籤，防止殘留顯示
watch(() => props.conversation?.customer?.id, (newId, oldId) => {
  if (newId !== oldId) {
    // 立即清空，避免切換對話時短暫顯示上一個客戶的標籤
    customerTags.value = []
    selectedTagIds.value = []
    emit('tags-change', [])
  }
  if (newId) {
    loadCustomerTags()
  }
}, { immediate: true })

// Template refs (exposed to satisfy TypeScript noUnusedLocals)
defineExpose({
  assignPanelRef
})
</script>

<style scoped>
.conversation-header {
  position: relative;
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  padding: 12px 16px;
  background: var(--ui-surface);
  box-shadow: inset 0 -0.5px 0 var(--ui-sep);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

/* Icon-only round back button (label kept for screen readers) */
.back-button {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--ui-ink-2);
  cursor: pointer;
  transition: background-color var(--ui-dur) var(--ui-ease);
}

.back-button:hover {
  background: var(--ui-fill);
}

.back-label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

.conversation-info {
  min-width: 0;
}

.customer-details {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.customer-avatar {
  display: grid;
  flex: none;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(160deg, #5aa8ff, #1d6fe0);
  color: #fff;
  font: 600 15px var(--ui-font-display);
}

.customer-meta {
  min-width: 0;
}

.customer-badges {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

/* Round icon buttons */
.header-action-btn {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--ui-ink-2);
  cursor: pointer;
  transition: background-color var(--ui-dur) var(--ui-ease), color var(--ui-dur) var(--ui-ease);
}

.header-action-btn:hover:not(:disabled) {
  background: var(--ui-fill);
  color: var(--ui-ink);
}

.header-action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.close-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.tag-selector-wrapper {
  display: flex;
  align-items: center;
}

/* 指派管理: capsule that shows the current team */
.assign-action-wrapper {
  position: relative;
}

.assign-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  max-width: 220px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: var(--ui-fill);
  color: var(--ui-ink);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--ui-dur) var(--ui-ease);
}

.assign-action-btn:hover {
  background: var(--ui-fill-strong);
}

.assign-action-btn.has-assignment {
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
}

.assign-action-btn.opened {
  background: var(--ui-fill-strong);
}

.assign-action-btn.has-assignment.opened {
  background: var(--ui-accent-soft);
}

.status-dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ui-faint);
}

.status-dot.active {
  background: var(--ui-accent);
}

.icon-container {
  display: inline-flex;
  flex: none;
}

.action-icon {
  width: 16px;
  height: 16px;
}

.button-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chevron-container {
  display: inline-flex;
  flex: none;
}

.dropdown-icon {
  width: 12px;
  height: 12px;
  transition: transform var(--ui-dur) var(--ui-ease);
}

.dropdown-icon.rotated {
  transform: rotate(180deg);
}

.assign-panel-dropdown {
  /* Position is computed in JS (Teleport to body) */
  min-width: 20rem;
  max-width: 28rem;
  overflow: hidden;
  border-radius: 18px;
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow-raised);
  animation: dropdown-appear 0.2s var(--ui-ease);
  pointer-events: auto;
}

@keyframes dropdown-appear {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-8px);
  }

  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

@media (max-width: 768px) {
  .conversation-header {
    padding: 10px 12px;
  }

  .header-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .assign-action-btn {
    max-width: 170px;
  }

  .assign-panel-dropdown {
    left: 50%;
    min-width: calc(100vw - 2rem);
    max-width: calc(100vw - 2rem);
    transform: translateX(-50%);
  }
}

/* Short phone viewport (on-screen keyboard open): keep name, badges and every action;
   drop the decorative avatar. */
@media (max-width: 768px) and (max-height: 600px) {
  .conversation-header {
    padding: 6px 12px;
    gap: 4px;
  }

  .customer-avatar {
    display: none;
  }

  .customer-badges {
    margin-top: 0;
  }
}

/* Touch: round icon buttons reach the 44px target size */
@media (pointer: coarse) {
  .header-action-btn,
  .back-button {
    min-width: 44px;
    min-height: 44px;
  }

  .assign-action-btn {
    min-height: 44px;
  }
}
</style>
