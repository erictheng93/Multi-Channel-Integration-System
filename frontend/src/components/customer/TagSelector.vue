<template>
  <div class="tag-selector-wrapper">
    <!-- 觸發按鈕 -->
    <button
      v-if="!alwaysOpen"
      ref="triggerBtnRef"
      class="tag-trigger-btn"
      :class="{ 'has-tags': selectedTags.length > 0 }"
      @click="togglePanel"
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
      <span>{{ selectedTags.length > 0 ? `${buttonLabel || ''}已選 ${selectedTags.length}` : (buttonLabel || '新增標籤') }}</span>
    </button>

    <!-- Glassmorphism 彈出面板 - 使用 Teleport 傳送到 body -->
    <Teleport to="body">
      <Transition name="fade-slide">
        <div
          v-if="isOpen || alwaysOpen"
          ref="panelRef"
          class="tag-selector-panel glass"
          :style="panelStyle"
          @click.stop
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
            v-if="availableTags.length > 0"
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
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { createTag, type Tag } from '@/api/tags'
import { tagCacheService } from '@/services/tagCacheService'
import { debounce } from 'lodash-es'

interface Props {
  modelValue: number[]
  customerId?: number
  conversationId?: string  // 新增：對話 ID（用於對話標籤）
  alwaysOpen?: boolean
  allowCreate?: boolean
  buttonLabel?: string  // 新增：按鈕文字
}

interface Emits {
  (_e: 'update:modelValue', _value: number[]): void
  (_e: 'change', _value: Tag[]): void
}

const props = withDefaults(defineProps<Props>(), {
  customerId: undefined,
  conversationId: undefined,
  alwaysOpen: false,
  allowCreate: true,
  buttonLabel: ''
})

const emit = defineEmits<Emits>()

const isOpen = ref(false)
const searchQuery = ref('')
const selectedTags = ref<number[]>([...props.modelValue])
const triggerBtnRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

// 优化：使用缓存服务获取标签数据
const availableTags = computed(() => tagCacheService.getAllTags())

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

// 切換面板開關並計算位置
const togglePanel = () => {
  isOpen.value = !isOpen.value

  if (isOpen.value) {
    nextTick(() => {
      calculatePanelPosition()
    })
  }
}

// 計算面板位置（參考指派管理的做法）
const calculatePanelPosition = () => {
  if (!triggerBtnRef.value) {return}

  const rect = triggerBtnRef.value.getBoundingClientRect()
  const panelWidth = 380 // 面板寬度
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  // 計算垂直位置（按鈕下方）
  let top = rect.bottom + 8

  // 計算水平位置（優先右對齊，如果空間不夠則左對齊）
  let left = rect.right - panelWidth

  // 如果左側超出視窗，改為右對齊
  if (left < 16) {
    left = rect.left
  }

  // 如果右側超出視窗，調整位置
  if (left + panelWidth > viewportWidth - 16) {
    left = viewportWidth - panelWidth - 16
  }

  // 如果下方空間不足，顯示在按鈕上方
  const panelMaxHeight = 500
  if (top + panelMaxHeight > viewportHeight - 16) {
    top = rect.top - panelMaxHeight - 8
  }

  panelStyle.value = {
    position: 'fixed',
    top: `${Math.max(16, top)}px`,
    left: `${Math.max(16, left)}px`,
    zIndex: '10000'
  }
}

// 點擊外部關閉面板（參考指派管理的做法）
const handleClickOutside = (event: MouseEvent) => {
  if (!isOpen.value || props.alwaysOpen) {return}

  const target = event.target as HTMLElement
  const panel = panelRef.value
  const trigger = triggerBtnRef.value

  // 如果點擊的是觸發按鈕或面板內部，不關閉
  if (
    (trigger && trigger.contains(target)) ||
    (panel && panel.contains(target))
  ) {
    return
  }

  // 點擊外部，關閉面板
  isOpen.value = false
}

// 切換標籤選擇
const toggleTag = (tag: Tag) => {
  const index = selectedTags.value.indexOf(tag.id)
  if (index > -1) {
    selectedTags.value.splice(index, 1)
  } else {
    selectedTags.value.push(tag.id)
  }
}

// 优化：快速创建标籤并更新缓存
const quickCreateTag = async () => {
  try {
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']
    const randomColor = colors[Math.floor(Math.random() * colors.length)]

    const response = await createTag({
      name: searchQuery.value.trim(),
      color: randomColor
    })

    if (response.success && response.data) {
      // 乐观更新：立即添加到缓存
      tagCacheService.optimisticAddTag(response.data)

      selectedTags.value.push(response.data.id)
      searchQuery.value = ''

      console.log('[TagSelector] Tag created and cached:', response.data.name)
    }
  } catch (error) {
    console.error('[TagSelector] Failed to create tag:', error)
  }
}

// 优化：防抖的确认操作（500ms延迟）
const debouncedConfirm = debounce(() => {
  emit('update:modelValue', selectedTags.value)
  const selected = availableTags.value.filter(t => selectedTags.value.includes(t.id))
  emit('change', selected)
  console.log('[TagSelector] Tags updated (debounced):', selected.map(t => t.name))
}, 500)

const handleConfirm = () => {
  if (!props.alwaysOpen) {
    isOpen.value = false
  }
  // 使用防抖版本，避免快速点击时多次触发
  debouncedConfirm()
}

// 取消
const handleCancel = () => {
  selectedTags.value = [...props.modelValue]
  if (!props.alwaysOpen) {
    isOpen.value = false
  }
}

// 監聽外部值變化
watch(() => props.modelValue, (newVal) => {
  selectedTags.value = [...newVal]
})

// 优化：组件挂载时确保标签已加载
onMounted(async () => {
  await tagCacheService.ensureTagsLoaded()
  console.log('[TagSelector] Tags loaded from cache')

  // 監聽全局點擊事件（參考指派管理）
  document.addEventListener('click', handleClickOutside)
})

// 組件卸載時移除監聽器
onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.tag-selector-wrapper {
  position: relative;
}

/* 觸發按鈕 - 與指派管理一致 */
.tag-trigger-btn {
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

.tag-trigger-btn:hover {
  background-color: var(--gray-50, #f9fafb);
  border-color: var(--gray-400, #9ca3af);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.tag-trigger-btn.has-tags {
  background-color: var(--blue-50, #eff6ff);
  border-color: var(--blue-300, #93c5fd);
  color: var(--blue-700, #1d4ed8);
}

.tag-trigger-btn.has-tags:hover {
  background-color: var(--blue-100, #dbeafe);
  border-color: var(--blue-400, #60a5fa);
}

/* 白色背景面板 - 與指派管理一致 */
.glass {
  background: white;
  border: 1px solid var(--gray-200, #e5e7eb);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05);
}

.glass-light {
  background: var(--gray-50, #f9fafb);
  border: 1px solid var(--gray-200, #e5e7eb);
}

.glass-primary {
  background: var(--blue-600, #2563eb);
  border: 1px solid var(--blue-600, #2563eb);
  color: white;
}

.tag-selector-panel {
  /* 位置由 JavaScript 動態計算（使用 Teleport 到 body） */
  /* position, top, left, z-index 在 panelStyle 中設置 */
  width: 380px;
  max-height: 500px;
  border-radius: 0.75rem;
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: dropdown-appear 0.2s ease-out;
  pointer-events: auto;
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

/* 標題區 */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  background: var(--gray-50, #f9fafb);
  border-bottom: 1px solid var(--gray-200, #e5e7eb);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  color: var(--gray-900, #111827);
  font-size: 1rem;
  font-weight: 600;
}

.close-btn {
  padding: 0.375rem;
  border: none;
  border-radius: 0.5rem;
  background: transparent;
  color: var(--gray-500, #6b7280);
  cursor: pointer;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--gray-200, #e5e7eb);
  color: var(--gray-700, #374151);
}

/* 搜尋框 */
.search-box {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  margin: 1rem 1.25rem 0.5rem;
}

.search-icon {
  width: 1.125rem;
  height: 1.125rem;
  stroke-width: 2;
  color: var(--gray-400, #9ca3af);
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--gray-900, #111827);
  font-size: 0.875rem;
  outline: none;
}

.search-input::placeholder {
  color: var(--gray-400, #9ca3af);
}

/* 快速創建 */
.quick-create {
  padding: 0 1.25rem 0.5rem;
}

.create-tag-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.625rem 1rem;
  border: 1px dashed var(--blue-300, #93c5fd);
  border-radius: 0.5rem;
  background: var(--blue-50, #eff6ff);
  color: var(--blue-600, #2563eb);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.create-tag-btn:hover {
  background: var(--blue-100, #dbeafe);
  border-color: var(--blue-400, #60a5fa);
}

/* 標籤列表 */
.tags-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0;
  max-height: 300px;
  padding: 0.5rem 0.75rem;
  margin: 0 0.5rem;
}

.tags-list::-webkit-scrollbar {
  width: 6px;
}

.tags-list::-webkit-scrollbar-track {
  background: var(--gray-100, #f3f4f6);
  border-radius: 3px;
}

.tags-list::-webkit-scrollbar-thumb {
  background: var(--gray-300, #d1d5db);
  border-radius: 3px;
}

.tags-list::-webkit-scrollbar-thumb:hover {
  background: var(--gray-400, #9ca3af);
}

.tag-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.tag-item:hover {
  background: var(--gray-50, #f9fafb);
  border-color: var(--gray-200, #e5e7eb);
  transform: translateX(2px);
}

.tag-item.selected {
  background: var(--blue-50, #eff6ff);
  border-color: var(--blue-300, #93c5fd);
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
  color: var(--gray-900, #111827);
  font-size: 0.875rem;
  font-weight: 500;
}

.tag-description {
  color: var(--gray-500, #6b7280);
  font-size: 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-count {
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  background: var(--gray-100, #f3f4f6);
  color: var(--gray-600, #4b5563);
  font-size: 0.75rem;
  font-weight: 600;
}

.check-icon {
  width: 1.125rem;
  height: 1.125rem;
  color: var(--blue-600, #2563eb);
  stroke-width: 2.5;
}

/* 空狀態 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem 1rem;
  color: var(--gray-500, #6b7280);
}

.empty-icon {
  width: 3rem;
  height: 3rem;
  stroke-width: 1.5;
  color: var(--gray-400, #9ca3af);
}

/* 載入狀態 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem 1rem;
  color: var(--gray-600, #4b5563);
}

.spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid var(--gray-200, #e5e7eb);
  border-top-color: var(--blue-600, #2563eb);
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
  padding: 1rem 1.25rem;
  background: var(--gray-50, #f9fafb);
  border-top: 1px solid var(--gray-200, #e5e7eb);
}

.btn-cancel,
.btn-confirm {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border: 1px solid;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: white;
  border-color: var(--gray-300, #d1d5db);
  color: var(--gray-700, #374151);
}

.btn-cancel:hover {
  background: var(--gray-50, #f9fafb);
  border-color: var(--gray-400, #9ca3af);
}

.btn-confirm {
  border-color: var(--blue-600, #2563eb);
}

.btn-confirm:hover {
  background: var(--blue-700, #1d4ed8);
  border-color: var(--blue-700, #1d4ed8);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

/* 圖標通用樣式 */
.icon {
  width: 1rem;
  height: 1rem;
  stroke-width: 2;
  flex-shrink: 0;
}

/* 響應式設計 */
@media (max-width: 768px) {
  .tag-selector-panel {
    right: auto;
    left: 0;
    width: calc(100vw - 2rem);
    max-width: 380px;
  }

  .tag-trigger-btn span {
    display: none;
  }
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
</style>
