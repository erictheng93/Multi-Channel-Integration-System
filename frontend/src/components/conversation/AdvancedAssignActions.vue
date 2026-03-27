<template>
  <div class="advanced-assign-actions">
    <!-- 當前指派狀態 -->
    <div
      v-if="conversation.assignedTeamId"
      class="current-assignment"
    >
      <div class="assignment-info">
        <div class="assignee-avatar">
          <TeamIcon />
        </div>
        <div class="assignee-details">
          <div class="assignee-name">
            {{ getAssignedDisplayName() }}
          </div>
          <div class="assignee-role">
            團隊
          </div>
        </div>
      </div>
      <div class="assignment-status">
        <UserCheckIcon class="status-icon" />
        <span>已指派</span>
      </div>
    </div>

    <!-- 指派操作區域 -->
    <div class="assign-controls">
      <!-- 主要操作按鈕 -->
      <div class="primary-actions">
        <button
          v-if="canAssignToTeam"
          class="assign-btn primary"
          :disabled="isAssigning"
          @click="toggleTeamSelector"
        >
          <TeamIcon class="btn-icon" />
          {{ isAssigning ? '指派中...' : (conversation.status === 'assigned' ? '重新指派團隊' : '指派給團隊') }}
          <ChevronDownIcon
            :class="`dropdown-icon ${showTeamSelector ? 'rotated' : ''}`"
          />
        </button>

        <button
          v-if="canUnassign"
          class="assign-btn danger"
          :disabled="isAssigning"
          @click="handleUnassign"
        >
          <XCircleIcon class="btn-icon" />
          取消指派
        </button>
      </div>

      <!-- 遮罩層 - 使用 Teleport 移到 body 层级避免 transform 影响 -->
      <Teleport to="body">
        <div
          v-if="showTeamSelector"
          class="modal-backdrop"
          @click.self="closeTeamSelector"
        />
      </Teleport>

      <!-- 團隊選擇面板 - 使用 Teleport 移到 body 层级避免 transform 影响 -->
      <Teleport to="body">
        <div
          v-if="showTeamSelector"
          class="team-selector-panel"
          @click.stop
        >
          <div class="panel-header">
            <h4>選擇指派團隊</h4>
            <div class="panel-header-actions">
              <!--  手动刷新按钮 -->
              <button
                class="refresh-btn"
                :disabled="isLoadingTeams"
                :title="isLoadingTeams ? '載入中...' : '重新載入團隊列表'"
                @click="handleManualRefresh"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  :class="{ 'spinning': isLoadingTeams }"
                >
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                </svg>
              </button>
              <button
                class="close-panel-btn"
                @click="closeTeamSelector"
              >
                <XIcon />
              </button>
            </div>
          </div>

          <!-- 搜索框 -->
          <div class="search-section">
            <div class="search-input-wrapper">
              <SearchIcon class="search-icon" />
              <input
                v-model="teamSearchTerm"
                type="text"
                placeholder="搜索團隊..."
                class="search-input"
              >
            </div>
          </div>

          <!-- 團隊列表 -->
          <div class="teams-section">
            <!--  加载状态：显示骨架屏 -->
            <div
              v-if="isLoadingTeams"
              class="loading-state"
            >
              <TeamListSkeleton :count="3" />
              <p class="loading-text">
                載入團隊中...
              </p>
            </div>

            <!-- 空状态：确认无团队数据 -->
            <div
              v-else-if="teams.length === 0"
              class="no-teams"
            >
              <div class="no-teams-icon">
                <TeamIcon />
              </div>
              <p>沒有找到可用的團隊</p>
            </div>

            <!-- 团队列表 -->
            <div
              v-else
              class="teams-grid"
            >
              <div
                v-for="team in filteredTeams"
                :key="team.id"
                class="team-card"
                :class="{
                  'selected': selectedTeam === team.id,
                  'current': conversation.assignedTeamId === team.id
                }"
                @click.stop="selectTeam(team.id)"
              >
                <div class="team-icon">
                  <TeamIcon />
                </div>
                <div class="team-info">
                  <div class="team-name">
                    {{ team.name }}
                  </div>
                  <div class="team-details">
                    <span class="team-member-count">
                      {{ team.memberCount || 0 }} 位成員
                    </span>
                    <span
                      v-if="conversation.assignedTeamId === team.id"
                      class="current-tag"
                    >
                      目前指派
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 確認操作 -->
          <div
            v-if="selectedTeam"
            class="confirm-section"
          >
            <div class="confirm-info">
              <span>{{ selectedTeam === conversation.assignedTeamId ? '重新確認指派給團隊：' : '將對話指派給團隊：' }}</span>
              <strong>{{ selectedTeamName || '未知團隊' }}</strong>
            </div>
            <div class="confirm-actions">
              <button
                class="confirm-btn cancel"
                @click="cancelSelection"
              >
                取消
              </button>
              <button
                class="confirm-btn confirm"
                :disabled="isAssigning || !selectedTeam"
                @click="confirmAssignment"
              >
                {{ isAssigning ? '處理中...' : '確認指派' }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Conversation } from '@/types'
import { useTeamAssignment } from '@/composables/conversation/useTeamAssignment'
import {
  UserCheckIcon,
  TeamIcon,
  ChevronDownIcon,
  XCircleIcon,
  XIcon,
  SearchIcon
} from '@/components/icons'
import TeamListSkeleton from '@/components/ui/TeamListSkeleton.vue'

interface Props {
  conversation: Conversation
}

const props = defineProps<Props>()

const emit = defineEmits<{
  assigned: [conversation: Conversation, assignedTo: string]
  unassigned: [conversation: Conversation]
  error: [message: string]
}>()

const {
  isAssigning,
  showTeamSelector,
  teamSearchTerm,
  selectedTeam,
  isLoadingTeams,
  teams,
  canAssignToTeam,
  canUnassign,
  filteredTeams,
  selectedTeamName,
  getAssignedDisplayName,
  toggleTeamSelector,
  closeTeamSelector,
  selectTeam,
  cancelSelection,
  handleManualRefresh,
  confirmAssignment,
  handleUnassign
} = useTeamAssignment({
  conversation: () => props.conversation,
  onAssigned: (conv, assignedTo) => emit('assigned', conv, assignedTo),
  onUnassigned: (conv) => emit('unassigned', conv),
  onError: (msg) => emit('error', msg)
})
</script>

<style scoped>
/* ... 样式保持不变 ... */
.advanced-assign-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.current-assignment {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  background: var(--green-50);
  border: 1px solid var(--green-200);
  border-radius: var(--radius-lg);
}

.assignment-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.assignee-avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, var(--green-500), var(--green-600));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.875rem;
}

.assignee-avatar svg {
  width: 20px;
  height: 20px;
}

.assignee-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.assignee-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--gray-900);
}

.assignee-role {
  font-size: 0.875rem;
  color: var(--green-700);
}

.assignment-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--green-700);
  font-size: 0.875rem;
  font-weight: 500;
}

.status-icon {
  width: 18px;
  height: 18px;
}

.assign-controls {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.primary-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.assign-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border: 1px solid;
  border-radius: var(--radius-lg);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.assign-btn.primary {
  background: var(--primary-600);
  border-color: var(--primary-600);
  color: white;
}

.assign-btn.primary:hover:not(:disabled) {
  background: var(--primary-700);
  border-color: var(--primary-700);
}

.assign-btn.danger {
  background: white;
  border-color: var(--red-300);
  color: var(--red-600);
}

.assign-btn.danger:hover:not(:disabled) {
  background: var(--red-50);
  border-color: var(--red-400);
}

.assign-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-icon {
  width: 16px;
  height: 16px;
}

.dropdown-icon {
  width: 14px;
  height: 14px;
  margin-left: var(--space-1);
  transition: transform var(--transition-fast);
}

.dropdown-icon.rotated {
  transform: rotate(180deg);
}

.team-selector-panel {
  /* 固定定位 + 居中 */
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1000;

  /* 尺寸约束 */
  width: min(480px, 90vw);  /* 最大480px，小屏幕时90%宽度 */
  max-height: 85vh;  /* 最大85%视口高度 */

  /* 原有样式 */
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-2xl);
  animation: panel-appear 0.3s ease-out;

  /* 弹性布局 */
  display: flex;
  flex-direction: column;
}

@keyframes panel-appear {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  background: var(--gray-50);
  border-bottom: 1px solid var(--gray-200);
}

.panel-header h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--gray-900);
}

/* Header actions group */
.panel-header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* Refresh button styles */
.refresh-btn {
  padding: var(--space-1);
  border: none;
  background: none;
  color: var(--gray-500);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
}

.refresh-btn:hover:not(:disabled) {
  background: var(--gray-200);
  color: var(--primary-600);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Spinning animation for refresh icon */
.refresh-btn svg.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.close-panel-btn {
  padding: var(--space-1);
  border: none;
  background: none;
  color: var(--gray-500);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.close-panel-btn:hover {
  background: var(--gray-200);
  color: var(--gray-700);
}

.search-section {
  padding: var(--space-4);
  border-bottom: 1px solid var(--gray-100);
}

.search-input-wrapper {
  position: relative;
}

.search-icon {
  position: absolute;
  left: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  color: var(--gray-400);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: var(--space-3) var(--space-3) var(--space-3) var(--space-10);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  transition: border-color var(--transition-fast);
}

.search-input:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px var(--primary-100);
}

.teams-section {
  padding: var(--space-4);
  /* 弹性增长，占据剩余空间 */
  flex: 1;
  overflow-y: auto;
  /* 平滑滚动 */
  scroll-behavior: smooth;
  /* 自定义滚动条样式 */
  scrollbar-width: thin;
  scrollbar-color: var(--gray-300) var(--gray-100);
}

.teams-section::-webkit-scrollbar {
  width: 8px;
}

.teams-section::-webkit-scrollbar-track {
  background: var(--gray-100);
  border-radius: 4px;
}

.teams-section::-webkit-scrollbar-thumb {
  background: var(--gray-300);
  border-radius: 4px;
}

.teams-section::-webkit-scrollbar-thumb:hover {
  background: var(--gray-400);
}

/* 加载状态样式 */
.loading-state {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.loading-text {
  text-align: center;
  color: var(--gray-500);
  font-size: 0.875rem;
  margin-top: var(--space-2);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.no-teams {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-6);
  color: var(--gray-600);
  text-align: center;
}

.no-teams-icon {
  color: var(--gray-400);
  width: 48px;
  height: 48px;
}

.no-teams-icon svg {
  width: 48px;
  height: 48px;
}

.teams-grid {
  display: grid;
  gap: var(--space-2);
}

.team-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
  background: white;
}

.team-card:hover {
  background: var(--gray-50);
  border-color: var(--gray-300);
  box-shadow: var(--shadow-sm);
}

.team-card.selected {
  background: var(--primary-50);
  border-color: var(--primary-400);
  box-shadow: 0 0 0 3px var(--primary-100);
}

.team-card.current {
  background: var(--green-50);
  border-color: var(--green-200);
}

.team-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, var(--blue-500), var(--blue-600));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.team-icon svg {
  width: 24px;
  height: 24px;
}

.team-info {
  flex: 1;
  min-width: 0;
}

.team-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--gray-900);
  margin-bottom: 4px;
}

.team-details {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.team-member-count {
  font-size: 0.875rem;
  color: var(--gray-600);
}

.current-tag {
  padding: 2px var(--space-2);
  background: var(--green-100);
  color: var(--green-700);
  font-size: 0.625rem;
  font-weight: 500;
  border-radius: var(--radius-full);
}

.confirm-section {
  padding: var(--space-4);
  background: var(--gray-50);
  border-top: 1px solid var(--gray-200);
  /* 固定在底部，不滚动 */
  flex-shrink: 0;
}

.confirm-info {
  margin-bottom: var(--space-3);
  font-size: 0.875rem;
  color: var(--gray-700);
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

.confirm-btn {
  padding: var(--space-2) var(--space-4);
  border: 1px solid;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.confirm-btn.cancel {
  background: white;
  border-color: var(--gray-300);
  color: var(--gray-700);
}

.confirm-btn.cancel:hover {
  background: var(--gray-50);
  border-color: var(--gray-400);
}

.confirm-btn.confirm {
  background: var(--primary-600);
  border-color: var(--primary-600);
  color: white;
}

.confirm-btn.confirm:hover:not(:disabled) {
  background: var(--primary-700);
  border-color: var(--primary-700);
}

.confirm-btn.confirm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 遮罩層樣式 */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  animation: backdrop-appear 0.3s ease-out;
  backdrop-filter: blur(2px);
}

@keyframes backdrop-appear {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* 移動端適配 */
@media (max-width: 768px) {
  .primary-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .assign-btn {
    justify-content: center;
  }

  .confirm-actions {
    flex-direction: column;
  }

  /* 移动端面板优化 */
  .team-selector-panel {
    width: 95vw;
    max-height: 90vh;
  }

  .panel-header h4 {
    font-size: 0.875rem;
  }

  .teams-grid {
    gap: var(--space-3);
  }

  .team-card {
    padding: var(--space-3);
  }
}
</style>
