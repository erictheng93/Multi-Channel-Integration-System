/**
 * Customer Tags Controller
 *
 * Main controller composable that orchestrates all tag management functionality.
 * Delegates concerns to specialized composables following the Controller Pattern.
 *
 * @module composables/customerTags/useCustomerTagsController
 */

import { ref, computed } from 'vue'
import { useTagsStore } from '@/stores/tags'
import { useToast } from '@/composables/useToast'
import { useTagSearch } from './useTagSearch'
import { useTagActions } from './useTagActions'
import { useTagSelection } from './useTagSelection'
import { useTagKeyboard } from './useTagKeyboard'
import type { Tag } from '@/types/tag'

/**
 * Main controller for Customer Tags management
 *
 * Architecture:
 * - Orchestrates sub-composables for specific concerns
 * - Manages lifecycle (initialize, cleanup)
 * - Provides unified state and actions to view component
 *
 * @returns Controller state and methods
 */
export function useCustomerTagsController() {
  // ==================== Core Dependencies ====================

  const store = useTagsStore()
  const { showSuccess, showError } = useToast()

  // ==================== State ====================

  const loading = ref(true)
  const tags = computed(() => store.tags)

  // Modal visibility state
  const showCreateModal = ref(false)
  const showEditModal = ref(false)
  const showDeleteModal = ref(false)
  const showBulkDeleteModal = ref(false)
  const showStatsModal = ref(false)
  const showConversationsModal = ref(false)
  const showBulkMenu = ref(false)

  // Modal data state
  const editingTag = ref<Tag | null>(null)
  const deletingTag = ref<Tag | null>(null)
  const statsTag = ref<Tag | null>(null)
  const conversationsTag = ref<Tag | null>(null)

  // Form state
  const formData = ref({
    name: '',
    color: '#3B82F6',
    description: ''
  })

  // Predefined color palette
  const predefinedColors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
    '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
    '#6366F1', '#84CC16', '#06B6D4', '#F43F5E'
  ]

  // ==================== Statistics ====================

  const stats = computed(() => ({
    totalTags: tags.value.length,
    totalCustomers: tags.value.reduce((sum: number, tag: Tag) => sum + (tag.customerCount || 0), 0),
    totalConversations: tags.value.reduce((sum: number, tag: Tag) => sum + (tag.conversationCount || 0), 0),
    activeTags: tags.value.filter((tag: Tag) => tag.isActive).length
  }))

  // ==================== Sub-Composables ====================

  // Search and filtering
  const search = useTagSearch(store, () => { loading.value = true }, () => { loading.value = false })

  // CRUD actions (create, update, delete, bulk delete)
  const actions = useTagActions(
    store,
    tags,
    formData,
    editingTag,
    deletingTag,
    showSuccess,
    showError,
    () => {
      // Close modals callback
      showCreateModal.value = false
      showEditModal.value = false
      editingTag.value = null
      formData.value = {
        name: '',
        color: '#3B82F6',
        description: ''
      }
    },
    () => {
      // Cancel delete callback
      showDeleteModal.value = false
      deletingTag.value = null
    }
  )

  // Bulk selection management
  const selection = useTagSelection()

  // Keyboard shortcuts
  const keyboard = useTagKeyboard(
    showCreateModal,
    showEditModal,
    showDeleteModal,
    showBulkDeleteModal,
    showBulkMenu,
    () => {
      // Close modals callback
      showCreateModal.value = false
      showEditModal.value = false
      editingTag.value = null
      formData.value = {
        name: '',
        color: '#3B82F6',
        description: ''
      }
    },
    () => {
      // Cancel delete callback
      showDeleteModal.value = false
      deletingTag.value = null
    },
    () => {
      // Cancel bulk delete callback
      showBulkDeleteModal.value = false
    }
  )

  // ==================== Modal Actions ====================

  const openCreateModal = () => {
    editingTag.value = null
    formData.value = {
      name: '',
      color: '#3B82F6',
      description: ''
    }
    showCreateModal.value = true
  }

  const openEditModal = (tag: Tag) => {
    editingTag.value = tag
    formData.value = {
      name: tag.name,
      color: tag.color,
      description: tag.description || ''
    }
    showEditModal.value = true
  }

  const openDeleteModal = (tag: Tag) => {
    deletingTag.value = tag
    showDeleteModal.value = true
  }

  const openStatsModal = (tag: Tag) => {
    statsTag.value = tag
    showStatsModal.value = true
  }

  const openConversationsModal = (tag: Tag) => {
    conversationsTag.value = tag
    showConversationsModal.value = true
  }

  const openBulkDeleteModal = () => {
    if (selection.selectedTags.value.length === 0) {return}
    showBulkMenu.value = false
    showBulkDeleteModal.value = true
  }

  const closeModals = () => {
    showCreateModal.value = false
    showEditModal.value = false
    showDeleteModal.value = false
    showBulkDeleteModal.value = false
    showStatsModal.value = false
    showConversationsModal.value = false
    showBulkMenu.value = false
    editingTag.value = null
    deletingTag.value = null
    statsTag.value = null
    conversationsTag.value = null
    formData.value = {
      name: '',
      color: '#3B82F6',
      description: ''
    }
  }

  // ==================== Lifecycle ====================

  /**
   * Initialize controller
   * - Load tags from store
   * - Setup keyboard shortcuts
   */
  const initialize = async () => {
    loading.value = true
    try {
      await search.loadTags()
      console.log('✅ [CustomerTagsController] Initialized successfully')
    } catch (error) {
      console.error('❌ [CustomerTagsController] Initialization failed:', error)
      showError('載入標籤失敗', '請檢查網路連線或稍後重試')
    } finally {
      loading.value = false
    }
  }

  /**
   * Cleanup controller
   * - Remove event listeners
   */
  const cleanup = () => {
    keyboard.cleanup()
    console.log('🧹 [CustomerTagsController] Cleaned up')
  }

  // ==================== Return Controller Interface ====================

  return {
    // State
    loading,
    tags,
    stats,

    // Modal visibility
    showCreateModal,
    showEditModal,
    showDeleteModal,
    showBulkDeleteModal,
    showStatsModal,
    showConversationsModal,
    showBulkMenu,

    // Modal data
    editingTag,
    deletingTag,
    statsTag,
    conversationsTag,

    // Form
    formData,
    predefinedColors,

    // Sub-composables
    search,
    actions,
    selection,
    keyboard,

    // Modal actions
    openCreateModal,
    openEditModal,
    openDeleteModal,
    openStatsModal,
    openConversationsModal,
    openBulkDeleteModal,
    closeModals,

    // Lifecycle
    initialize,
    cleanup
  }
}
