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
import { computed, ref, watch, onMounted } from 'vue'
import { ArrowLeftIcon, XCircleIcon, RefreshIcon } from '@/components/icons'
import PlatformBadge from '../ui/PlatformBadge.vue'
import StatusBadge from '../ui/StatusBadge.vue'
import TagSelector from '@/components/customer/TagSelector.vue'
import type { Conversation } from '@/types'
import { getCustomerTags, addTagsToCustomer, type Tag } from '@/api/tags'

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
</style>