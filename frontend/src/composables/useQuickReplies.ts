/**
 * Quick Replies Composable
 *
 * 管理快速回复列表和选择逻辑
 * 支持静态配置和动态加载 (可扩展)
 *
 * @module composables/useQuickReplies
 * @example
 * ```typescript
 * const quickReplies = useQuickReplies({
 *   initialReplies: [
 *     { id: '1', text: '感謝您的來信' },
 *     { id: '2', text: '請問還有其他需要協助的嗎？' }
 *   ],
 *   onSelect: (reply) => {
 *     messageInput.setMessageText(reply.text)
 *   }
 * })
 *
 * // In template
 * <QuickReplies
 *   :replies="quickReplies.replies.value"
 *   @select="quickReplies.selectReply"
 * />
 * ```
 */

import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'

/**
 * 快速回复项
 */
export interface QuickReply {
  /** 唯一标识 */
  id: string
  /** 回复文本 */
  text: string
  /** 分类 (可选) */
  category?: string
  /** 是否启用 (可选) */
  enabled?: boolean
}

/**
 * useQuickReplies 配置选项
 */
export interface QuickRepliesOptions {
  /**
   * 初始快速回复列表
   */
  initialReplies?: QuickReply[]

  /**
   * 选择回复时的回调
   * @param reply - 选中的快速回复
   */
  onSelect?: (reply: QuickReply) => void

  /**
   * 过滤条件 (可选)
   * @param reply - 快速回复项
   * @returns 是否显示此回复
   */
  filter?: (reply: QuickReply) => boolean

  /**
   * 是否自动加载 (从 API)
   * 默认: false
   */
  autoLoad?: boolean

  /**
   * 加载函数 (可选)
   * @returns Promise<QuickReply[]>
   */
  loadReplies?: () => Promise<QuickReply[]>
}

/**
 * useQuickReplies 返回值
 */
export interface QuickRepliesReturn {
  // State
  /** 快速回复列表 */
  replies: Ref<QuickReply[]>
  /** 是否正在加载 */
  loading: Ref<boolean>
  /** 过滤后的回复列表 */
  filteredReplies: ComputedRef<QuickReply[]>

  // Actions
  /** 选择快速回复 */
  selectReply: (reply: QuickReply) => void
  /** 通过 ID 选择回复 */
  selectById: (id: string) => void
  /** 添加新回复 */
  addReply: (reply: QuickReply) => void
  /** 删除回复 */
  removeReply: (id: string) => void
  /** 刷新回复列表 (从 API) */
  refresh: () => Promise<void>
  /** 清空回复列表 */
  clear: () => void
}

/**
 * 默认快速回复列表
 */
const DEFAULT_QUICK_REPLIES: QuickReply[] = [
  { id: '1', text: '感謝您的來信，我們會盡快回覆', enabled: true },
  { id: '2', text: '請問還有其他需要協助的嗎？', enabled: true },
  { id: '3', text: '謝謝您的耐心等待', enabled: true },
  { id: '4', text: '問題已為您解決，如有其他疑問請隨時聯繫', enabled: true },
]

/**
 * 快速回复管理 Composable
 *
 * 功能:
 * - ✅ 管理快速回复列表
 * - ✅ 支持静态配置
 * - ✅ 支持动态加载 (从 API)
 * - ✅ 支持过滤
 * - ✅ CRUD 操作
 *
 * @param options - 配置选项
 * @returns 快速回复状态和操作方法
 */
export function useQuickReplies(options: QuickRepliesOptions = {}): QuickRepliesReturn {
  const {
    initialReplies = DEFAULT_QUICK_REPLIES,
    onSelect,
    filter,
    autoLoad = false,
    loadReplies,
  } = options

  // ============================================================================
  // State
  // ============================================================================

  const replies = ref<QuickReply[]>(initialReplies)
  const loading = ref(false)

  // ============================================================================
  // Computed
  // ============================================================================

  /**
   * 过滤后的回复列表
   */
  const filteredReplies = computed(() => {
    let result = replies.value

    // 默认过滤: 只显示启用的回复
    result = result.filter((reply) => reply.enabled !== false)

    // 自定义过滤
    if (filter) {
      result = result.filter(filter)
    }

    return result
  })

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * 选择快速回复
   * @param reply - 选中的快速回复
   */
  const selectReply = (reply: QuickReply): void => {
    onSelect?.(reply)
  }

  /**
   * 通过 ID 选择回复
   * @param id - 回复 ID
   */
  const selectById = (id: string): void => {
    const reply = replies.value.find((r) => r.id === id)
    if (reply) {
      selectReply(reply)
    }
  }

  /**
   * 添加新回复
   * @param reply - 新回复
   */
  const addReply = (reply: QuickReply): void => {
    // 检查 ID 是否已存在
    const exists = replies.value.some((r) => r.id === reply.id)
    if (exists) {
      console.warn(`[useQuickReplies] Reply with id "${reply.id}" already exists`)
      return
    }

    replies.value.push(reply)
  }

  /**
   * 删除回复
   * @param id - 回复 ID
   */
  const removeReply = (id: string): void => {
    const index = replies.value.findIndex((r) => r.id === id)
    if (index !== -1) {
      replies.value.splice(index, 1)
    }
  }

  /**
   * 刷新回复列表 (从 API)
   */
  const refresh = async (): Promise<void> => {
    if (!loadReplies) {
      console.warn('[useQuickReplies] No loadReplies function provided')
      return
    }

    loading.value = true

    try {
      const newReplies = await loadReplies()
      replies.value = newReplies
    } catch (error) {
      console.error('[useQuickReplies] Failed to load replies:', error)
    } finally {
      loading.value = false
    }
  }

  /**
   * 清空回复列表
   */
  const clear = (): void => {
    replies.value = []
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  // 自动加载
  if (autoLoad && loadReplies) {
    refresh()
  }

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    replies,
    loading,
    filteredReplies,

    // Actions
    selectReply,
    selectById,
    addReply,
    removeReply,
    refresh,
    clear,
  }
}
