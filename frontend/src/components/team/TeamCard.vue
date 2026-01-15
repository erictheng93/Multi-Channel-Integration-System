<template>
  <div
    class="team-card"
    @click="showTeamDetails"
  >
    <!-- 主要卡片內容 -->
    <div class="flex items-center gap-4 flex-1">
      <div class="team-avatar">
        <div
          class="text-white font-bold text-[1.375rem] uppercase"
          style="text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2)"
        >
          {{ getTeamInitial(team.name) }}
        </div>
      </div>
      <div class="flex-1 min-w-0">
        <h3
          class="m-0 mb-1.5 text-gray-800 text-[1.375rem] font-bold whitespace-nowrap overflow-hidden text-ellipsis"
        >
          {{ team.name }}
        </h3>
        <p
          class="m-0 mb-3 text-gray-500 text-base leading-normal whitespace-nowrap overflow-hidden text-ellipsis"
        >
          {{ team.description || '無描述' }}
        </p>
        <div class="flex items-center gap-3 flex-wrap">
          <span :class="['status', team.isActive ? 'active' : 'inactive']">
            {{ team.isActive ? '活躍' : '停用' }}
          </span>
          <span class="text-gray-500 text-sm font-medium py-1.5 px-3 bg-gray-200 rounded-xl">
            {{ team.memberCount || 0 }} 成員
          </span>
        </div>
      </div>
    </div>

    <!-- 操作按鈕區 -->
    <div
      class="flex gap-2 items-center flex-shrink-0 flex-wrap"
      @click.stop
    >
      <button
        :class="['btn', team.isActive ? 'btn-danger' : 'btn-success']"
        :disabled="loading"
        @click="$emit('toggle-status', team)"
      >
        {{ team.isActive ? '停用' : '啟用' }}
      </button>
      <button
        class="btn btn-danger"
        :disabled="loading"
        @click="$emit('remove-team', team)"
      >
        刪除團隊
      </button>
    </div>
  </div>

  <!-- 團隊詳情 Modal -->
  <TeamDetailModal
    :show="teamModal.showModal.value"
    :team="team"
    :is-editing="teamModal.isEditing.value"
    @close="teamModal.closeModal"
    @start-edit="teamModal.startEdit"
    @cancel-edit="teamModal.cancelEdit"
    @team-updated="handleTeamUpdated"
  >
    <template #members>
      <TeamMemberSection
        :team="team"
        :members="members"
        :loading="loadingMembers"
        @add-member="openAddMemberModal"
        @member-removed="handleMemberRemoved"
      />
    </template>

    <template #qr-code>
      <TeamQRSection
        :team="team"
        :qr-code="currentQRCode"
        :loading="loadingQRCode"
        :generating="generatingQR"
        :qr-stats="qrStats"
        @generate="handleGenerateQR"
      />
    </template>
  </TeamDetailModal>

  <!-- 新增成員 Modal -->
  <AddMemberModal
    :visible="memberOps.addMemberModal.value"
    :form="memberOps.addMemberForm"
    :loading="memberOps.addMemberLoading.value"
    :show-password="memberOps.showAddPassword.value"
    @close="closeAddMemberModal"
    @submit="handleMemberAdded"
    @toggle-password="memberOps.toggleAddPasswordVisibility"
  />
</template>

<script setup lang="ts">
  import { ref, watch, computed } from 'vue'
  import AddMemberModal from '@/components/team/AddMemberModal.vue'
  import TeamQRSection from '@/components/team/qr-section/TeamQRSection.vue'
  import TeamMemberSection from '@/components/team/member-section/TeamMemberSection.vue'
  import TeamDetailModal from '@/components/team/modal/TeamDetailModal.vue'
  import { useTeamModal } from '@/composables/team-management/useTeamModal'
  import { teamApi } from '@/api/team'
  import { useConfirmDialog } from '@/composables/useConfirmDialog'
  import { useToast } from '@/composables/useToast'
  import { useAuthStore } from '@/stores/auth'
  import { useQRCodeStore } from '@/stores/qrcode'
  import { useMemberOperations } from '@/composables/team-management'
  import type { Team, TeamMember, LiffQRCode } from '@/types'

  const props = defineProps<{
    team: Team
    loading?: boolean
  }>()

  const emit = defineEmits<{
    'toggle-status': [team: Team]
    'remove-team': [team: Team]
    'member-updated': []
    'team-updated': []
  }>()

  // Composables
  const { showConfirm } = useConfirmDialog()
  const { showSuccess, showError } = useToast()
  const authStore = useAuthStore()
  const qrCodeStore = useQRCodeStore()
  const teamModal = useTeamModal()

  // 當前用戶資訊
  const currentUser = computed(() => authStore.currentAgent)

  // 組件狀態
  const members = ref<TeamMember[]>([])
  const loadingMembers = ref(false)

  // 成員管理狀態 - 使用 useMemberOperations composable
  const memberOps = useMemberOperations()

  // LIFF QR Code 狀態
  const currentQRCode = ref<LiffQRCode | null>(null)
  const loadingQRCode = ref(false)
  const generatingQR = ref(false)
  const qrStats = ref<{ scanCount: number; assignmentCount: number } | null>(null)

  // 工具函數
  const getTeamInitial = (name: string): string => {
    return name.charAt(0).toUpperCase()
  }

  // Register lifecycle callbacks for modal
  teamModal.onModalOpen(async () => {
    // 如果還沒載入成員，則載入成員資料
    if (members.value.length === 0) {
      await loadTeamMembers()
    }

    // 🆕 修正：每次打開 modal 都重新載入 QR Code，確保與其他元件同步
    // 移除 if (!currentQRCode.value) 檢查，總是載入最新資料
    await loadTeamQRCode()
  })

  // Modal 控制功能
  const showTeamDetails = () => {
    teamModal.openModal()
  }

  // Handle team updated event
  const handleTeamUpdated = () => {
    emit('team-updated')
  }

  // 載入團隊成員 - 使用新的多團隊 API 以確保與 agent_teams 表同步
  const loadTeamMembers = async () => {
    loadingMembers.value = true
    try {
      // 使用新的多團隊 API: GET /teams/agent-teams/team/:teamId/members
      // 這個 API 從 agent_teams 表查詢，與 addMemberToTeam 使用的表一致
      const response = await teamApi.getTeamMembersWithTeams(props.team.id)
      if (response.success && response.data) {
        // 轉換數據格式：後端返回 displayName/isActive，前端需要 name/status
        members.value = response.data.map(
          member =>
            ({
              id: member.id,
              loginId: member.email || member.id,
              name: member.displayName, // 後端: displayName → 前端: name
              email: member.email,
              role: member.role as 'admin' | 'agent',
              status: member.isActive ? 'active' : 'inactive', // 後端: isActive(bool) → 前端: status(string)
              teams: member.teams,
              teamCount: member.teams?.length || 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }) as TeamMember
        )
      } else {
        console.error('載入團隊成員失敗:', response.error)
        members.value = []
      }
    } catch (error) {
      console.error('載入團隊成員失敗:', error)
      members.value = []
    } finally {
      loadingMembers.value = false
    }
  }

  // 顯示新增成員 Modal
  const openAddMemberModal = () => {
    memberOps.openAddMemberModal()
  }

  // 關閉新增成員 Modal
  const closeAddMemberModal = () => {
    memberOps.closeAddMemberModal()
  }

  // 提交新增成員
  const handleMemberAdded = async () => {
    // 調用 memberOps 的提交方法
    await memberOps.submitAddMember()

    // 成功後刷新成員列表
    await loadTeamMembers()

    // 通知父組件更新（用於更新團隊卡片上的成員數量）
    emit('member-updated')
  }

  // Handle member removed event from TeamMemberSection
  const handleMemberRemoved = () => {
    // Reload members after removal
    loadTeamMembers()
    // Notify parent component to update member count
    emit('member-updated')
  }

  // LIFF QR Code 相關方法
  // 🆕 使用 Pinia Store 統一管理 LIFF QR 碼狀態，與 TeamManagement 共享
  const loadTeamQRCode = async () => {
    loadingQRCode.value = true
    try {
      console.log(`🔍 [TeamCard] 從 Store 載入 LIFF QR Code: team ${props.team.id}`)
      // 使用 Store 的 loadQRCode 方法，統一快取管理
      const qrCode = await qrCodeStore.loadQRCode(props.team.id)
      currentQRCode.value = qrCode

      if (qrCode) {
        console.log(`✅ [TeamCard] LIFF QR Code 載入成功`)
        // 同時載入統計資料
        const stats = await qrCodeStore.getQRStats(props.team.id)
        if (stats) {
          qrStats.value = {
            scanCount: stats.scanCount,
            assignmentCount: stats.assignmentCount,
          }
        }
      } else {
        console.log(`📭 [TeamCard] 團隊尚未有 LIFF QR Code: team ${props.team.id}`)
      }
    } catch (error) {
      console.error('載入 LIFF QR Code 失敗:', error)
      currentQRCode.value = null
      qrStats.value = null
    } finally {
      loadingQRCode.value = false
    }
  }

  // 格式化當前時間
  const formatCurrentTime = (): string => {
    return new Date().toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  // 記錄活動日誌（前端記錄，實際活動由後端 API 自動記錄）
  const logQRCodeActivity = (action: 'generate' | 'regenerate', success: boolean) => {
    const user = currentUser.value
    const logEntry = {
      timestamp: new Date().toISOString(),
      action: action === 'regenerate' ? 'QR_CODE_REGENERATE' : 'QR_CODE_GENERATE',
      teamId: props.team.id,
      teamName: props.team.name,
      userId: user?.id || 'unknown',
      userName: user?.displayName || 'Unknown User',
      userRole: user?.role || 'unknown',
      success,
      previousQRCode: action === 'regenerate' ? currentQRCode.value?.id : null,
    }

    // 輸出到控制台供調試（實際活動由後端 API 自動記錄到資料庫）
    console.log('📝 [Activity Log] QR Code Operation:', logEntry)
  }

  // 🆕 使用 Pinia Store 統一管理 QR 碼狀態
  const handleGenerateQR = async () => {
    const isRegeneration = !!currentQRCode.value

    // 如果是重新生成，顯示確認對話框
    if (isRegeneration) {
      const user = currentUser.value
      const userName = user?.displayName || 'Unknown User'
      const userRole = user?.role === 'admin' ? '管理員' : '客服'
      const currentTime = formatCurrentTime()

      const confirmed = await showConfirm({
        title: '確認重新生成 QR Code',
        message: `此操作無法復原！重新生成將會：

  • 使舊的 QR Code 立即失效
  • 已印刷的宣傳品將無法使用
  • 重置掃描次數統計

操作人員：${userName}（${userRole}）
操作時間：${currentTime}
目標團隊：${props.team.name}`,
        type: 'danger',
        confirmText: '確認重新生成',
        cancelText: '取消',
      })

      if (!confirmed) {
        return
      }
    }

    try {
      generatingQR.value = true

      // 使用 Store 的 generateQRCode 方法
      // 該方法會先檢查現有 QR（如不是重新生成），無現有才生成新的
      console.log(
        `🔍 [TeamCard] 透過 Store ${isRegeneration ? '重新' : ''}生成 QR: team ${props.team.id}`
      )
      const qrCode = await qrCodeStore.generateQRCode(
        props.team.id,
        props.team.name,
        isRegeneration
      )

      if (qrCode) {
        // 記錄活動
        logQRCodeActivity(isRegeneration ? 'regenerate' : 'generate', true)

        // 更新本地狀態（與 Store 同步）
        currentQRCode.value = qrCode

        showSuccess(isRegeneration ? 'QR Code 已重新生成' : 'QR Code 生成成功')
      } else {
        logQRCodeActivity(isRegeneration ? 'regenerate' : 'generate', false)
        showError(qrCodeStore.error || '生成 QR Code 失敗')
      }
    } catch (error) {
      console.error('生成 QR Code 失敗:', error)
      logQRCodeActivity(isRegeneration ? 'regenerate' : 'generate', false)
      showError('生成 QR Code 時發生錯誤')
    } finally {
      generatingQR.value = false
    }
  }

  // 監聯 team 變化，重置 modal 狀態
  watch(
    () => props.team.id,
    () => {
      teamModal.closeModal()
      members.value = []
      memberOps.addMemberModal.value = false
      currentQRCode.value = null
    }
  )
</script>

<style scoped>
  /* ============================================
   Complex CSS (Cannot use Tailwind)
   ============================================ */

  /* Team Card - Main container with hover effect */
  .team-card {
    @apply flex justify-between items-center p-6 bg-gray-50;
    @apply border border-gray-200 rounded-2xl transition-all duration-300;
    @apply min-h-[120px] cursor-pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  .team-card:hover {
    @apply -translate-y-0.5 bg-gray-100 border-gray-300;
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);
  }

  /* Team Avatar - Gradient background */
  .team-avatar {
    @apply w-[60px] h-[60px] rounded-2xl flex items-center justify-center flex-shrink-0;
    background: linear-gradient(135deg, #667eea, #764ba2);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  }

  /* Status Badge - Backdrop filter effect */
  .status {
    @apply py-1.5 px-3 rounded-full text-xs font-semibold uppercase tracking-wider;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .status.active {
    @apply bg-green-100 text-green-800 border-green-200;
  }

  .status.inactive {
    @apply bg-red-50 text-red-800 border-red-200;
  }

  /* ============================================
   Responsive - RWD
   ============================================ */

  @media (max-width: 768px) {
    .team-card {
      @apply flex-col gap-4 items-stretch p-4;
    }
  }

  @media (max-width: 640px) {
    .team-avatar {
      @apply w-12 h-12;
    }
  }
</style>
