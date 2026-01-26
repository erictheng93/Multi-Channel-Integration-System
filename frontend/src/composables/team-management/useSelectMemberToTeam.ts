/**
 * Select Member to Team Composable
 *
 * 職責：
 * - 管理選擇成員加入團隊的 Modal 狀態
 * - 獲取可添加到團隊的成員列表（過濾已在團隊中的成員）
 * - 管理成員選擇狀態
 * - 處理團隊角色選擇
 * - 提交添加成員到團隊的請求（支援單個和批量）
 *
 * @module composables/team-management/useSelectMemberToTeam
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { teamApi } from '@/api/team'
import { useToast } from '@/composables/useToast'

// ==================== Types ====================

export type TeamRoleInTeam = 'member' | 'lead' | 'supervisor'

export interface AvailableMember {
  id: string
  email: string
  displayName: string
  role: 'admin' | 'agent'
  isActive: boolean
}

export interface UseSelectMemberToTeamReturn {
  // Modal State
  isModalOpen: Ref<boolean>
  targetTeamId: Ref<number | null>
  targetTeamName: Ref<string>

  // Member Data
  availableMembers: Ref<AvailableMember[]>
  filteredMembers: ComputedRef<AvailableMember[]>
  loading: Ref<boolean>
  submitting: Ref<boolean>

  // Selection State
  selectedMemberIds: Ref<Set<string>>
  selectedRole: Ref<TeamRoleInTeam>
  searchQuery: Ref<string>

  // Computed
  selectedCount: ComputedRef<number>
  canSubmit: ComputedRef<boolean>

  // Methods
  openModal: (teamId: number, teamName: string, currentMemberIds?: string[]) => Promise<void>
  closeModal: () => void
  toggleMemberSelection: (memberId: string) => void
  selectAll: () => void
  clearSelection: () => void
  submitAddMembers: () => Promise<boolean>
}

// ==================== Composable ====================

/**
 * 選擇成員加入團隊的 Composable
 *
 * @example
 * ```typescript
 * const selectMember = useSelectMemberToTeam()
 *
 * // 打開選擇成員 Modal
 * await selectMember.openModal(teamId, teamName, currentMemberIds)
 *
 * // 選擇成員
 * selectMember.toggleMemberSelection(memberId)
 *
 * // 提交添加
 * const success = await selectMember.submitAddMembers()
 * ```
 */
export function useSelectMemberToTeam(): UseSelectMemberToTeamReturn {
  const { showSuccess, showError } = useToast()

  // ==================== Modal State ====================

  const isModalOpen = ref(false)
  const targetTeamId = ref<number | null>(null)
  const targetTeamName = ref('')

  // ==================== Member Data ====================

  const availableMembers = ref<AvailableMember[]>([])
  const currentTeamMemberIds = ref<Set<string>>(new Set())
  const loading = ref(false)
  const submitting = ref(false)

  // ==================== Selection State ====================

  const selectedMemberIds = ref<Set<string>>(new Set())
  const selectedRole = ref<TeamRoleInTeam>('member')
  const searchQuery = ref('')

  // ==================== Computed ====================

  /**
   * 過濾後的可選成員列表
   * - 排除已在當前團隊中的成員
   * - 根據搜索關鍵字過濾
   */
  const filteredMembers = computed(() => {
    let members = availableMembers.value.filter(
      member => !currentTeamMemberIds.value.has(member.id)
    )

    // 根據搜索關鍵字過濾
    if (searchQuery.value.trim()) {
      const query = searchQuery.value.toLowerCase().trim()
      members = members.filter(
        member =>
          member.displayName?.toLowerCase().includes(query) ||
          member.email?.toLowerCase().includes(query)
      )
    }

    return members
  })

  /**
   * 已選擇的成員數量
   */
  const selectedCount = computed(() => selectedMemberIds.value.size)

  /**
   * 是否可以提交
   */
  const canSubmit = computed(() => {
    return selectedMemberIds.value.size > 0 && !submitting.value
  })

  // ==================== Methods ====================

  /**
   * 載入所有可用成員
   * 使用 getMembers API 獲取所有系統成員
   */
  async function loadAvailableMembers(): Promise<void> {
    loading.value = true
    try {
      const response = await teamApi.getMembers()

      if (response.success && response.data) {
        // 轉換數據格式
        availableMembers.value = response.data
          .filter(member => member.status === 'active') // 只顯示活躍成員
          .map(member => ({
            id: member.id,
            email: member.email || member.loginId,
            displayName: member.name || member.loginId,
            role: member.role,
            isActive: member.status === 'active'
          }))
      } else {
        console.error('載入成員列表失敗:', response.error)
        availableMembers.value = []
      }
    } catch (error) {
      console.error('載入成員列表失敗:', error)
      availableMembers.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * 打開選擇成員 Modal
   * @param teamId 目標團隊 ID
   * @param teamName 目標團隊名稱
   * @param currentMemberIds 當前團隊中的成員 ID 列表
   */
  async function openModal(
    teamId: number,
    teamName: string,
    currentMemberIds: string[] = []
  ): Promise<void> {
    // 設置目標團隊資訊
    targetTeamId.value = teamId
    targetTeamName.value = teamName
    currentTeamMemberIds.value = new Set(currentMemberIds)

    // 重置選擇狀態
    selectedMemberIds.value = new Set()
    selectedRole.value = 'member'
    searchQuery.value = ''

    // 打開 Modal
    isModalOpen.value = true

    // 載入可用成員
    await loadAvailableMembers()
  }

  /**
   * 關閉 Modal 並重置狀態
   */
  function closeModal(): void {
    isModalOpen.value = false
    targetTeamId.value = null
    targetTeamName.value = ''
    availableMembers.value = []
    currentTeamMemberIds.value = new Set()
    selectedMemberIds.value = new Set()
    selectedRole.value = 'member'
    searchQuery.value = ''
  }

  /**
   * 切換成員選擇狀態
   */
  function toggleMemberSelection(memberId: string): void {
    const newSet = new Set(selectedMemberIds.value)
    if (newSet.has(memberId)) {
      newSet.delete(memberId)
    } else {
      newSet.add(memberId)
    }
    selectedMemberIds.value = newSet
  }

  /**
   * 全選所有可見成員
   */
  function selectAll(): void {
    const newSet = new Set<string>()
    filteredMembers.value.forEach(member => {
      newSet.add(member.id)
    })
    selectedMemberIds.value = newSet
  }

  /**
   * 清除所有選擇
   */
  function clearSelection(): void {
    selectedMemberIds.value = new Set()
  }

  /**
   * 提交添加成員到團隊
   * 🚀 Phase 2 優化: 使用批量 API
   * - 1 API 請求 (vs 原本 N 請求)
   * - 2-3 DB 查詢 (vs 原本 6*N 查詢)
   * - 用戶等待時間: ~200ms
   * @returns 是否成功
   */
  async function submitAddMembers(): Promise<boolean> {
    if (!canSubmit.value || !targetTeamId.value) {
      return false
    }

    const selectedIds = Array.from(selectedMemberIds.value)
    submitting.value = true

    try {
      // 🚀 Phase 2: 使用批量 API (1 API 請求 + 2-3 DB 查詢)
      const response = await teamApi.batchAddMembersToTeam(
        targetTeamId.value,
        selectedIds,
        selectedRole.value
      )

      if (response.success && response.data) {
        const { skipped, errors, addedCount } = response.data

        // 顯示成功訊息
        if (addedCount > 0) {
          showSuccess(
            '新增成員成功',
            `已將 ${addedCount} 位成員加入 ${targetTeamName.value}`
          )
        }

        // 處理錯誤
        if (errors.length > 0) {
          const errorMsgs = errors.map(e => {
            const name = availableMembers.value.find(m => m.id === e.agentId)?.displayName || e.agentId
            return `${name}: ${e.error}`
          })
          showError('部分成員加入失敗', errorMsgs.join('\n'))
        }

        // 如果有任何成功的，關閉 Modal 並返回 true
        if (addedCount > 0) {
          closeModal()
          return true
        }

        // 所有成員都已在團隊中
        if (skipped.length === selectedIds.length) {
          showError('所有成員都已在團隊中', '')
          return false
        }

        return false
      }

      // API 請求失敗
      showError('新增成員失敗', response.error || '請稍後重試')
      return false
    } catch (error) {
      console.error('添加成員到團隊失敗:', error)
      showError('添加成員失敗', '請稍後重試')
      return false
    } finally {
      submitting.value = false
    }
  }

  // ==================== Return ====================

  return {
    // Modal State
    isModalOpen,
    targetTeamId,
    targetTeamName,

    // Member Data
    availableMembers,
    filteredMembers,
    loading,
    submitting,

    // Selection State
    selectedMemberIds,
    selectedRole,
    searchQuery,

    // Computed
    selectedCount,
    canSubmit,

    // Methods
    openModal,
    closeModal,
    toggleMemberSelection,
    selectAll,
    clearSelection,
    submitAddMembers
  }
}
