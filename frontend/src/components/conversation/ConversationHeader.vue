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
          :class="{ 'has-assignment': conversation.assignedTo }"
          @click="toggleAssignPanel"
        >
          <UserPlusIcon class="action-icon" />
          <span v-if="conversation.assignedTo">已指派</span>
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
        :disabled="closing"
        @click="$emit('close')"
      >
        <XCircleIcon />
        <span>{{ closing ? '結束中...' : '結束對話' }}</span>
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
import { ArrowLeftIcon, XCircleIcon, RefreshIcon, UserPlusIcon, ChevronDownIcon } from '@/components/icons'
import PlatformBadge from '../ui/PlatformBadge.vue'
import StatusBadge from '../ui/StatusBadge.vue'
import TagSelector from '@/components/customer/TagSelector.vue'
import AdvancedAssignActions from './AdvancedAssignActions.vue'
import type { Conversation } from '@/types'
import { getCustomerTags, addTagsToCustomer, type Tag } from '@/api/tags'
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
const { showError } = useToast()

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
  customerTags.value = tags

  // 可選：自動同步到後端
  if (customerIdNumber.value) {
    try {
      const tagIds = tags.map(t => t.id)
      await addTagsToCustomer(customerIdNumber.value, tagIds)
    } catch (error) {
      console.error('Failed to update customer tags:', error)
    }
  }
}

// 指派管理功能
const toggleAssignPanel = () => {
  showAssignPanel.value = !showAssignPanel.value
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

.close-conversation-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--danger-color);
  color: white;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.close-conversation-btn:hover:not(:disabled) {
  background: var(--danger-color-hover);
}

.close-conversation-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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