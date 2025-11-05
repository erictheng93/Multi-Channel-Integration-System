<template>
  <!-- Extracted Header Component - Simplified -->
  <div class="conversation-header">
    <div class="header-left">
      <button
        class="back-button"
        @click="$emit('back')"
      >
        <ArrowLeftIcon />
        返回列表
      </button>

      <div class="conversation-info">
        <div class="customer-details">
          <div class="customer-avatar">
            {{ customerInitials }}
          </div>
          <div class="customer-meta">
            <h1 class="customer-name">
              {{ conversation?.customer?.name || '載入中...' }}
            </h1>
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
              <!-- 🆕 指派資訊徽章 -->
              <AssignmentBadge
                v-if="conversation"
                :team-id="conversation.assignedTeamId"
                :team-name="conversation.assignedTeam?.name"
                :agent-id="conversation.assignedUserId"
                :agent-name="conversation.assignedAgent?.name"
              />
            </div>

            <!-- 客戶標籤顯示區 -->
            <div
              v-if="customerTags.length > 0"
              class="customer-tags"
            >
              <div
                v-for="tag in customerTags.slice(0, 3)"
                :key="tag.id"
                class="tag-chip"
                :style="{ backgroundColor: tag.color + '20', borderColor: tag.color }"
              >
                <div
                  class="tag-dot"
                  :style="{ backgroundColor: tag.color }"
                />
                <span class="tag-label">{{ tag.name }}</span>
              </div>
              <button
                v-if="customerTags.length > 3"
                class="more-tags-btn"
                @click="showAllTags = !showAllTags"
              >
                +{{ customerTags.length - 3 }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="header-actions">
      <!-- 指派管理按鈕 -->
      <div
        v-if="conversation && conversation.status !== 'closed'"
        class="assign-action-wrapper"
      >
        <button
          class="assign-action-btn"
          :class="{ 'has-assignment': conversation.assignedTeamId || conversation.assignedUserId }"
          @click="toggleAssignPanel"
        >
          <UserPlusIcon class="action-icon" />
          <!-- 🆕 顯示團隊或代理名稱 -->
          <span v-if="conversation.assignedUserId && conversation.assignedAgent?.name">
            {{ conversation.assignedAgent.name }}
          </span>
          <span v-else-if="conversation.assignedTeamId && conversation.assignedTeam?.name">
            {{ conversation.assignedTeam.name }}
          </span>
          <span v-else>指派管理</span>
          <ChevronDownIcon
            class="dropdown-icon"
            :class="showAssignPanel ? 'rotated' : ''"
          />
        </button>

        <!-- 指派面板 -->
        <div
          v-if="showAssignPanel"
          class="assign-panel-dropdown"
        >
          <AdvancedAssignActions
            :conversation="conversation"
            @assigned="handleAssigned"
            @unassigned="handleUnassigned"
            @error="handleAssignError"
          />
        </div>
      </div>

      <!-- 標籤管理按鈕 -->
      <div
        v-if="conversation?.customer?.id && customerIdNumber"
        class="tag-selector-wrapper"
      >
        <TagSelector
          v-model="selectedTagIds"
          :customer-id="customerIdNumber"
          @change="handleTagsChange"
        />
      </div>
      <button
        v-if="conversation?.status !== 'closed'"
        class="close-conversation-btn"
        :class="{ 'is-closing': closing }"
        :disabled="closing"
        @click="$emit('close')"
      >
        <AlertCircleIcon
          :size="20"
          class="btn-icon"
        />
        <span class="btn-text">{{ closing ? '結束中...' : '結束對話' }}</span>
        <span class="btn-warning">此操作不可恢復</span>
      </button>

      <button
        class="btn btn-secondary"
        :disabled="loading"
        @click="$emit('refresh')"
      >
        <RefreshIcon :spinning="loading" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { ArrowLeftIcon, AlertCircleIcon, RefreshIcon, UserPlusIcon, ChevronDownIcon } from '@/components/icons'
import PlatformBadge from '../ui/PlatformBadge.vue'
import StatusBadge from '../ui/StatusBadge.vue'
import AssignmentBadge from '../ui/AssignmentBadge.vue'
import TagSelector from '@/components/customer/TagSelector.vue'
import AdvancedAssignActions from './AdvancedAssignActions.vue'
import type { Conversation } from '@/types'
import { getCustomerTags, setCustomerTags, type Tag } from '@/api/tags'
import { useToast } from '@/composables/useToast'

interface Props {
  conversation?: Conversation
  loading?: boolean
  closing?: boolean
}

const props = defineProps<Props>()

defineEmits<{
  back: []
  close: []
  refresh: []
}>()

const customerTags = ref<Tag[]>([])
const selectedTagIds = ref<number[]>([])
const showAllTags = ref(false)
const showAssignPanel = ref(false)

// Toast notifications
const { showSuccess, showError } = useToast()

const customerInitials = computed(() => {
  const name = props.conversation?.customer?.name
  if (!name) {return '?'}
  return name.slice(0, 2).toUpperCase()
})

// 將 customer.id (string) 轉為數字
const customerIdNumber = computed(() => {
  const id = props.conversation?.customer?.id
  if (!id) {return null}
  const num = parseInt(id, 10)
  return isNaN(num) ? null : num
})

// 載入客戶標籤
const loadCustomerTags = async () => {
  if (!customerIdNumber.value) {return}

  try {
    const response = await getCustomerTags(customerIdNumber.value)
    if (response.success) {
      customerTags.value = response.data
      selectedTagIds.value = response.data.map(t => t.id)
    }
  } catch (error) {
    console.error('Failed to load customer tags:', error)
  }
}

// 處理標籤變更
const handleTagsChange = async (tags: Tag[]) => {
  // 計算變化
  const previousTagIds = new Set(customerTags.value.map(t => t.id))
  const newTagIds = new Set(tags.map(t => t.id))

  const added = tags.filter(t => !previousTagIds.has(t.id))
  const removed = customerTags.value.filter(t => !newTagIds.has(t.id))

  customerTags.value = tags

  // 自動同步到後端 - 使用 setCustomerTags 替換所有標籤
  if (customerIdNumber.value) {
    try {
      const tagIds = tags.map(t => t.id)
      await setCustomerTags(customerIdNumber.value, tagIds)

      // 顯示成功提示（參考團隊管理的 Toast 風格）
      if (added.length > 0 && removed.length > 0) {
        showSuccess('標籤更新成功', `已新增 ${added.length} 個標籤，移除 ${removed.length} 個標籤`)
      } else if (added.length > 0) {
        const tagNames = added.map(t => t.name).join('、')
        showSuccess('標籤新增成功', `已成功新增標籤：${tagNames}`)
      } else if (removed.length > 0) {
        const tagNames = removed.map(t => t.name).join('、')
        showSuccess('標籤移除成功', `已成功移除標籤：${tagNames}`)
      } else {
        showSuccess('標籤更新成功', '客戶標籤已更新')
      }
    } catch (error) {
      console.error('Failed to update customer tags:', error)
      showError('標籤更新失敗', '無法更新客戶標籤，請稍後再試')
    }
  }
}

// 指派管理功能
const toggleAssignPanel = () => {
  const before = showAssignPanel.value
  showAssignPanel.value = !showAssignPanel.value
  const after = showAssignPanel.value

  // 🔧 DEBUG: 添加调试日志
  console.log('🔍 [AssignPanel] Toggle clicked', {
    before,
    after,
    conversation: {
      id: props.conversation?.id,
      status: props.conversation?.status,
      assignedTeamId: props.conversation?.assignedTeamId,
      assignedUserId: props.conversation?.assignedUserId
    },
    timestamp: new Date().toISOString()
  })

  // 验证 DOM 渲染
  setTimeout(() => {
    const dropdown = document.querySelector('.assign-panel-dropdown')
    console.log('🔍 [AssignPanel] Dropdown element:', dropdown)

    if (dropdown) {
      const rect = dropdown.getBoundingClientRect()
      const styles = window.getComputedStyle(dropdown)
      console.log('🔍 [AssignPanel] Dropdown styles:', {
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
      console.log('🔍 [AssignPanel] Dropdown content length:', content.length)
      if (content.length < 100) {
        console.warn('⚠️ [AssignPanel] Dropdown content seems empty or very small!')
      }
    } else {
      console.error('❌ [AssignPanel] Dropdown element NOT found in DOM!')
    }
  }, 100)
}

const handleAssigned = (conversation: Conversation, assignedTo: string) => {
  console.log('Conversation assigned:', { conversationId: conversation.id, assignedTo })
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
  console.log('Conversation unassigned:', conversation.id)
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

// 監聽對話變化
watch(() => props.conversation?.customer?.id, (newId) => {
  if (newId) {
    loadCustomerTags()
  }
}, { immediate: true })

onMounted(() => {
  loadCustomerTags()
})
</script>

<style scoped>
.conversation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--background-color);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.back-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color);
  background: var(--background-color);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.back-button:hover {
  background: var(--hover-color);
}

.customer-details {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.customer-avatar {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
}

.customer-name {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827; /* Force dark text for contrast with light background */
}

.customer-badges {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* ====== 漸進式警示按鈕設計 (Progressive Alert Design) ====== */
.close-conversation-btn {
  /* 佈局與間距 */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  position: relative;
  overflow: hidden;

  /* 文字樣式 */
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.25rem;
  white-space: nowrap;
  user-select: none;

  /* Level 1: 默認警告狀態 (Mint Green Warning) - 方案 D */
  color: #064e3b; /* green-900 */
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); /* green-100 to green-200 */
  border: 2px solid #10b981; /* green-500 */
  border-radius: 0.5rem;

  /* 陰影與過渡 */
  box-shadow: 0 1px 3px rgba(16, 185, 129, 0.1);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 圖標樣式 */
.close-conversation-btn .btn-icon {
  flex-shrink: 0;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 主文字 */
.close-conversation-btn .btn-text {
  transition: opacity 0.3s ease;
}

/* 警告文字 (默認隱藏) */
.close-conversation-btn .btn-warning {
  position: absolute;
  bottom: -1.5rem;
  left: 50%;
  transform: translateX(-50%);

  padding: 0.25rem 0.75rem;
  background: rgba(239, 68, 68, 0.95); /* red-500 with opacity */
  color: white;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 0.375rem;
  white-space: nowrap;

  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease, transform 0.3s ease;

  /* 小箭頭 */
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.close-conversation-btn .btn-warning::before {
  content: '';
  position: absolute;
  top: -0.25rem;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 0.25rem solid transparent;
  border-right: 0.25rem solid transparent;
  border-bottom: 0.25rem solid rgba(239, 68, 68, 0.95);
}

/* Level 2: Hover 警示狀態 (Red Alert) */
.close-conversation-btn:hover:not(:disabled) {
  /* 顏色漸變到紅色 */
  color: #991b1b; /* red-900 */
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); /* red-100 to red-200 */
  border-color: #ef4444; /* red-500 */

  /* 增強陰影 */
  box-shadow:
    0 4px 12px rgba(239, 68, 68, 0.2),
    0 2px 4px rgba(239, 68, 68, 0.1);

  /* 輕微上浮 */
  transform: translateY(-2px);
}

/* Hover 時圖標震動效果 */
.close-conversation-btn:hover:not(:disabled) .btn-icon {
  animation: icon-shake 0.5s ease-in-out;
}

/* Hover 時顯示警告文字 */
.close-conversation-btn:hover:not(:disabled) .btn-warning {
  opacity: 1;
  transform: translateX(-50%) translateY(0.25rem);
}

/* Active 按下狀態 */
.close-conversation-btn:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
  box-shadow: 0 2px 6px rgba(239, 68, 68, 0.15);
}

/* Disabled/Loading 狀態 */
.close-conversation-btn:disabled,
.close-conversation-btn.is-closing {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  background: #e5e7eb; /* gray-200 */
  border-color: #d1d5db; /* gray-300 */
  color: #6b7280; /* gray-500 */
  box-shadow: none;
}

.close-conversation-btn:disabled .btn-warning,
.close-conversation-btn.is-closing .btn-warning {
  display: none;
}

/* 圖標震動動畫 */
@keyframes icon-shake {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-8deg); }
  50% { transform: rotate(8deg); }
  75% { transform: rotate(-8deg); }
}

/* 移動端優化 */
@media (max-width: 768px) {
  .close-conversation-btn {
    padding: 0.625rem 1rem;
    font-size: 0.8125rem;
  }

  .close-conversation-btn .btn-warning {
    bottom: -1.25rem;
    font-size: 0.6875rem;
    padding: 0.2rem 0.625rem;
  }
}

.btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  background: var(--background-color);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:hover:not(:disabled) {
  background: var(--hover-color);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 客戶標籤樣式 */
.customer-tags {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.75rem;
  border: 1px solid;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.2s;
}

.tag-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.tag-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  flex-shrink: 0;
}

.tag-label {
  line-height: 1;
}

.more-tags-btn {
  padding: 0.25rem 0.5rem;
  border: 1px dashed var(--border-color);
  background: transparent;
  border-radius: 9999px;
  font-size: 0.75rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.more-tags-btn:hover {
  background: var(--hover-color);
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.tag-selector-wrapper {
  position: relative;
}

/* 指派功能樣式 */
.assign-action-wrapper {
  position: relative;
  display: inline-block;
}

.assign-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.25rem;
  color: var(--gray-700, #374151);
  background-color: white;
  border: 1px solid var(--gray-300, #d1d5db);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  user-select: none;
}

.assign-action-btn:hover {
  background-color: var(--gray-50, #f9fafb);
  border-color: var(--gray-400, #9ca3af);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.assign-action-btn.has-assignment {
  background-color: var(--green-50, #f0fdf4);
  border-color: var(--green-300, #86efac);
  color: var(--green-700, #15803d);
}

.assign-action-btn.has-assignment:hover {
  background-color: var(--green-100, #dcfce7);
  border-color: var(--green-400, #4ade80);
}

.action-icon {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
}

.dropdown-icon {
  width: 0.875rem;
  height: 0.875rem;
  transition: transform 0.2s ease;
}

.dropdown-icon.rotated {
  transform: rotate(180deg);
}

.assign-panel-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  z-index: 50;
  min-width: 24rem;
  max-width: 32rem;
  background: white;
  border: 1px solid var(--gray-200, #e5e7eb);
  border-radius: 0.75rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  animation: dropdown-appear 0.2s ease-out;
}

@keyframes dropdown-appear {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 響應式設計 */
@media (max-width: 768px) {
  .assign-panel-dropdown {
    right: auto;
    left: 0;
    min-width: calc(100vw - 2rem);
    max-width: calc(100vw - 2rem);
  }

  .assign-action-btn span {
    display: none;
  }

  .assign-action-btn .action-icon {
    margin-right: 0;
  }
}
</style>