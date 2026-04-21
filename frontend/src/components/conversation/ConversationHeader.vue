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

            <!-- 客戶標籤顯示區 -->
            <div
              v-if="customerTags.length > 0"
              class="customer-tags"
            >
              <span class="tags-label">標籤:</span>
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
      <!-- 結束對話按鈕 - 暫時移除，未來有需求再加入 -->

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
import { createLogger } from '@/utils/logger'

const props = defineProps<Props>()
defineEmits<{
  back: []
  // close: []  // 暫時移除 - 結束對話功能未來再加入
  refresh: []
  search: []
  export: []
}>()
const frontendLogger = createLogger('ConversationHeader')
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ArrowLeftIcon, RefreshIcon, UserPlusIcon, ChevronDownIcon, SearchIcon, DownloadIcon } from '@/components/icons'
import PlatformBadge from '../ui/PlatformBadge.vue'
import StatusBadge from '../ui/StatusBadge.vue'
import AssignmentBadge from '../ui/AssignmentBadge.vue'
// New Customer Badge Component
import NewCustomerBadge from '../ui/NewCustomerBadge.vue'
import TagSelector from '@/components/customer/TagSelector.vue'
import AdvancedAssignActions from './AdvancedAssignActions.vue'
import type { Conversation } from '@/types'
import { getCustomerTags, setCustomerTags, type Tag } from '@/api/tags'
import { useToast } from '@/composables/useToast'
// Note: CONVERSATION_STATUS.CLOSED removed - status cleanup

interface Props {
  conversation?: Conversation
  loading?: boolean
  // closing?: boolean  // 暫時移除 - 結束對話功能未來再加入
}

const customerTags = ref<Tag[]>([])
const selectedTagIds = ref<number[]>([])
const showAllTags = ref(false)
const showAssignPanel = ref(false)
const assignPanelRef = ref<HTMLElement | null>(null)
const assignPanelStyle = ref<Record<string, string>>({})

// 防止 stale 請求覆蓋新數據的 request ID
let tagLoadRequestId = 0

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
/* Font Import - Professional Typography */
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

.conversation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--background-color);
  position: relative;
  z-index: 10;
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

/* 搜索按鈕樣式 */
.header-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border-color, #e5e7eb);
  background: var(--background-color, white);
  border-radius: 0.5rem;
  color: var(--gray-600, #4b5563);
  cursor: pointer;
  transition: all 0.2s;
}

.header-action-btn:hover {
  background: var(--hover-color, #f3f4f6);
  color: var(--primary-color, #6366f1);
  border-color: var(--primary-color, #6366f1);
}

/* 結束對話按鈕樣式 - 暫時移除，未來有需求再加入 */

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

/* 標籤分類標籤 */
.tags-label {
  font-size: 0.7rem;
  color: var(--gray-500);
  font-weight: 500;
  margin-right: 0.25rem;
}

.tag-selector-wrapper {
  position: relative;
  z-index: 10;
}

/* ============================================
    REFINED ASSIGNMENT BUTTON - REDESIGNED
   ============================================ */

.assign-action-wrapper {
  position: relative;
  display: inline-block;
}

/* Base Button Styles */
.assign-action-btn {
  /* Layout */
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 1.125rem;
  position: relative;
  overflow: hidden;
  isolation: isolate;

  /* Typography */
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.25rem;
  letter-spacing: -0.01em;

  /* Colors - Unassigned State (Warm Neutral) */
  color: #3f3f46;
  background: linear-gradient(135deg, #ffffff 0%, #fafafa 100%);
  border: 1.5px solid #e4e4e7;

  /* Shape & Effects */
  border-radius: 0.625rem;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.04),
    0 0 0 1px rgba(0, 0, 0, 0.02);

  /* Interaction */
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  transition:
    all 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Status Indicator Dot */
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #d4d4d8;
  flex-shrink: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 0 0 2px rgba(212, 212, 216, 0.15);
}

.status-dot.active {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  box-shadow:
    0 0 0 3px rgba(16, 185, 129, 0.15),
    0 0 8px rgba(16, 185, 129, 0.3);
  animation: pulse-dot 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse-dot {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.85;
    transform: scale(1.1);
  }
}

/* Icon Container with Animation */
.icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.action-icon {
  width: 1.125rem;
  height: 1.125rem;
  flex-shrink: 0;
  stroke-width: 2.25;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Button Text with Truncation */
.button-text {
  flex: 1;
  min-width: 0;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  position: relative;
  font-weight: 600;
}

/* Fade-out effect for long text */
.button-text::after {
  content: '';
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 24px;
  background: linear-gradient(to right, transparent 0%, currentColor 100%);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.assign-action-btn:hover .button-text::after {
  opacity: 0.05;
}

/* Chevron Container */
.chevron-container {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 0.125rem;
}

.dropdown-icon {
  width: 0.875rem;
  height: 0.875rem;
  flex-shrink: 0;
  stroke-width: 2.5;
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  opacity: 0.7;
}

.dropdown-icon.rotated {
  transform: rotate(180deg);
  opacity: 1;
}

/* ============================================
   ASSIGNED STATE (Sophisticated Emerald)
   ============================================ */
.assign-action-btn.has-assignment {
  color: #065f46;
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 50%, #6ee7b7 100%);
  border-color: #34d399;
  box-shadow:
    0 1px 3px rgba(16, 185, 129, 0.12),
    0 0 0 1px rgba(16, 185, 129, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

.assign-action-btn.has-assignment .action-icon {
  color: #059669;
}

.assign-action-btn.has-assignment .button-text {
  font-weight: 600;
}

/* ============================================
   HOVER STATE
   ============================================ */
.assign-action-btn:hover {
  transform: translateY(-1px);
  border-color: #a1a1aa;
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.08),
    0 2px 4px rgba(0, 0, 0, 0.04),
    0 0 0 1px rgba(0, 0, 0, 0.03);
}

.assign-action-btn:hover .icon-container {
  transform: scale(1.08);
}

.assign-action-btn:hover .action-icon {
  stroke-width: 2.5;
}

.assign-action-btn:hover .dropdown-icon {
  opacity: 1;
}

/* Assigned State Hover */
.assign-action-btn.has-assignment:hover {
  border-color: #10b981;
  background: linear-gradient(135deg, #a7f3d0 0%, #6ee7b7 50%, #34d399 100%);
  box-shadow:
    0 6px 16px rgba(16, 185, 129, 0.2),
    0 2px 4px rgba(16, 185, 129, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
}

.assign-action-btn.has-assignment:hover .status-dot {
  transform: scale(1.2);
}

/* ============================================
   OPENED STATE (Dropdown Active)
   ============================================ */
.assign-action-btn.opened {
  border-color: #10b981;
  box-shadow:
    0 0 0 3px rgba(16, 185, 129, 0.15),
    0 4px 12px rgba(16, 185, 129, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

.assign-action-btn.has-assignment.opened {
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
  border-color: #059669;
  box-shadow:
    0 0 0 4px rgba(16, 185, 129, 0.2),
    0 6px 16px rgba(16, 185, 129, 0.3),
    inset 0 2px 4px rgba(255, 255, 255, 0.7);
}

.assign-action-btn.opened .status-dot.active {
  box-shadow:
    0 0 0 4px rgba(16, 185, 129, 0.25),
    0 0 16px rgba(16, 185, 129, 0.5);
  animation: pulse-dot-active 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse-dot-active {
  0%, 100% {
    opacity: 1;
    transform: scale(1.1);
  }
  50% {
    opacity: 0.9;
    transform: scale(1.25);
  }
}

/* ============================================
   ACTIVE/PRESSED STATE
   ============================================ */
.assign-action-btn:active {
  transform: translateY(0) scale(0.98);
  transition: all 0.1s ease;
}

/* ============================================
   RESPONSIVE DESIGN
   ============================================ */
@media (max-width: 768px) {
  .assign-action-btn {
    padding: 0.5rem 0.875rem;
    gap: 0.5rem;
  }

  .button-text {
    max-width: 100px;
    font-size: 0.8125rem;
  }

  .action-icon {
    width: 1rem;
    height: 1rem;
  }

  .dropdown-icon {
    width: 0.75rem;
    height: 0.75rem;
  }
}

.assign-panel-dropdown {
  /* 位置由 JS 動態計算（使用 Teleport 到 body） */
  min-width: 20rem;
  max-width: 28rem;
  background: white;
  border: 1px solid var(--gray-200, #e5e7eb);
  border-radius: 0.75rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  animation: dropdown-appear 0.2s ease-out;
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

/* 響應式設計 */
@media (max-width: 768px) {
  .assign-panel-dropdown {
    left: 50%;
    transform: translateX(-50%);
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