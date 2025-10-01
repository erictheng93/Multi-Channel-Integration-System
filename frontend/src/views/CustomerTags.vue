<template>
  <div class="customer-tags-page">
    <!-- 頁面標題 -->
    <div class="page-header glass">
      <div class="header-content">
        <div class="title-section">
          <h1 class="page-title">
            <svg
              class="title-icon"
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
            標籤管理
          </h1>
          <p class="page-subtitle">
            管理客戶與對話標籤，優化分類與篩選
          </p>
        </div>

        <button
          class="create-btn glass-primary"
          @click="showCreateModal = true"
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
          新增標籤
        </button>
      </div>

      <!-- 統計卡片 -->
      <div class="stats-row">
        <div class="stat-card glass-light">
          <div
            class="stat-icon"
            style="background: rgba(59, 130, 246, 0.2);"
          >
            <svg
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
          </div>
          <div class="stat-info">
            <span class="stat-label">總標籤數</span>
            <span class="stat-value">{{ totalTags }}</span>
          </div>
        </div>

        <div class="stat-card glass-light">
          <div
            class="stat-icon"
            style="background: rgba(16, 185, 129, 0.2);"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <div class="stat-info">
            <span class="stat-label">已標記客戶</span>
            <span class="stat-value">{{ totalCustomers }}</span>
          </div>
        </div>

        <div class="stat-card glass-light">
          <div
            class="stat-icon"
            style="background: rgba(245, 158, 11, 0.2);"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </div>
          <div class="stat-info">
            <span class="stat-label">已標記對話</span>
            <span class="stat-value">{{ totalConversations }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 工具欄 -->
    <div class="toolbar glass">
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
          placeholder="搜尋標籤名稱或描述..."
          class="search-input"
        >
      </div>

      <div class="toolbar-actions">
        <select
          v-model="filterTeam"
          class="filter-select glass-light"
        >
          <option value="">
            所有團隊
          </option>
          <option value="global">
            全局標籤
          </option>
          <option value="team">
            團隊標籤
          </option>
        </select>

        <button
          v-if="selectedTags.length > 0"
          class="bulk-btn glass-light"
          @click="showBulkMenu = !showBulkMenu"
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
              d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
            />
          </svg>
          批量操作 ({{ selectedTags.length }})
        </button>
      </div>
    </div>

    <!-- 標籤列表 -->
    <div class="tags-grid">
      <div
        v-for="tag in filteredTags"
        :key="tag.id"
        class="tag-card glass"
        :class="{ selected: selectedTags.includes(tag.id) }"
      >
        <div class="tag-card-header">
          <input
            type="checkbox"
            :checked="selectedTags.includes(tag.id)"
            class="tag-checkbox"
            @change="toggleTagSelection(tag.id)"
          >
          <div
            class="tag-color-large"
            :style="{ backgroundColor: tag.color }"
          />
        </div>

        <div class="tag-card-body">
          <h3 class="tag-card-title">
            {{ tag.name }}
          </h3>
          <p
            v-if="tag.description"
            class="tag-card-description"
          >
            {{ tag.description }}
          </p>

          <div class="tag-meta">
            <span class="meta-item">
              <svg
                class="meta-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              {{ tag.customerCount || 0 }} 客戶
            </span>
            <span class="meta-item">
              <svg
                class="meta-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
              {{ tag.conversationCount || 0 }} 對話
            </span>
          </div>

          <div
            v-if="tag.teamId"
            class="tag-badge glass-light"
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
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            團隊標籤
          </div>
          <div
            v-else
            class="tag-badge glass-primary"
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
                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            全局
          </div>
        </div>

        <div class="tag-card-footer">
          <button
            class="action-btn glass-light"
            @click="viewTagStats(tag)"
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
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            統計
          </button>
          <button
            class="action-btn glass-light"
            @click="editTag(tag)"
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
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            編輯
          </button>
          <button
            class="action-btn glass-light delete-btn"
            @click="confirmDelete(tag)"
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            刪除
          </button>
        </div>
      </div>

      <!-- 空狀態 -->
      <div
        v-if="filteredTags.length === 0 && !loading"
        class="empty-state glass"
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
        <h3>尚無標籤</h3>
        <p>建立第一個標籤來開始管理客戶分類</p>
        <button
          class="create-first-btn glass-primary"
          @click="showCreateModal = true"
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
          立即創建
        </button>
      </div>
    </div>

    <!-- 載入狀態 -->
    <div
      v-if="loading"
      class="loading-overlay glass"
    >
      <div class="spinner-large" />
      <p>載入中...</p>
    </div>

    <!-- 創建/編輯標籤 Modal -->
    <Transition name="modal">
      <div
        v-if="showCreateModal || showEditModal"
        class="modal-overlay"
        @click="closeModals"
      >
        <div
          class="modal-content glass"
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

          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">標籤名稱 *</label>
              <input
                v-model="formData.name"
                type="text"
                class="form-input glass-light"
                placeholder="例如: VIP客戶"
                maxlength="50"
              >
            </div>

            <div class="form-group">
              <label class="form-label">顏色</label>
              <div class="color-picker">
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
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <input
                  v-model="formData.color"
                  type="color"
                  class="color-input"
                >
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">描述</label>
              <textarea
                v-model="formData.description"
                class="form-textarea glass-light"
                placeholder="選填：描述此標籤的用途..."
                rows="3"
                maxlength="200"
              />
            </div>

            <div class="form-group">
              <label class="form-label">範圍</label>
              <div class="scope-options">
                <label
                  class="scope-option glass-light"
                  :class="{ selected: !formData.teamId }"
                >
                  <input
                    v-model="formData.teamId"
                    type="radio"
                    :value="null"
                    class="scope-radio"
                  >
                  <div class="scope-content">
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
                        d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>全局標籤</span>
                  </div>
                </label>
                <label
                  class="scope-option glass-light"
                  :class="{ selected: formData.teamId }"
                >
                  <input
                    v-model="formData.teamId"
                    type="radio"
                    :value="1"
                    class="scope-radio"
                  >
                  <div class="scope-content">
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
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    <span>團隊專用</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button
              class="btn-cancel glass-light"
              @click="closeModals"
            >
              取消
            </button>
            <button
              class="btn-confirm glass-primary"
              :disabled="!formData.name"
              @click="saveTag"
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
                  d="M5 13l4 4L19 7"
                />
              </svg>
              {{ showEditModal ? '更新' : '創建' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getTags, createTag, updateTag, deleteTag, type Tag } from '@/api/tags'

const loading = ref(false)
const searchQuery = ref('')
const filterTeam = ref('')
const tags = ref<Tag[]>([])
const selectedTags = ref<number[]>([])
const showBulkMenu = ref(false)
const showCreateModal = ref(false)
const showEditModal = ref(false)
const editingTag = ref<Tag | null>(null)

const formData = ref({
  name: '',
  color: '#3B82F6',
  description: '',
  teamId: null as number | null
})

const predefinedColors = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
]

// 計算屬性
const totalTags = computed(() => tags.value.length)
const totalCustomers = computed(() => tags.value.reduce((sum, t) => sum + (t.customerCount || 0), 0))
const totalConversations = computed(() => tags.value.reduce((sum, t) => sum + (t.conversationCount || 0), 0))

const filteredTags = computed(() => {
  let result = tags.value

  // 搜尋篩選
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      t => t.name.toLowerCase().includes(query) || t.description?.toLowerCase().includes(query)
    )
  }

  // 團隊篩選
  if (filterTeam.value === 'global') {
    result = result.filter(t => !t.teamId)
  } else if (filterTeam.value === 'team') {
    result = result.filter(t => t.teamId)
  }

  return result
})

// 載入標籤
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

// 切換選擇
const toggleTagSelection = (tagId: number) => {
  const index = selectedTags.value.indexOf(tagId)
  if (index > -1) {
    selectedTags.value.splice(index, 1)
  } else {
    selectedTags.value.push(tagId)
  }
}

// 編輯標籤
const editTag = (tag: Tag) => {
  editingTag.value = tag
  formData.value = {
    name: tag.name,
    color: tag.color,
    description: tag.description || '',
    teamId: tag.teamId || null
  }
  showEditModal.value = true
}

// 儲存標籤
const saveTag = async () => {
  try {
    loading.value = true
    if (showEditModal.value && editingTag.value) {
      await updateTag(editingTag.value.id, formData.value)
    } else {
      await createTag(formData.value)
    }
    await loadTags()
    closeModals()
  } catch (error) {
    console.error('Failed to save tag:', error)
  } finally {
    loading.value = false
  }
}

// 確認刪除
const confirmDelete = async (tag: Tag) => {
  if (window.confirm(`確定要刪除標籤「${tag.name}」嗎？`)) {
    try {
      loading.value = true
      await deleteTag(tag.id)
      await loadTags()
    } catch (error) {
      console.error('Failed to delete tag:', error)
    } finally {
      loading.value = false
    }
  }
}

// 查看統計
const viewTagStats = (tag: Tag) => {
  console.log('View stats for:', tag)
  // TODO: 實現統計頁面
}

// 關閉 Modal
const closeModals = () => {
  showCreateModal.value = false
  showEditModal.value = false
  editingTag.value = null
  formData.value = {
    name: '',
    color: '#3B82F6',
    description: '',
    teamId: null
  }
}

onMounted(() => {
  loadTags()
})
</script>

<style scoped>
.customer-tags-page {
  padding: 2rem;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* Glassmorphism */
.glass {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  border-radius: 1rem;
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
}

/* 頁面標題 */
.page-header {
  padding: 2rem;
  margin-bottom: 1.5rem;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
}

.title-section {
  flex: 1;
}

.page-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0 0 0.5rem 0;
  color: rgba(255, 255, 255, 0.95);
  font-size: 2rem;
  font-weight: 700;
}

.title-icon {
  width: 2rem;
  height: 2rem;
  stroke-width: 2;
}

.page-subtitle {
  margin: 0;
  color: rgba(255, 255, 255, 0.7);
  font-size: 1rem;
}

.create-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  border: none;
  border-radius: 0.75rem;
  color: #60A5FA;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.create-btn:hover {
  background: rgba(59, 130, 246, 0.3);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.4);
}

/* 統計卡片 */
.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  border-radius: 0.75rem;
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: 0.75rem;
}

.stat-icon svg {
  width: 1.5rem;
  height: 1.5rem;
  stroke-width: 2;
  color: rgba(255, 255, 255, 0.9);
}

.stat-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-label {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.875rem;
}

.stat-value {
  color: rgba(255, 255, 255, 0.95);
  font-size: 1.75rem;
  font-weight: 700;
}

/* 工具欄 */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  margin-bottom: 1.5rem;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  max-width: 400px;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
}

.search-icon {
  width: 1.25rem;
  height: 1.25rem;
  stroke-width: 2;
  color: rgba(255, 255, 255, 0.5);
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.9375rem;
  outline: none;
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.toolbar-actions {
  display: flex;
  gap: 0.75rem;
}

.filter-select,
.bulk-btn {
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 0.75rem;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-select {
  background: rgba(255, 255, 255, 0.05);
}

.filter-select:hover {
  background: rgba(255, 255, 255, 0.1);
}

.bulk-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* 標籤網格 */
.tags-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.tag-card {
  padding: 1.5rem;
  border-radius: 1rem;
  transition: all 0.3s;
  cursor: pointer;
}

.tag-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
}

.tag-card.selected {
  border-color: rgba(59, 130, 246, 0.5);
  background: rgba(59, 130, 246, 0.1);
}

.tag-card-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.tag-checkbox {
  width: 1.25rem;
  height: 1.25rem;
  cursor: pointer;
}

.tag-color-large {
  width: 3rem;
  height: 3rem;
  border-radius: 0.75rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.tag-card-body {
  margin-bottom: 1rem;
}

.tag-card-title {
  margin: 0 0 0.5rem 0;
  color: rgba(255, 255, 255, 0.95);
  font-size: 1.125rem;
  font-weight: 600;
}

.tag-card-description {
  margin: 0 0 1rem 0;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.875rem;
  line-height: 1.5;
}

.tag-meta {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.875rem;
}

.meta-icon {
  width: 1rem;
  height: 1rem;
  stroke-width: 2;
}

.tag-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.tag-card-footer {
  display: flex;
  gap: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.625rem;
  border: none;
  border-radius: 0.5rem;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 1);
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #EF4444;
}

/* 空狀態 */
.empty-state {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 4rem 2rem;
  text-align: center;
}

.empty-icon {
  width: 4rem;
  height: 4rem;
  stroke-width: 1.5;
  color: rgba(255, 255, 255, 0.4);
}

.empty-state h3 {
  margin: 0;
  color: rgba(255, 255, 255, 0.9);
  font-size: 1.5rem;
}

.empty-state p {
  margin: 0;
  color: rgba(255, 255, 255, 0.6);
}

.create-first-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  padding: 0.875rem 1.5rem;
  border: none;
  border-radius: 0.75rem;
  color: #60A5FA;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
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
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 2000;
  padding: 1rem;
}

.modal-content {
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 2rem;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.modal-title {
  margin: 0;
  color: rgba(255, 255, 255, 0.95);
  font-size: 1.5rem;
  font-weight: 700;
}

.modal-close {
  padding: 0.5rem;
  border: none;
  border-radius: 0.5rem;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.2s;
}

.modal-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.875rem;
  font-weight: 600;
}

.form-input,
.form-textarea {
  padding: 0.875rem 1rem;
  border: none;
  border-radius: 0.75rem;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.9375rem;
  outline: none;
  transition: all 0.2s;
}

.form-input:focus,
.form-textarea:focus {
  background: rgba(255, 255, 255, 0.1);
}

.form-input::placeholder,
.form-textarea::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.color-picker {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.color-option {
  width: 3rem;
  height: 3rem;
  border-radius: 0.75rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.color-option:hover {
  transform: scale(1.1);
}

.color-option.selected {
  border-color: rgba(255, 255, 255, 0.6);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.check-icon {
  width: 1.5rem;
  height: 1.5rem;
  stroke-width: 3;
  color: white;
}

.color-input {
  width: 3rem;
  height: 3rem;
  border: none;
  border-radius: 0.75rem;
  cursor: pointer;
}

.scope-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.scope-option {
  padding: 1rem;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.scope-option:hover {
  background: rgba(255, 255, 255, 0.1);
}

.scope-option.selected {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.4);
}

.scope-radio {
  display: none;
}

.scope-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: rgba(255, 255, 255, 0.9);
}

.modal-footer {
  display: flex;
  gap: 0.75rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-cancel,
.btn-confirm {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  border: none;
  border-radius: 0.75rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  color: rgba(255, 255, 255, 0.8);
}

.btn-cancel:hover {
  background: rgba(255, 255, 255, 0.1);
}

.btn-confirm {
  color: #60A5FA;
}

.btn-confirm:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.3);
  transform: translateY(-1px);
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 載入 */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  z-index: 1500;
  color: rgba(255, 255, 255, 0.9);
}

.spinner-large {
  width: 3rem;
  height: 3rem;
  border: 4px solid rgba(255, 255, 255, 0.2);
  border-top-color: #60A5FA;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 圖標 */
.icon {
  width: 1rem;
  height: 1rem;
  stroke-width: 2;
  flex-shrink: 0;
}

/* 動畫 */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.9);
}
</style>
