<template>
  <div class="tag-selector-wrapper">
    <!-- 觸發按鈕 -->
    <button
      v-if="!alwaysOpen"
      class="tag-trigger-btn"
      :class="{ 'has-tags': selectedTags.length > 0 }"
      @click="isOpen = !isOpen"
    >
      <svg
        class="icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
        />
      </svg>
      <span>{{ selectedTags.length > 0 ? `已選 ${selectedTags.length} 個標籤` : '新增標籤' }}</span>
    </button>

    <!-- Glassmorphism 彈出面板 -->
    <Transition name="fade-slide">
      <div
        v-if="isOpen || alwaysOpen"
        class="tag-selector-panel glass"
      >
        <div class="panel-header">
          <h3 class="panel-title">
            <svg
              class="icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            選擇標籤
          </h3>
          <button
            v-if="!alwaysOpen"
            class="close-btn"
            @click="isOpen = false"
          >
            <svg
              class="icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <!-- 搜尋框 -->
        <div class="search-box glass-light">
          <svg
            class="search-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <circle
              cx="11"
              cy="11"
              r="8"
            />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜尋標籤..."
            class="search-input"
          >
        </div>

        <!-- 快速創建新標籤 -->
        <div
          v-if="allowCreate && searchQuery && !filteredTags.some(t => t.name.toLowerCase() === searchQuery.toLowerCase())"
          class="quick-create glass-light"
        >
          <button
            class="create-tag-btn"
            @click="quickCreateTag"
          >
            <svg
              class="icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            創建新標籤 "{{ searchQuery }}"
          </button>
        </div>

        <!-- 標籤列表 -->
        <div
          v-if="!loading"
          class="tags-list"
        >
          <div
            v-for="tag in filteredTags"
            :key="tag.id"
            class="tag-item glass-light"
            :class="{ selected: isSelected(tag.id) }"
            @click="toggleTag(tag)"
          >
            <div
              class="tag-color"
              :style="{ backgroundColor: tag.color }"
            />
            <div class="tag-info">
              <span class="tag-name">{{ tag.name }}</span>
              <span
                v-if="tag.description"
                class="tag-description"
              >{{ tag.description }}</span>
            </div>
            <div
              v-if="tag.customerCount !== undefined"
              class="tag-count"
            >
              {{ tag.customerCount }}
            </div>
            <svg
              v-if="isSelected(tag.id)"
              class="check-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <div
            v-if="filteredTags.length === 0"
            class="empty-state"
          >
            <svg
              class="empty-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            <p>找不到符合的標籤</p>
          </div>
        </div>

        <!-- 載入狀態 -->
        <div
          v-else
          class="loading-state"
        >
          <div class="spinner" />
          <p>載入中...</p>
        </div>

        <!-- 操作按鈕 -->
        <div class="panel-footer">
          <button
            class="btn-cancel glass-light"
            @click="handleCancel"
          >
            取消
          </button>
          <button
            class="btn-confirm glass-primary"
            @click="handleConfirm"
          >
            <svg
              class="icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            確認 ({{ selectedTags.length }})
          </button>
        </div>
      </div>
    </Transition>

    <!-- 遮罩層 -->
    <Transition name="fade">
      <div
        v-if="isOpen && !alwaysOpen"
        class="overlay"
        @click="isOpen = false"
      />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { getTags, createTag, type Tag } from '@/api/tags'

interface Props {
  modelValue: number[]
  customerId?: number
  alwaysOpen?: boolean
  allowCreate?: boolean
}

interface Emits {
  (_e: 'update:modelValue', _value: number[]): void
  (_e: 'change', _value: Tag[]): void
}

const props = withDefaults(defineProps<Props>(), {
  customerId: undefined,
  alwaysOpen: false,
  allowCreate: true
})

const emit = defineEmits<Emits>()

const isOpen = ref(false)
const loading = ref(false)
const searchQuery = ref('')
const availableTags = ref<Tag[]>([])
const selectedTags = ref<number[]>([...props.modelValue])

// 過濾標籤
const filteredTags = computed(() => {
  if (!searchQuery.value) {return availableTags.value}
  const query = searchQuery.value.toLowerCase()
  return availableTags.value.filter(
    tag => tag.name.toLowerCase().includes(query) || tag.description?.toLowerCase().includes(query)
  )
})

// 檢查是否已選
const isSelected = (tagId: number) => selectedTags.value.includes(tagId)

// 切換標籤選擇
const toggleTag = (tag: Tag) => {
  const index = selectedTags.value.indexOf(tag.id)
  if (index > -1) {
    selectedTags.value.splice(index, 1)
  } else {
    selectedTags.value.push(tag.id)
  }
}

// 快速創建標籤
const quickCreateTag = async () => {
  try {
    loading.value = true
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']
    const randomColor = colors[Math.floor(Math.random() * colors.length)]

    const response = await createTag({
      name: searchQuery.value.trim(),
      color: randomColor
    })

    if (response.success && response.data) {
      availableTags.value.unshift(response.data)
      selectedTags.value.push(response.data.id)
      searchQuery.value = ''
    }
  } catch (error) {
    console.error('Failed to create tag:', error)
  } finally {
    loading.value = false
  }
}

// 確認選擇
const handleConfirm = () => {
  emit('update:modelValue', selectedTags.value)
  const selected = availableTags.value.filter(t => selectedTags.value.includes(t.id))
  emit('change', selected)
  if (!props.alwaysOpen) {
    isOpen.value = false
  }
}

// 取消
const handleCancel = () => {
  selectedTags.value = [...props.modelValue]
  if (!props.alwaysOpen) {
    isOpen.value = false
  }
}

// 載入標籤
const loadTags = async () => {
  try {
    loading.value = true
    const response = await getTags({ pageSize: 100 })
    if (response.success) {
      availableTags.value = response.data
    }
  } catch (error) {
    console.error('Failed to load tags:', error)
  } finally {
    loading.value = false
  }
}

// 監聽外部值變化
watch(() => props.modelValue, (newVal) => {
  selectedTags.value = [...newVal]
})

onMounted(() => {
  loadTags()
})
</script>

<style scoped>
.tag-selector-wrapper {
  position: relative;
}

/* 觸發按鈕 */
.tag-trigger-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.tag-trigger-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.tag-trigger-btn.has-tags {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.3);
  color: #60A5FA;
}

/* Glassmorphism 面板 */
.glass {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.glass-light {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.glass-primary {
  background: rgba(59, 130, 246, 0.2);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(59, 130, 246, 0.4);
  color: #60A5FA;
}

.tag-selector-panel {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  width: 380px;
  max-height: 500px;
  border-radius: 1rem;
  padding: 1.25rem;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* 標題區 */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  color: rgba(255, 255, 255, 0.95);
  font-size: 1rem;
  font-weight: 600;
}

.close-btn {
  padding: 0.375rem;
  border: none;
  border-radius: 0.5rem;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

/* 搜尋框 */
.search-box {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
}

.search-icon {
  width: 1.125rem;
  height: 1.125rem;
  stroke-width: 2;
  color: rgba(255, 255, 255, 0.5);
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.875rem;
  outline: none;
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

/* 快速創建 */
.quick-create {
  padding: 0.75rem;
  border-radius: 0.75rem;
}

.create-tag-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.625rem 1rem;
  border: 1px dashed rgba(59, 130, 246, 0.4);
  border-radius: 0.5rem;
  background: rgba(59, 130, 246, 0.05);
  color: #60A5FA;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.create-tag-btn:hover {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.6);
}

/* 標籤列表 */
.tags-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 300px;
}

.tags-list::-webkit-scrollbar {
  width: 6px;
}

.tags-list::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.tags-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.tags-list::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.tag-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 0.625rem;
  cursor: pointer;
  transition: all 0.2s;
}

.tag-item:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateX(2px);
}

.tag-item.selected {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.3);
}

.tag-color {
  width: 1rem;
  height: 1rem;
  border-radius: 0.25rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  flex-shrink: 0;
}

.tag-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.tag-name {
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.875rem;
  font-weight: 500;
}

.tag-description {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-count {
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.75rem;
  font-weight: 600;
}

.check-icon {
  width: 1.125rem;
  height: 1.125rem;
  color: #60A5FA;
  stroke-width: 2.5;
}

/* 空狀態 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem 1rem;
  color: rgba(255, 255, 255, 0.5);
}

.empty-icon {
  width: 3rem;
  height: 3rem;
  stroke-width: 1.5;
}

/* 載入狀態 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem 1rem;
  color: rgba(255, 255, 255, 0.6);
}

.spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #60A5FA;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 底部按鈕 */
.panel-footer {
  display: flex;
  gap: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-cancel,
.btn-confirm {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  color: rgba(255, 255, 255, 0.7);
}

.btn-cancel:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.btn-confirm:hover {
  background: rgba(59, 130, 246, 0.3);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

/* 遮罩層 */
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
  z-index: 999;
}

/* 圖標通用樣式 */
.icon {
  width: 1rem;
  height: 1rem;
  stroke-width: 2;
  flex-shrink: 0;
}

/* 動畫 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
