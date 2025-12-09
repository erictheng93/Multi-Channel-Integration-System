<template>
  <AppLayout>
    <div class="customer-tags">
      <!-- Welcome Section -->
      <div class="welcome-section">
        <div class="welcome-content">
          <div class="welcome-greeting">
            <h1 class="welcome-title">
              標籤管理
            </h1>
            <p class="welcome-subtitle">
              管理客戶與對話標籤，優化分類與篩選
            </p>
          </div>
          <div class="welcome-actions">
            <button
              class="btn btn-primary"
              @click="showCreateModal = true"
            >
              <svg
                class="icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              新增標籤
            </button>
            <button
              class="btn btn-secondary"
              @click="loadTags"
            >
              <svg
                class="icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="stats-overview">
        <div class="stats-grid">
          <div class="stat-card tags">
            <div class="stat-content">
              <div class="stat-number">
                {{ totalTags }}
              </div>
              <div class="stat-label">
                總標籤數
              </div>
            </div>
            <div class="stat-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
            </div>
          </div>

          <div class="stat-card customers">
            <div class="stat-content">
              <div class="stat-number">
                {{ totalCustomers }}
              </div>
              <div class="stat-label">
                已標記客戶
              </div>
            </div>
            <div class="stat-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="toolbar-section">
        <div class="search-box">
          <svg
            class="search-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle
              cx="11"
              cy="11"
              r="8"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="m21 21-4.35-4.35"
            />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜尋標籤名稱或描述..."
            class="search-input"
          >
        </div>

        <div class="toolbar-actions">
          <button
            v-if="selectedTags.length > 0"
            class="btn btn-secondary"
            @click="showBulkMenu = !showBulkMenu"
          >
            <svg
              class="icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
              />
            </svg>
            批量操作 ({{ selectedTags.length }})
          </button>
        </div>
      </div>

      <!-- Tags Grid -->
      <div class="content-section">
        <HamsterLoader
          v-if="loading"
          message="載入標籤中..."
        />

        <EmptyState
          v-else-if="filteredTags.length === 0"
          title="尚無標籤"
          description="建立第一個標籤來開始管理客戶分類"
        >
          <template #actions>
            <button
              class="btn btn-primary"
              @click="showCreateModal = true"
            >
              <svg
                class="icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              立即創建
            </button>
          </template>
        </EmptyState>

        <div
          v-else
          class="tags-list"
        >
          <TagCard
            v-for="tag in filteredTags"
            :key="tag.id"
            :tag="tag"
            :selected="selectedTags.includes(tag.id)"
            :loading="loading"
            @toggle-selection="toggleTagSelection(tag.id)"
            @view-stats="viewTagStats(tag)"
            @edit="editTag(tag)"
            @delete="confirmDelete(tag)"
          />
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <Transition name="modal">
      <div
        v-if="showCreateModal || showEditModal"
        class="modal-overlay"
        @click="closeModals"
      >
        <div
          class="modal-content"
          @click.stop
        >
          <div class="modal-header">
            <h2 class="modal-title">
              {{ showEditModal ? '編輯標籤' : '新增標籤' }}
            </h2>
            <button
              class="modal-close"
              @click="closeModals"
            >
              <svg
                class="icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">標籤名稱 *</label>
              <input
                v-model="formData.name"
                type="text"
                class="form-input"
                placeholder="例如: VIP客戶"
                maxlength="50"
              >
            </div>

            <div class="form-group">
              <label class="form-label">顏色</label>

              <!-- 預設顏色選擇 -->
              <div class="color-section">
                <div class="color-section-label">
                  預設顏色
                </div>
                <div class="color-picker-grid">
                  <div
                    v-for="color in predefinedColors"
                    :key="color"
                    class="color-option"
                    :class="{ selected: formData.color === color }"
                    :style="{ backgroundColor: color }"
                    @click="formData.color = color"
                  >
                    <svg
                      v-if="formData.color === color"
                      class="check-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="3"
                    >
                      <polyline
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        points="20 6 9 17 4 12"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <!-- 自定義顏色選擇 -->
              <div class="color-section custom-color-section">
                <div class="color-section-label">
                  自定義顏色
                </div>
                <div class="custom-color-picker">
                  <input
                    v-model="formData.color"
                    type="color"
                    class="color-input"
                  >
                  <span class="custom-color-hint">點擊選擇任意顏色</span>
                  <div
                    class="current-color-preview"
                    :style="{ backgroundColor: formData.color }"
                    :title="`當前顏色: ${formData.color}`"
                  />
                </div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">描述</label>
              <textarea
                v-model="formData.description"
                class="form-textarea"
                placeholder="選填：描述此標籤的用途..."
                rows="3"
                maxlength="200"
              />
            </div>
          </div>

          <div class="modal-footer">
            <button
              class="btn btn-secondary"
              @click="closeModals"
            >
              取消
            </button>
            <button
              class="btn btn-primary"
              :disabled="!formData.name"
              @click="saveTag"
            >
              <svg
                class="icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              {{ showEditModal ? '更新' : '創建' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Delete Confirmation Modal -->
    <Modal
      :show="showDeleteModal"
      title="確認刪除標籤"
      size="sm"
      @close="cancelDelete"
    >
      <div class="delete-modal-content">
        <div class="delete-warning-icon">
          <svg
            class="icon-large"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <p class="delete-message">
          確定要刪除標籤
          <span class="tag-name-highlight">「{{ deletingTag?.name }}」</span>
          嗎？
        </p>
        <p class="delete-description">
          此操作無法撤銷。刪除後，此標籤將從所有客戶和對話中移除。
        </p>
      </div>

      <template #footer>
        <button
          class="modal-cancel-btn"
          @click="cancelDelete"
        >
          取消
        </button>
        <button
          class="modal-delete-btn"
          @click="executeDelete"
        >
          <svg
            class="icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          確認刪除
        </button>
      </template>
    </Modal>

    <!-- Tag Stats Modal -->
    <TagStatsModal
      v-if="statsTag"
      :show="showStatsModal"
      :tag="statsTag"
      @close="showStatsModal = false"
    />
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getTags, createTag, updateTag, deleteTag, type Tag } from '@/api/tags'
import { useToast } from '@/composables/useToast'
import AppLayout from '@/components/ui/AppLayout.vue'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Modal from '@/components/ui/Modal.vue'
import TagCard from '@/components/customer/TagCard.vue'
import TagStatsModal from '@/components/customer/TagStatsModal.vue'

// Toast notifications
const { showSuccess, showError } = useToast()

const loading = ref(true)  // 初始為 true，避免首次渲染時閃爍空狀態
const searchQuery = ref('')
const tags = ref<Tag[]>([])
const selectedTags = ref<number[]>([])
const showBulkMenu = ref(false)
const showCreateModal = ref(false)
const showEditModal = ref(false)
const showDeleteModal = ref(false)
const showStatsModal = ref(false)
const editingTag = ref<Tag | null>(null)
const deletingTag = ref<Tag | null>(null)
const statsTag = ref<Tag | null>(null)

const formData = ref({
  name: '',
  color: '#3B82F6',
  description: ''
})

const predefinedColors = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
]

// Computed Properties
const totalTags = computed(() => tags.value.length)
const totalCustomers = computed(() => tags.value.reduce((sum, t) => sum + (t.customerCount || 0), 0))

const filteredTags = computed(() => {
  let result = tags.value

  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      t => t.name.toLowerCase().includes(query) || t.description?.toLowerCase().includes(query)
    )
  }

  return result
})

// Load tags
const loadTags = async () => {
  try {
    loading.value = true
    const response = await getTags({ pageSize: 100 })
    if (response.success) {
      tags.value = response.data
    }
  } catch (error) {
    console.error('Failed to load tags:', error)
  } finally {
    loading.value = false
  }
}

// ===== 🚀 乐观UI更新辅助函数 =====
// 临时ID生成器（用于创建标签的乐观更新）
let tempIdCounter = -1

const optimisticAddTag = (tag: Tag): number => {
  const tempId = tempIdCounter--
  const newTag = { ...tag, id: tempId }
  tags.value.unshift(newTag)
  return tempId
}

const optimisticUpdateTag = (id: number, updates: Partial<Tag>): Tag | null => {
  const index = tags.value.findIndex(t => t.id === id)
  if (index === -1) {return null}

  const oldTag: Tag = { ...tags.value[index] } as Tag
  tags.value[index] = { ...tags.value[index], ...updates } as Tag
  return oldTag
}

const optimisticDeleteTag = (id: number): Tag | null => {
  const index = tags.value.findIndex(t => t.id === id)
  if (index === -1) {return null}

  const deletedTag: Tag = tags.value[index] as Tag
  tags.value.splice(index, 1)
  return deletedTag
}

const rollbackAddTag = (tempId: number) => {
  const index = tags.value.findIndex(t => t.id === tempId)
  if (index !== -1) {
    tags.value.splice(index, 1)
  }
}

const rollbackUpdateTag = (oldTag: Tag) => {
  const index = tags.value.findIndex(t => t.id === oldTag.id)
  if (index !== -1) {
    tags.value[index] = oldTag
  }
}

const rollbackDeleteTag = (deletedTag: Tag) => {
  tags.value.push(deletedTag)
}

// Toggle tag selection
const toggleTagSelection = (tagId: number) => {
  const index = selectedTags.value.indexOf(tagId)
  if (index > -1) {
    selectedTags.value.splice(index, 1)
  } else {
    selectedTags.value.push(tagId)
  }
}

// Edit tag
const editTag = (tag: Tag) => {
  editingTag.value = tag
  formData.value = {
    name: tag.name,
    color: tag.color,
    description: tag.description || ''
  }
  showEditModal.value = true
}

// Save tag - 🚀 乐观UI更新版本
const saveTag = async () => {
  const isEdit = showEditModal.value && editingTag.value
  const tagName = formData.value.name

  try {
    if (isEdit && editingTag.value) {
      // ===== 编辑标签 - 乐观更新 =====
      // 🔧 FIX: 在 closeModals() 之前保存數據副本，避免競態條件
      const tagId = editingTag.value.id
      const updateData = {
        name: formData.value.name,
        color: formData.value.color,
        description: formData.value.description || undefined
      }

      const oldTag = optimisticUpdateTag(tagId, {
        name: updateData.name,
        color: updateData.color,
        description: updateData.description || null,
        updatedAt: new Date().toISOString()
      })

      // ✅ 立即显示成功提示
      showSuccess(
        '標籤更新成功',
        `成功更新標籤「${tagName}」`,
        { duration: 3000 }
      )
      closeModals()

      // 🔄 后台验证 - 使用保存的 updateData 而非 formData.value
      try {
        await updateTag(tagId, updateData)
        console.log('✅ [CustomerTags] Tag updated (verified):', tagName)
      } catch (error) {
        // ❌ 失败 - 回滚UI
        if (oldTag) {
          rollbackUpdateTag(oldTag)
        }
        showError(
          '標籤更新失敗',
          '請檢查網路連線或稍後重試'
        )
        console.error('❌ [CustomerTags] Failed to update tag:', error)
      }
    } else {
      // ===== 创建标签 - 乐观更新 =====
      // 🔧 FIX: 在 closeModals() 之前保存 formData 副本，避免競態條件
      const createData = {
        name: formData.value.name,
        color: formData.value.color,
        description: formData.value.description || undefined
      }

      const newTag: Tag = {
        id: 0, // 临时ID，稍后替换
        name: createData.name,
        color: createData.color,
        description: createData.description || null,
        teamId: null, // 簡化模型：所有標籤為全局
        isActive: true,
        createdBy: 'current-user', // TODO: 从认证状态获取
        customerCount: 0,
        conversationCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const tempId = optimisticAddTag(newTag)

      // ✅ 立即显示成功提示
      showSuccess(
        '標籤創建成功',
        `成功創建標籤「${tagName}」`,
        { duration: 3000 }
      )
      closeModals()

      // 🔄 后台验证 - 使用保存的 createData 而非 formData.value
      try {
        const response = await createTag(createData)
        if (response.success && response.data) {
          // 更新临时ID为真实ID
          const index = tags.value.findIndex(t => t.id === tempId)
          if (index !== -1) {
            tags.value[index] = response.data
          }
          console.log('✅ [CustomerTags] Tag created (verified):', tagName)
        }
      } catch (error) {
        // ❌ 失败 - 回滚UI
        rollbackAddTag(tempId)
        showError(
          '標籤創建失敗',
          '請檢查網路連線或稍後重試'
        )
        console.error('❌ [CustomerTags] Failed to create tag:', error)
      }
    }
  } catch (error) {
    console.error('❌ [CustomerTags] Unexpected error in saveTag:', error)
    showError(
      isEdit ? '標籤更新失敗' : '標籤創建失敗',
      '發生未預期的錯誤'
    )
  }
}

// Confirm delete - Show modal
const confirmDelete = (tag: Tag) => {
  deletingTag.value = tag
  showDeleteModal.value = true
}

// Execute delete - 🚀 乐观UI更新版本
const executeDelete = async () => {
  if (!deletingTag.value) {return}

  const tagToDelete = deletingTag.value
  const tagName = tagToDelete.name

  // ===== 乐观删除 - 立即更新UI =====
  const deletedTag = optimisticDeleteTag(tagToDelete.id)

  // ✅ 立即显示成功提示
  showSuccess(
    '標籤刪除成功',
    `成功刪除標籤「${tagName}」`,
    { duration: 3000 }
  )

  // 关闭模态框和清理状态
  showDeleteModal.value = false
  deletingTag.value = null

  // 🔄 后台验证
  try {
    await deleteTag(tagToDelete.id)
    console.log('✅ [CustomerTags] Tag deleted (verified):', tagName)
  } catch (error) {
    // ❌ 失败 - 回滚UI
    if (deletedTag) {
      rollbackDeleteTag(deletedTag)
    }
    showError(
      '標籤刪除失敗',
      '請檢查網路連線或稍後重試'
    )
    console.error('❌ [CustomerTags] Failed to delete tag:', error)
  }
}

// Cancel delete
const cancelDelete = () => {
  showDeleteModal.value = false
  deletingTag.value = null
}

// View tag stats
const viewTagStats = (tag: Tag) => {
  statsTag.value = tag
  showStatsModal.value = true
}

// Close modals
const closeModals = () => {
  showCreateModal.value = false
  showEditModal.value = false
  editingTag.value = null
  formData.value = {
    name: '',
    color: '#3B82F6',
    description: ''
  }
}

onMounted(() => {
  loadTags()
})
</script>

<style scoped>
.customer-tags {
  max-width: clamp(1200px, 85vw, 1650px);
  margin: 0 auto;
  padding: clamp(1rem, 2vw, 2rem) clamp(0.5rem, 2vw, 1.5rem);
  min-height: 100%;
}

/* Welcome Section */
.welcome-section {
  margin-bottom: var(--space-12);
  padding: var(--space-8) 0;
}

.welcome-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 100%;
}

.welcome-greeting {
  flex: 1;
}

.welcome-title {
  font-size: clamp(1.75rem, 1.5rem + 2vw, 2.8rem);
  font-weight: 800;
  color: var(--gray-900);
  margin-bottom: var(--space-2);
  letter-spacing: -0.025em;
}

.welcome-subtitle {
  font-size: 1rem;
  color: var(--gray-600);
  font-weight: 400;
}

.welcome-actions {
  display: flex;
  gap: var(--space-4);
  align-items: center;
}

/* Stats Overview */
.stats-overview {
  margin-bottom: var(--space-12);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(clamp(240px, 20vw, 300px), 1fr));
  gap: clamp(1rem, 2vw, 2rem);
}

.stat-card {
  background: white;
  border-radius: var(--radius-2xl);
  padding: var(--space-8);
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
  border: 1px solid var(--gray-100);
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all var(--transition-fast);
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: var(--gray-200);
  transition: background-color var(--transition-fast);
}

.stat-card.tags::before {
  background: linear-gradient(180deg, #3b82f6, #2563eb);
}

.stat-card.customers::before {
  background: linear-gradient(180deg, #10b981, #059669);
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
}

.stat-content {
  flex: 1;
}

.stat-number {
  font-size: 2.5rem;
  font-weight: 800;
  color: var(--gray-900);
  margin-bottom: var(--space-1);
  line-height: 1;
}

.stat-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--gray-600);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-xl);
  background: var(--gray-50);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--gray-600);
  flex-shrink: 0;
}

/* Toolbar Section */
.toolbar-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-8);
  padding: var(--space-4);
  background: white;
  border-radius: var(--radius-2xl);
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
  border: 1px solid var(--gray-100);
}

.search-box {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex: 1;
  max-width: 400px;
  padding: var(--space-3) var(--space-4);
  background: var(--gray-50);
  border-radius: var(--radius-lg);
  border: 1px solid var(--gray-200);
  transition: all var(--transition-fast);
}

.search-box:focus-within {
  background: white;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.search-icon {
  width: 20px;
  height: 20px;
  color: var(--gray-400);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--gray-900);
  font-size: 0.9375rem;
  outline: none;
}

.search-input::placeholder {
  color: var(--gray-400);
}

.toolbar-actions {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}

.filter-select {
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  background: var(--gray-50);
  color: var(--gray-700);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.filter-select:hover {
  background: white;
  border-color: var(--gray-300);
}

.filter-select:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Content Section */
.content-section {
  margin-top: var(--space-8);
}

/* Tags List - Desktop Optimized */
.tags-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* Buttons */
.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6);
  border: none;
  border-radius: var(--radius-lg);
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-primary {
  background: var(--primary-600);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-700);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--gray-100);
  color: var(--gray-700);
  border: 1px solid var(--gray-200);
}

.btn-secondary:hover {
  background: var(--gray-200);
  color: var(--gray-900);
}

.icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 2000;
  padding: var(--space-4);
}

.modal-content {
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  background: white;
  border-radius: var(--radius-2xl);
  box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 10px 10px -5px rgb(0 0 0 / 0.04);
  padding: var(--space-8);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-6);
}

.modal-title {
  margin: 0;
  color: var(--gray-900);
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.025em;
}

.modal-close {
  padding: var(--space-2);
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--gray-400);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.modal-close:hover {
  background: var(--gray-100);
  color: var(--gray-700);
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  margin-bottom: var(--space-6);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-label {
  color: var(--gray-700);
  font-size: 0.875rem;
  font-weight: 600;
}

.form-input,
.form-textarea {
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  background: var(--gray-50);
  color: var(--gray-900);
  font-size: 0.9375rem;
  outline: none;
  transition: all var(--transition-fast);
}

.form-input:focus,
.form-textarea:focus {
  background: white;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-input::placeholder,
.form-textarea::placeholder {
  color: var(--gray-400);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

/* 顏色選擇區域容器 */
.color-section {
  margin-bottom: var(--space-4);
}

.color-section-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--gray-600);
  margin-bottom: var(--space-2);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* 預設顏色網格 - 2行4列 */
.color-picker-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-3);
  max-width: 240px; /* 4個顏色 * 48px + 間距 */
}

.color-option {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-xl);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  border: 3px solid transparent;
  position: relative;
}

.color-option:hover {
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.color-option.selected {
  border-color: var(--gray-900);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transform: scale(1.05);
}

.check-icon {
  width: 20px;
  height: 20px;
  color: white;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

/* 自定義顏色選擇器 */
.custom-color-section {
  padding-top: var(--space-3);
  border-top: 1px solid var(--gray-200);
}

.custom-color-picker {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--gray-50);
  border-radius: var(--radius-lg);
  border: 2px dashed var(--gray-300);
  transition: all var(--transition-fast);
}

.custom-color-picker:hover {
  border-color: var(--primary-500);
  background: var(--primary-50);
}

.color-input {
  width: 56px;
  height: 56px;
  border: 3px solid var(--gray-300);
  border-radius: var(--radius-xl);
  cursor: pointer;
  transition: all var(--transition-fast);
  background: white;
}

.color-input:hover {
  border-color: var(--primary-500);
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
}

.custom-color-hint {
  font-size: 0.875rem;
  color: var(--gray-600);
  flex: 1;
}

.current-color-preview {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-lg);
  border: 2px solid var(--gray-300);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all var(--transition-fast);
}

.current-color-preview:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.scope-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.scope-option {
  padding: var(--space-4);
  border: 2px solid var(--gray-200);
  border-radius: var(--radius-xl);
  background: var(--gray-50);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.scope-option:hover {
  background: white;
  border-color: var(--gray-300);
}

.scope-option.selected {
  background: var(--primary-50);
  border-color: var(--primary-500);
}

.scope-radio {
  display: none;
}

.scope-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  color: var(--gray-700);
  font-weight: 500;
}

.scope-icon {
  width: 24px;
  height: 24px;
}

.modal-footer {
  display: flex;
  gap: var(--space-3);
  padding-top: var(--space-6);
  border-top: 1px solid var(--gray-100);
}

/* Modal Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.95);
}

/* Responsive Design */
@media (max-width: 1024px) {
  .customer-tags {
    padding: var(--space-4) var(--space-3);
  }

  .welcome-content {
    flex-direction: column;
    text-align: center;
    gap: var(--space-6);
  }

  .toolbar-section {
    flex-direction: column;
    align-items: stretch;
  }

  .search-box {
    max-width: none;
  }

}

@media (max-width: 768px) {
  .customer-tags {
    padding: var(--space-3) var(--space-2);
  }

  .welcome-title {
    font-size: 1.75rem;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .welcome-actions {
    flex-direction: column;
    width: 100%;
    gap: var(--space-3);
  }
}

/* Delete Modal Styles */
.delete-modal-content {
  text-align: center;
  padding: var(--space-4) 0;
}

.delete-warning-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto var(--space-4);
  border-radius: 50%;
  background: var(--danger-50);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--danger-600);
}

.icon-large {
  width: 32px;
  height: 32px;
}

.delete-message {
  font-size: 1rem;
  color: var(--gray-900);
  margin: 0 0 var(--space-3) 0;
  line-height: 1.5;
}

.tag-name-highlight {
  font-weight: 700;
  color: var(--danger-600);
}

.delete-description {
  font-size: 0.875rem;
  color: var(--gray-600);
  margin: 0;
  line-height: 1.5;
}

/* Modal Footer Buttons - Clean & Modern Design */
.modal-cancel-btn,
.modal-delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-lg);
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  outline: none;
  border: none;
}

/* Cancel Button - Gray */
.modal-cancel-btn {
  background: #F3F4F6;
  color: #374151;
  border: 1px solid #E5E7EB;
}

.modal-cancel-btn:hover {
  background: #E5E7EB;
  color: #111827;
  font-weight: 700;
  border-color: #D1D5DB;
}

.modal-cancel-btn:active {
  background: #D1D5DB;
  transform: scale(0.98);
}

/* Delete Button - Red (Clean & Minimal) */
.modal-delete-btn {
  background: #EF4444;
  color: #FFFFFF;
  border: 1px solid #EF4444;
}

.modal-delete-btn:hover {
  background: #DC2626;
  color: #FFFFFF;
  font-weight: 700;
  border-color: #DC2626;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.25);
  transform: translateY(-1px);
}

.modal-delete-btn:active {
  background: #B91C1C;
  border-color: #B91C1C;
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(239, 68, 68, 0.2);
}

.modal-delete-btn .icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  .stat-card,
  .tag-card,
  .action-btn,
  .btn,
  .modal-overlay,
  .modal-content {
    transition: none !important;
  }

  .stat-card:hover,
  .tag-card:hover {
    transform: none !important;
  }
}
</style>
