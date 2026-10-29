<template>
  <article
    v-bind="$attrs"
    class="ui-card team-card"
    :class="{ 'is-off': !team.isActive }"
    @click="showTeamDetails"
  >
    <div
      class="team-mark"
      :style="{ background: markBackground }"
    >
      {{ getTeamInitial(team.name) }}
    </div>

    <div class="team-main">
      <div class="team-name">
        {{ team.name }}
      </div>
      <div class="team-desc">
        {{ team.description || '尚未填寫描述' }}
      </div>
      <div class="team-meta">
        <span
          class="ui-pill"
          :class="team.isActive ? 'ui-pill-green ui-pill-dot' : ''"
        >{{ team.isActive ? '活躍' : '停用' }}</span>
        <span class="ui-pill">{{ team.memberCount || 0 }} 成員</span>
        <span
          v-if="previewMembers.length > 0"
          class="avs"
        >
          <TeamAvatar
            v-for="m in previewMembers"
            :key="m.id"
            size="sm"
            :name="m.name || m.loginId"
            :seed="m.id"
            :src="m.avatar"
          />
          <span
            v-if="overflowCount > 0"
            class="avs-more"
          >+{{ overflowCount }}</span>
        </span>
      </div>
    </div>

    <div
      class="team-acts"
      @click.stop
    >
      <button
        type="button"
        class="btn btn-secondary btn-sm"
        @click="showTeamDetails"
      >
        編輯團隊
      </button>
      <Dropdown
        placement="bottom-end"
        :disabled="loading"
      >
        <template #trigger>
          <span
            class="more-btn"
            :aria-label="`更多操作：${team.name}`"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              aria-hidden="true"
            ><circle
              cx="12"
              cy="5"
              r="1"
            /><circle
              cx="12"
              cy="12"
              r="1"
            /><circle
              cx="12"
              cy="19"
              r="1"
            /></svg>
          </span>
        </template>
        <DropdownItem
          :label="team.isActive ? '停用團隊' : '啟用團隊'"
          :disabled="loading"
          @click="$emit('toggle-status', team)"
        />
        <DropdownItem
          label="刪除團隊"
          variant="danger"
          :disabled="loading"
          @click="$emit('remove-team', team)"
        />
      </Dropdown>
    </div>
  </article>

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

  <!-- 選擇成員加入團隊 Modal -->
  <SelectMemberToTeamModal
    :visible="showSelectMemberModal"
    :team-id="team.id"
    :team-name="team.name"
    :current-member-ids="currentMemberIds"
    @close="closeSelectMemberModal"
    @members-added="handleMembersAdded"
  />
</template>

<script setup lang="ts">
import { createLogger } from '@/utils/logger'

// 禁用自動屬性繼承，手動綁定到主 div (解決 fragment 警告)
  defineOptions({
    inheritAttrs: false
  })
  const props = withDefaults(
    defineProps<{
      team: Team
      loading?: boolean
      /** Up to a few members of this team, for the avatar stack. */
      previewMembers?: TeamMember[]
    }>(),
    { loading: false, previewMembers: () => [] }
  )
  const emit = defineEmits<{
    'toggle-status': [team: Team]
    'remove-team': [team: Team]
    'member-updated': []
    'team-updated': []
  }>()
  const frontendLogger = createLogger('TeamCard')
  import { ref, watch, computed } from 'vue'
  import SelectMemberToTeamModal from '@/components/team/SelectMemberToTeamModal.vue'
  import TeamQRSection from '@/components/team/qr-section/TeamQRSection.vue'
  import TeamMemberSection from '@/components/team/member-section/TeamMemberSection.vue'
  import TeamDetailModal from '@/components/team/modal/TeamDetailModal.vue'
  import { useTeamModal } from '@/composables/team-management/useTeamModal'
  import { teamApi } from '@/api/team'
  import { useConfirmDialog } from '@/composables/useConfirmDialog'
  import { useToast } from '@/composables/useToast'
  import { useAuthStore } from '@/stores/auth'
  import { useTeamStore } from '@/stores/team'
  import { useQRCodeStore } from '@/stores/qrcode'
  import Dropdown from '@/components/ui/Dropdown.vue'
  import DropdownItem from '@/components/ui/DropdownItem.vue'
  import TeamAvatar from '@/components/team/TeamAvatar.vue'
  import { teamMarkBackground } from '@/utils/team-tone'
  import type { Team, TeamMember, LiffQRCode } from '@/types'

  // Composables
  const { showConfirm } = useConfirmDialog()
  const { showSuccess, showError } = useToast()
  const authStore = useAuthStore()
  const teamStore = useTeamStore()
  const qrCodeStore = useQRCodeStore()
  const teamModal = useTeamModal()

  // Members beyond the avatar stack
  const overflowCount = computed(() => Math.max(0, (props.team.memberCount || 0) - props.previewMembers.length))

  // 當前用戶資訊
  const currentUser = computed(() => authStore.currentAgent)

  // 組件狀態
  const members = ref<TeamMember[]>([])
  const loadingMembers = ref(false)

  // 選擇成員加入團隊 Modal 狀態
  const showSelectMemberModal = ref(false)

  // 計算當前團隊成員 ID 列表（用於過濾已在團隊中的成員）
  const currentMemberIds = computed(() => members.value.map(m => m.id))

  // LIFF QR Code 狀態
  const currentQRCode = ref<LiffQRCode | null>(null)
  const loadingQRCode = ref(false)
  const generatingQR = ref(false)
  const qrStats = ref<{ scanCount: number; assignmentCount: number } | null>(null)

  const markBackground = computed(() => teamMarkBackground(props.team.id))

  // 工具函數
  const getTeamInitial = (name: string): string => {
    return name.charAt(0).toUpperCase()
  }

  // Register lifecycle callbacks for modal
  teamModal.onModalOpen(async () => {
    // 每次打開 modal 都重新載入成員資料，確保 memberCount 與真實數據同步
    await loadTeamMembers()

    // 修正：每次打開 modal 都重新載入 QR Code，確保與其他元件同步
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
        // 即時同步 memberCount 到 store，確保 TeamCard 和 TeamDetailModal 顯示正確數量
        teamStore.updateTeamLocal(props.team.id, { memberCount: members.value.length })
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

  // 顯示選擇成員加入團隊 Modal
  const openAddMemberModal = () => {
    showSelectMemberModal.value = true
  }

  // 關閉選擇成員 Modal
  const closeSelectMemberModal = () => {
    showSelectMemberModal.value = false
  }

  // 成員添加成功後的處理
  const handleMembersAdded = async () => {
    // 關閉 Modal
    showSelectMemberModal.value = false

    // 刷新成員列表
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
  // 使用 Pinia Store 統一管理 LIFF QR 碼狀態，與 TeamManagement 共享
  const loadTeamQRCode = async () => {
    loadingQRCode.value = true
    try {
      frontendLogger.debug(`[TeamCard] 從 Store 載入 LIFF QR Code: team ${props.team.id}`)
      // 使用 Store 的 loadQRCode 方法，統一快取管理
      const qrCode = await qrCodeStore.loadQRCode(props.team.id)
      currentQRCode.value = qrCode

      if (qrCode) {
        frontendLogger.debug(`[TeamCard] LIFF QR Code 載入成功`)
        // 同時載入統計資料
        const stats = await qrCodeStore.getQRStats(props.team.id)
        if (stats) {
          qrStats.value = {
            scanCount: stats.scanCount,
            assignmentCount: stats.assignmentCount,
          }
        }
      } else {
        frontendLogger.debug(`[TeamCard] 團隊尚未有 LIFF QR Code: team ${props.team.id}`)
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
    frontendLogger.debug('[Activity Log] QR Code Operation:', logEntry)
  }

  // 使用 Pinia Store 統一管理 QR 碼狀態
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
      frontendLogger.debug(
        `[TeamCard] 透過 Store ${isRegeneration ? '重新' : ''}生成 QR: team ${props.team.id}`
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
      showSelectMemberModal.value = false
      currentQRCode.value = null
    }
  )
</script>

<style scoped>
.team-card {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 18px 20px;
  cursor: pointer;
}
.team-card.is-off .team-mark,
.team-card.is-off .team-name {
  opacity: 0.55;
}
.team-mark {
  display: grid;
  width: 52px;
  height: 52px;
  place-items: center;
  border-radius: 16px;
  font: 600 21px var(--ui-font-display);
  color: #fff;
}
.team-main {
  min-width: 0;
}
.team-name {
  overflow: hidden;
  font: 600 17px / 1.3 var(--ui-font-display);
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.team-desc {
  overflow: hidden;
  font-size: 13px;
  color: var(--ui-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.team-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}
.avs {
  display: flex;
  align-items: center;
  margin-left: 8px;
}
.avs > :deep(*) {
  margin-left: -6px;
  box-shadow: 0 0 0 2px var(--ui-surface);
}
.avs > :deep(*:first-child) {
  margin-left: 0;
}
.avs-more {
  display: grid;
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  place-items: center;
  border-radius: 14px;
  background: var(--ui-fill-strong);
  box-shadow: 0 0 0 2px var(--ui-surface);
  font-size: 12px;
  font-weight: 600;
  color: var(--ui-ink-2);
}
.team-acts {
  display: flex;
  align-items: center;
  gap: 6px;
}
.more-btn {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--ui-ink-2);
  cursor: pointer;
  transition: background var(--ui-dur) var(--ui-ease);
}
.more-btn:hover {
  background: var(--ui-fill);
}
.more-btn:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}
.more-btn svg {
  width: 18px;
  height: 18px;
}

@media (max-width: 768px) {
  .team-card {
    grid-template-columns: 44px minmax(0, 1fr);
  }
  .team-mark {
    width: 44px;
    height: 44px;
    border-radius: 14px;
    font-size: 18px;
  }
  .team-acts {
    grid-column: 1 / -1;
  }
  .team-acts .btn {
    flex: 1;
  }
}
</style>
