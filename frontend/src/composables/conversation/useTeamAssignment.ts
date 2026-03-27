import { ref, computed, onMounted } from 'vue'
import { useAuth } from '@/composables'
import { useConversationsStore } from '@/stores/conversations'
import { usePermissions } from '@/services/permissionService'
import type { Conversation, Agent } from '@/types'
import { preloadService } from '@/services/preloadService'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useToast } from '@/composables/useToast'
import { CONVERSATION_STATUS, isOpenConversation } from '@/constants/conversation-status'

export interface UseTeamAssignmentOptions {
  conversation: () => Conversation
  onAssigned: (_conversation: Conversation, _assignedTo: string) => void
  onUnassigned: (_conversation: Conversation) => void
  onError: (_message: string) => void
}

export function useTeamAssignment(options: UseTeamAssignmentOptions) {
  const { conversation: getConversation, onAssigned, onUnassigned, onError } = options
  const { currentAgent } = useAuth()
  const conversationsStore = useConversationsStore()
  const { canAssignConversation, canUnassignConversation } = usePermissions()
  const isAssigning = ref(false)
  const showTeamSelector = ref(false)
  const teamSearchTerm = ref('')
  const selectedTeam = ref<number | null>(null)
  const isLoadingTeams = ref(false)
  const { showWarning } = useConfirmDialog()
  const { showSuccess, showError } = useToast()

  const teams = computed(() => {
    const cachedTeams = preloadService.getTeams()
    return cachedTeams.map(team => ({ id: team.id, name: team.name, memberCount: team.memberCount }))
  })

  const agentToTeamMember = (agent: Agent) => {
    if (!agent) { return null }
    return {
      id: agent.id, loginId: agent.email, name: agent.displayName || agent.name,
      email: agent.email, role: agent.role,
      status: (agent.isActive ? 'active' : 'inactive') as 'active' | 'inactive' | 'pending',
      group: undefined, primaryTeamId: agent.primaryTeamId, avatar: undefined,
      createdAt: new Date(agent.createdAt), updatedAt: new Date(),
      lastLoginAt: agent.lastActive ? new Date(agent.lastActive) : undefined
    }
  }

  const canAssignToTeam = computed(() => {
    if (!currentAgent.value || currentAgent.value.role !== 'admin') {return false}
    const teamMemberAgent = agentToTeamMember(currentAgent.value)
    const conv = getConversation()
    return canAssignConversation(teamMemberAgent, conv) && isOpenConversation(conv.status)
  })

  const canUnassign = computed(() => {
    if (!currentAgent.value) {return false}
    const teamMemberAgent = agentToTeamMember(currentAgent.value)
    return canUnassignConversation(teamMemberAgent, getConversation())
  })

  const filteredTeams = computed(() => {
    let teamList = teams.value
    if (teamSearchTerm.value.trim()) {
      const term = teamSearchTerm.value.toLowerCase()
      teamList = teamList.filter(team => team.name.toLowerCase().includes(term))
    }
    return teamList
  })

  const selectedTeamName = computed(() => {
    if (!selectedTeam.value) { return '' }
    const team = teams.value.find(t => t.id === selectedTeam.value)
    return team?.name || '未知團隊'
  })

  const getAssignedDisplayName = () => {
    const conv = getConversation()
    if (conv.assignedTeamId) {
      const team = teams.value.find(t => t.id === conv.assignedTeamId)
      return team?.name || `團隊 #${conv.assignedTeamId}`
    }
    return '未指派'
  }

  const toggleTeamSelector = async () => {
    if (showTeamSelector.value) { closeTeamSelector(); return }
    showTeamSelector.value = true
    if (teams.value.length === 0) {isLoadingTeams.value = true}
    await preloadService.ensureTeamsLoaded()
    isLoadingTeams.value = false
  }

  const closeTeamSelector = () => {
    showTeamSelector.value = false; selectedTeam.value = null; teamSearchTerm.value = ''; isLoadingTeams.value = false
  }

  const selectTeam = (teamId: number) => { selectedTeam.value = selectedTeam.value === teamId ? null : teamId }
  const cancelSelection = () => { selectedTeam.value = null }

  const handleManualRefresh = async () => {
    if (isLoadingTeams.value) { return }
    console.log('[AdvancedAssignActions] Manual refresh triggered by user')
    isLoadingTeams.value = true
    try {
      await preloadService.refreshTeams()
      showSuccess('刷新成功', '團隊列表已更新')
    } catch (error) {
      console.error('[AdvancedAssignActions] Manual refresh failed:', error)
      showError('刷新失敗', '無法重新載入團隊列表，請稍後重試')
    } finally { isLoadingTeams.value = false }
  }

  const confirmAssignment = async () => {
    const conv = getConversation()
    if (!selectedTeam.value || isAssigning.value) { console.warn('[AdvancedAssignActions] Invalid selection or already assigning'); return }
    const teamExists = teams.value.some(t => t.id === selectedTeam.value)
    if (!teamExists) { showError('指派失敗', '選中的團隊不存在，請重新選擇'); onError('選中的團隊不存在，請重新選擇'); return }

    const selectedTeamId = selectedTeam.value
    const selectedTeamData = teams.value.find(t => t.id === selectedTeamId)
    const teamName = selectedTeamData?.name || '團隊'
    console.log(`[AdvancedAssignActions] Starting assignment to team: ${teamName} (ID: ${selectedTeamId})`)

    if (conv.assignedTeamId && conv.assignedTeamId !== selectedTeamId) {
      const currentTeamId = conv.assignedTeamId
      const currentTeamData = teams.value.find(t => t.id === currentTeamId)
      const currentTeamName = currentTeamData?.name || conv.assignedTeam?.name || `團隊 #${currentTeamId}`
      console.log(`[AdvancedAssignActions] Re-assignment detected: ${currentTeamName} → ${teamName}`)
      const confirmed = await showWarning('確定要轉指派給其他團隊？', `此對話目前指派給「${currentTeamName}」，確定要轉指派給「${teamName}」嗎？`)
      if (!confirmed) { console.log('[AdvancedAssignActions] Re-assignment cancelled by user'); return }
      console.log('[AdvancedAssignActions] Re-assignment confirmed by user')
    }

    showSuccess('指派成功', `已成功將對話指派給「${teamName}」`)
    closeTeamSelector()
    const optimisticConv = { ...conv, assignedTeamId: selectedTeamId, assignedTeam: { id: selectedTeamId, name: teamName, description: null } }
    onAssigned(optimisticConv, `team-${selectedTeamId}`)

    isAssigning.value = true
    try {
      let success: boolean
      const isTransfer = conv.assignedTeamId && conv.assignedTeamId !== selectedTeamId
      if (isTransfer) {
        const fromTeamId = conv.assignedTeamId
        const fromTeamName = conv.assignedTeam?.name || `團隊 #${fromTeamId}`
        console.log(`[AdvancedAssignActions] Using transfer API: ${fromTeamName} → ${teamName}`)
        success = await conversationsStore.transferConversationToTeam(conv.id, fromTeamId, selectedTeamId, teamName, '管理員手動轉指派')
      } else {
        console.log(`[AdvancedAssignActions] Using assign API: → ${teamName}`)
        success = await conversationsStore.assignConversationToTeam(conv.id, selectedTeamId, teamName)
      }
      if (success) { console.log(`[AdvancedAssignActions] ${isTransfer ? 'Transfer' : 'Assignment'} confirmed by server`) }
      else {
        console.error(`[AdvancedAssignActions] Server rejected ${isTransfer ? 'transfer' : 'assignment'}`)
        showError(isTransfer ? '轉指派失敗' : '指派失敗', `服務器拒絕${isTransfer ? '轉指派' : '指派'}，請稍後重試`)
        onError(`${isTransfer ? '轉指派' : '指派'}給團隊 ${teamName} 失敗`)
      }
    } catch (error) {
      console.error('[AdvancedAssignActions] Confirm assignment/transfer failed:', error)
      showError('操作失敗', '操作過程中發生錯誤，請稍後重試')
      onError('操作過程中發生錯誤')
    } finally { isAssigning.value = false }
  }

  const handleUnassign = async () => {
    if (isAssigning.value) {return}
    const conv = getConversation()
    if (!conv.assignedTeamId) { showError('無法取消指派', '此對話尚未指派'); return }
    const assignedName = conv.assignedTeam?.name || '未知'
    const confirmed = await showWarning(`確定要取消指派嗎？`, `此對話目前指派給團隊「${assignedName}」，取消後將變為待處理狀態。`)
    if (!confirmed) {return}

    console.log(`[AdvancedAssignActions] Starting unassign for conversation:`, conv.id)
    showSuccess('取消指派成功', `已成功取消對話指派`)
    const optimisticConv: Conversation = { ...conv, status: CONVERSATION_STATUS.PENDING, assignedTeamId: undefined, assignedTeam: undefined }
    onUnassigned(optimisticConv)
    closeTeamSelector()

    isAssigning.value = true
    try {
      const success = await conversationsStore.unassignConversation(conv.id, '管理員手動取消指派')
      if (success) { console.log(`[AdvancedAssignActions] Unassign confirmed by server`) }
      else { console.error(`[AdvancedAssignActions] Server rejected unassign`); showError('取消指派失敗', '服務器拒絕取消指派，請稍後重試'); onError('取消指派失敗') }
    } catch (error) {
      console.error('[AdvancedAssignActions] Unassign failed with exception:', error)
      showError('取消指派失敗', '取消指派過程中發生錯誤，請稍後重試'); onError('取消指派過程中發生錯誤')
    } finally { isAssigning.value = false }
  }

  const _getInitials = (name: string | undefined): string => { if (!name) { return 'U' } return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) }
  const _getRoleDisplayName = (role: string | undefined): string => { if (!role) { return '' } const roleNames = { 'admin': '管理員', 'team': '團隊主管', 'agent': '客服專員' }; return roleNames[role as keyof typeof roleNames] || role }
  void _getInitials; void _getRoleDisplayName

  onMounted(async () => { if (currentAgent.value?.role === 'admin') { await preloadService.ensureTeamsLoaded() } })

  return {
    isAssigning, showTeamSelector, teamSearchTerm, selectedTeam, isLoadingTeams,
    teams, canAssignToTeam, canUnassign, filteredTeams, selectedTeamName,
    getAssignedDisplayName, toggleTeamSelector, closeTeamSelector, selectTeam, cancelSelection,
    handleManualRefresh, confirmAssignment, handleUnassign
  }
}
