<template>
  <AppLayout>
    <div class="team-management">
      <!-- Header Section -->
      <div class="page-header">
        <div class="header-content">
          <div class="header-info">
            <h1 class="page-title">
              團隊管理
            </h1>
            <p class="page-subtitle">
              管理系統人員與團隊設置，控制存取權限
            </p>
          </div>
          <div class="header-actions">
            <RefreshButton
              :loading="loading"
              @refresh="() => loadData(true)"
            />
          </div>
        </div>
      </div>

      <!-- Stats Overview -->
      <div class="stats-overview">
        <div class="stats-grid">
          <div class="stat-card members">
            <div class="stat-content">
              <div class="stat-number">
                {{ stats.totalMembers }}
              </div>
              <div class="stat-label">
                總成員數
              </div>
            </div>
            <div class="stat-icon">
              <UsersIcon />
            </div>
          </div>

          <div class="stat-card active">
            <div class="stat-content">
              <div class="stat-number">
                {{ stats.teamCount }}
              </div>
              <div class="stat-label">
                現存團隊數量
              </div>
            </div>
            <div class="stat-icon">
              <TeamsIcon />
            </div>
          </div>



          <div class="stat-card admins">
            <div class="stat-content">
              <div class="stat-number">
                {{ stats.adminCount }}
              </div>
              <div class="stat-label">
                管理員人數
              </div>
            </div>
            <div class="stat-icon">
              <ShieldIcon />
            </div>
          </div>
        </div>
      </div>

      <!-- Content Tabs -->
      <div class="content-section">
        <div class="content-header">
          <h2 class="content-title">
            <UsersIcon />
            人員管理 Staff Management ({{ teamMembers.length }})
          </h2>
          <div class="header-actions">
            <PrimaryActionButton
              text="新增成員"
              :icon="PlusIcon"
              :loading="loading"
              @click="showAddMemberModal = true"
            />
          </div>
        </div>

        <!-- Content -->
        <div class="content-body">
          <HamsterLoader
            v-if="loading"
            message="載入成員中..."
          />

          <EmptyState
            v-else-if="teamMembers.length === 0"
            title="尚無系統人員"
            description="新增第一位成員到您的團隊"
          >
            <template #icon>
              <UsersIcon />
            </template>
            <template #actions>
              <button
                class="btn btn-primary"
                @click="showAddMemberModal = true"
              >
                新增成員
              </button>
            </template>
          </EmptyState>

          <div
            v-else
            class="members-list"
          >
            <TeamMemberCard
              v-for="member in teamMembers"
              :key="member.id"
              :member="member"
              :current-user-id="currentAgent?.id"
              :loading="loading"
              @update-role="updateMemberRole"
              @toggle-status="toggleMemberStatus"
              @reset-password="resetMemberPassword"
              @remove-member="confirmRemoveMember"
            />
          </div>
        </div>
      </div>

      <!-- Teams Section -->
      <div class="content-section">
        <div class="content-header">
          <h2 class="content-title">
            <TeamsIcon />
            團隊設置 Team Settings ({{ teams.length }})
          </h2>
          <div class="header-actions">
            <PrimaryActionButton
              text="新增團隊"
              :icon="PlusIcon"
              :loading="loading"
              @click="showAddTeamModal = true"
            />
          </div>
        </div>

        <!-- Content -->
        <div class="content-body">
          <HamsterLoader
            v-if="loading"
            message="載入團隊中..."
          />

          <EmptyState
            v-else-if="teams.length === 0"
            title="尚無團隊"
            description="建立第一個團隊來管理客服人員"
          >
            <template #icon>
              <TeamsIcon />
            </template>
            <template #actions>
              <button
                class="btn btn-primary"
                @click="showAddTeamModal = true"
              >
                新增團隊
              </button>
            </template>
          </EmptyState>

          <div
            v-else
            class="teams-list"
          >
            <TeamCard
              v-for="team in teams"
              :key="team.id"
              :team="team"
              :loading="loading"
              @toggle-status="toggleTeamStatus"
              @view-qr="viewTeamQR"
              @prefetch-qr="prefetchTeamQR"
              @remove-team="confirmRemoveTeam"
              @member-updated="handleMemberUpdated"
              @team-updated="handleMemberUpdated"
            />
          </div>
        </div>
      </div>

      <!-- 新增成員模態框 -->
      <div
        v-if="showAddMemberModal"
        class="modal-overlay"
      >
        <div
          class="modal"
          @click.stop
        >
          <div class="modal-header">
            <h2>新增系統人員</h2>
            <button
              class="close-btn"
              @click="closeAddMemberModal"
            >
              &times;
            </button>
          </div>
          <form
            class="modal-body"
            @submit.prevent="submitAddMember"
          >
            <div class="form-group">
              <label for="email">電子郵件 *</label>
              <input
                id="email"
                v-model="addMemberForm.email"
                type="email"
                required
                placeholder="請輸入電子郵件地址"
              >
            </div>
            <div class="form-group">
              <label for="name">姓名</label>
              <input
                id="name"
                v-model="addMemberForm.name"
                type="text"
                placeholder="請輸入成員姓名（中英文）"
                pattern="[a-zA-Z\u4e00-\u9fa5\s]*"
                title="請輸入中文或英文字符"
              >
            </div>
            <div class="form-group">
              <label for="password">密碼 *</label>
              <div class="password-input-wrapper">
                <input
                  id="password"
                  v-model="addMemberForm.password"
                  :type="showAddPassword ? 'text' : 'password'"
                  required
                  placeholder="請輸入初始密碼"
                  minlength="6"
                >
                <button
                  type="button"
                  class="password-toggle-btn"
                  :title="showAddPassword ? '隱藏密碼' : '顯示密碼'"
                  @click="toggleAddPasswordVisibility"
                >
                  {{ showAddPassword ? '🙈' : '👁️' }}
                </button>
              </div>
            </div>
            <div class="form-group">
              <label for="role">角色 *</label>
              <select
                id="role"
                v-model="addMemberForm.role"
                required
              >
                <option value="agent">
                  客服
                </option>
                <option value="admin">
                  管理員
                </option>
              </select>
            </div>
            <div class="form-group">
              <label for="group">群組 (可選)</label>
              <select
                id="group"
                v-model="addMemberForm.group"
              >
                <option value="">
                  未指派群組
                </option>
                <option
                  v-for="team in teams"
                  :key="team.id"
                  :value="team.name"
                >
                  {{ team.name }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input
                  v-model="addMemberForm.isActive"
                  type="checkbox"
                >
                立即啟用帳戶
              </label>
            </div>
            <div class="modal-actions">
              <button
                type="button"
                class="btn btn-secondary"
                @click="closeAddMemberModal"
              >
                取消
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                :disabled="addMemberLoading"
              >
                {{ addMemberLoading ? '新增中...' : '新增成員' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- 重設密碼模態框 -->
      <div
        v-if="showPasswordResetModal"
        class="modal-overlay"
      >
        <div
          class="modal password-reset-modal"
          @click.stop
        >
          <button
            class="close-btn modal-close"
            @click="closePasswordResetModal"
          >
            &times;
          </button>
          <div class="modal-icon">
            <div class="icon-container">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
              >
                <rect
                  x="3"
                  y="11"
                  width="18"
                  height="10"
                  rx="2"
                  ry="2"
                  stroke="white"
                  stroke-width="2"
                  fill="none"
                />
                <circle
                  cx="12"
                  cy="16"
                  r="1"
                  fill="white"
                />
                <path
                  d="m7 11V7a5 5 0 0 1 10 0v4"
                  stroke="white"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
          </div>
          
          <form 
            class="modal-content" 
            @submit.prevent="submitPasswordReset"
          >
            <h3 class="modal-title">
              重設密碼
            </h3>
            <p class="modal-subtitle">
              為 {{ passwordResetMember?.name || passwordResetMember?.loginId }} 設定新密碼
            </p>
            
            <div class="form-group">
              <label for="newPassword">新密碼 *</label>
              <input
                id="newPassword"
                v-model="passwordResetForm.newPassword"
                type="password"
                required
                placeholder="請輸入新密碼"
                minlength="6"
                class="password-input"
              >
              <small class="form-hint">密碼至少需要 6 個字符</small>
            </div>

            <div class="form-group">
              <label for="confirmPassword">確認密碼 *</label>
              <input
                id="confirmPassword"
                v-model="passwordResetForm.confirmPassword"
                type="password"
                required
                placeholder="請再次輸入新密碼"
                class="password-input"
              >
              <div
                v-if="passwordMismatch"
                class="error-message"
              >
                密碼不一致
              </div>
            </div>
          </form>
          
          <div class="modal-actions">
            <button
              type="button"
              class="btn-modern btn-secondary"
              @click="closePasswordResetModal"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M18 6L6 18M6 6l12 12"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
              取消
            </button>
            <button
              type="button"
              class="btn-modern btn-primary"
              :disabled="!isPasswordFormValid || passwordResetLoading"
              @click="submitPasswordReset"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M20 6L9 17l-5-5"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              {{ passwordResetLoading ? '設定中...' : '設定密碼' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 新增團隊模態框 -->
      <div
        v-if="showAddTeamModal"
        class="modal-overlay"
      >
        <div
          class="modal"
          @click.stop
        >
          <div class="modal-header">
            <h2>新增團隊</h2>
            <button
              class="close-btn"
              @click="closeAddTeamModal"
            >
              &times;
            </button>
          </div>
          <form
            class="modal-body"
            @submit.prevent="submitAddTeam"
          >
            <div class="form-group">
              <label for="teamName">團隊名稱 *</label>
              <input
                id="teamName"
                v-model="addTeamForm.name"
                type="text"
                required
                placeholder="請輸入團隊名稱"
              >
            </div>
            <div class="form-group">
              <label for="teamDescription">團隊描述</label>
              <textarea
                id="teamDescription"
                v-model="addTeamForm.description"
                rows="3"
                placeholder="請輸入團隊描述（可選）"
              />
            </div>
            <div class="form-group">
              <label>團隊成員 (可選)</label>
              <div class="member-selection">
                <div class="member-selection-header">
                  <span class="selection-count">{{ addTeamForm.selectedMembers.length }} / {{ availableMembers.length }} 已選擇</span>
                  <button
                    type="button"
                    class="btn-link"
                    @click="toggleSelectAllMembers"
                  >
                    {{ isAllMembersSelected ? '取消全選' : '全選' }}
                  </button>
                </div>
                <div class="member-grid">
                  <div
                    v-for="member in availableMembers"
                    :key="member.id"
                    class="member-card"
                    :class="{ 'selected': addTeamForm.selectedMembers.includes(member.id) }"
                    @click="toggleMemberSelection(member.id)"
                  >
                    <div class="member-avatar">
                      <div class="avatar-circle">
                        {{ getInitials(member.name || member.loginId) }}
                      </div>
                      <div class="selection-indicator">
                        <CheckIcon />
                      </div>
                    </div>
                    
                    <div class="member-details">
                      <div class="member-name">
                        {{ member.name || member.loginId }}
                      </div>
                      <div
                        class="member-role-badge"
                        :class="`role-${member.role}`"
                      >
                        {{ getRoleDisplayName(member.role) }}
                      </div>
                      <!-- 多團隊支援：顯示已加入的團隊數量 -->
                      <div
                        v-if="member.teamCount && member.teamCount > 0"
                        class="member-teams-badge"
                      >
                        {{ member.teamCount }} 個團隊
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  v-if="availableMembers.length === 0"
                  class="no-members"
                >
                  無可用成員
                </div>
              </div>
            </div>
            <div class="modal-actions">
              <button
                type="button"
                class="btn btn-secondary"
                @click="closeAddTeamModal"
              >
                取消
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                :disabled="addTeamLoading"
              >
                {{ addTeamLoading ? '新增中...' : '新增團隊' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- 編輯團隊模態框 -->
      <div
        v-if="showEditTeamModal"
        class="modal-overlay"
      >
        <div
          class="modal modal-large"
          @click.stop
        >
          <div class="modal-header">
            <h2>編輯團隊</h2>
            <button
              class="close-btn"
              @click="closeEditTeamModal"
            >
              &times;
            </button>
          </div>
          <form
            class="modal-body"
            @submit.prevent="submitEditTeam"
          >
            <!-- 基本資訊 -->
            <div class="form-section">
              <h3 class="section-title">
                基本資訊
              </h3>
              <div class="form-group">
                <label for="editTeamName">團隊名稱 *</label>
                <input
                  id="editTeamName"
                  v-model="editTeamForm.name"
                  type="text"
                  required
                  placeholder="請輸入團隊名稱"
                >
              </div>
              <div class="form-group">
                <label for="editTeamDescription">團隊描述</label>
                <textarea
                  id="editTeamDescription"
                  v-model="editTeamForm.description"
                  rows="3"
                  placeholder="請輸入團隊描述（可選）"
                />
              </div>
              <div class="form-group">
                <label class="checkbox-label">
                  <input
                    v-model="editTeamForm.isActive"
                    type="checkbox"
                  >
                  啟用團隊
                </label>
              </div>
            </div>

            <!-- 成員管理 -->
            <div class="form-section">
              <h3 class="section-title">
                👥 團隊成員管理
                <span class="member-count-badge">{{ editTeamCurrentMembers.length }} 位成員</span>
              </h3>

              <!-- 當前成員列表 -->
              <div
                v-if="editTeamCurrentMembers.length > 0"
                class="current-members-section"
              >
                <label>當前成員</label>
                <div class="members-list-compact">
                  <div
                    v-for="member in editTeamCurrentMembers"
                    :key="member.id"
                    class="member-item-compact"
                  >
                    <div class="member-avatar-small">
                      {{ getInitials(member.name || member.loginId) }}
                    </div>
                    <div class="member-info-compact">
                      <span class="member-name">{{ member.name || member.loginId }}</span>
                      <span
                        class="member-role-badge-small"
                        :class="`role-${member.role}`"
                      >
                        {{ getRoleDisplayName(member.role) }}
                      </span>
                    </div>
                    <button
                      type="button"
                      class="btn-remove-member"
                      :disabled="editTeamLoading"
                      @click="removeMemberFromTeam(member.id)"
                    >
                      ✕ 移除
                    </button>
                  </div>
                </div>
              </div>
              <div
                v-else
                class="no-members-message"
              >
                此團隊目前沒有成員
              </div>

              <!-- 可新增成員列表 -->
              <div
                v-if="editTeamAvailableMembers.length > 0"
                class="available-members-section"
              >
                <label>可新增成員 ({{ editTeamAvailableMembers.length }} 位可用)</label>
                <div class="member-selection-header">
                  <span class="selection-count">已選擇: {{ editTeamForm.membersToAdd.length }} 位</span>
                  <button
                    type="button"
                    class="btn-link"
                    @click="toggleSelectAllAvailableMembers"
                  >
                    {{ isAllAvailableMembersSelected ? '取消全選' : '全選' }}
                  </button>
                </div>
                <div class="member-grid-compact">
                  <div
                    v-for="member in editTeamAvailableMembers"
                    :key="member.id"
                    class="member-card-compact"
                    :class="{ 'selected': editTeamForm.membersToAdd.includes(member.id) }"
                    @click="toggleAvailableMemberSelection(member.id)"
                  >
                    <div class="member-avatar-small">
                      {{ getInitials(member.name || member.loginId) }}
                    </div>
                    <div class="member-info-compact">
                      <div class="member-name">
                        {{ member.name || member.loginId }}
                      </div>
                      <div
                        class="member-role-badge-small"
                        :class="`role-${member.role}`"
                      >
                        {{ getRoleDisplayName(member.role) }}
                      </div>
                      <!-- 多團隊支援：顯示已加入的團隊數量 -->
                      <div
                        v-if="member.teamCount && member.teamCount > 0"
                        class="member-teams-badge-small"
                      >
                        {{ member.teamCount }} 團隊
                      </div>
                    </div>
                    <div class="selection-indicator-small">
                      <CheckIcon v-if="editTeamForm.membersToAdd.includes(member.id)" />
                    </div>
                  </div>
                </div>
              </div>
              <div
                v-else
                class="no-available-members-message"
              >
                沒有可新增的成員（所有成員都已在此團隊）
              </div>
            </div>

            <div class="modal-actions">
              <button
                type="button"
                class="btn btn-secondary"
                @click="closeEditTeamModal"
              >
                取消
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                :disabled="editTeamLoading"
              >
                {{ editTeamLoading ? '更新中...' : '更新團隊 + 成員' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- QR 碼顯示模態框 - Flex Bubble Card 設計 -->
      <div
        v-if="showQRModal"
        class="modal-overlay"
        @click="closeQRModal"
      >
        <!-- 載入中狀態 -->
        <div
          v-if="qrGenerating"
          class="flex-bubble"
          @click.stop
        >
          <div class="bubble-body">
            <div class="qr-skeleton">
              <div class="qr-skeleton-inner">
                <div class="qr-pulse" />
                <span class="qr-loading-text">載入中...</span>
              </div>
            </div>
            <h2 class="bubble-title">
              {{ currentTeam?.name || '載入中...' }}
            </h2>
            <p class="bubble-subtitle">
              正在載入 QR Code...
            </p>
          </div>
          <div class="bubble-footer">
            <button
              class="bubble-btn"
              @click="closeQRModal"
            >
              取消
            </button>
          </div>
        </div>

        <!-- 尚未生成 QR Code 警示狀態 -->
        <div
          v-else-if="!currentQRCode"
          class="flex-bubble flex-bubble-empty"
          @click.stop
        >
          <div class="bubble-body">
            <div class="empty-icon">
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#f59e0b"
                stroke-width="1.5"
              >
                <rect
                  x="3"
                  y="3"
                  width="7"
                  height="7"
                />
                <rect
                  x="14"
                  y="3"
                  width="7"
                  height="7"
                />
                <rect
                  x="3"
                  y="14"
                  width="7"
                  height="7"
                />
                <rect
                  x="14"
                  y="14"
                  width="3"
                  height="3"
                />
                <rect
                  x="18"
                  y="14"
                  width="3"
                  height="3"
                />
                <rect
                  x="14"
                  y="18"
                  width="3"
                  height="3"
                />
                <rect
                  x="18"
                  y="18"
                  width="3"
                  height="3"
                />
                <line
                  x1="2"
                  y1="2"
                  x2="22"
                  y2="22"
                  stroke="#ef4444"
                  stroke-width="2"
                />
              </svg>
            </div>
            <h2 class="bubble-title">
              尚未生成 QR Code
            </h2>
            <p class="bubble-subtitle bubble-subtitle-warning">
              此團隊尚未建立專屬 QR Code<br>
              請點擊團隊卡片進入詳情頁面生成
            </p>
          </div>
          <div class="bubble-footer">
            <button
              class="bubble-btn"
              @click="closeQRModal"
            >
              了解
            </button>
          </div>
        </div>

        <!-- QR 碼顯示狀態 - Flex Bubble Card -->
        <div
          v-else
          class="flex-bubble"
          @click.stop
        >
          <div class="bubble-body">
            <!-- QR Code Image -->
            <div class="qr-image-wrapper">
              <!-- 骨架屏（圖片載入中） -->
              <div
                v-if="qrImageLoading"
                class="qr-skeleton"
              >
                <div class="qr-skeleton-inner">
                  <div class="qr-pulse" />
                </div>
              </div>
              <!-- QR 碼圖片 -->
              <img
                v-show="!qrImageLoading"
                :src="currentQRCode"
                alt="LINE QR Code"
                class="qr-image qr-fade-in"
                @load="onQRImageLoad"
                @error="onQRImageError"
              >
            </div>
            <!-- Text Content -->
            <h2 class="bubble-title">
              {{ currentTeam?.name }}
            </h2>
            <p class="bubble-subtitle">
              掃描加入 LINE 官方帳號
            </p>
          </div>
          <div class="bubble-footer">
            <button
              class="bubble-btn"
              @click="downloadQRCode"
            >
              下載 QR Code
            </button>
          </div>
        </div>
      </div>

      <!-- 其他確認操作模態框 -->
      <div
        v-if="showConfirmModal"
        class="modal-overlay"
      >
        <div
          class="modal simple-confirm-modal"
          @click.stop
        >
          <div class="confirm-icon">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="#f59e0b"
                stroke-width="2"
                fill="#fef3c7"
              />
              <path
                d="M12 8v4"
                stroke="#f59e0b"
                stroke-width="2"
                stroke-linecap="round"
              />
              <path
                d="m12 16 .01 0"
                stroke="#f59e0b"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </div>
          <div class="confirm-content">
            <h3 class="confirm-title">
              確認操作
            </h3>
            <p class="confirm-message">
              {{ confirmMessage }}
            </p>
          </div>
          <div class="confirm-actions">
            <button
              class="btn-modern btn-cancel"
              @click="closeConfirmModal"
            >
              取消
            </button>
            <button
              class="btn-modern btn-confirm"
              @click="confirmAction"
            >
              確認
            </button>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '@/composables'
import { useTeamStore } from '@/stores/team'
import { useQRCodeStore } from '@/stores/qrcode'
import { useToast } from '@/composables/useToast'
import { teamApi } from '@/api/team'

// 🆕 Background QR Preload Service
import { qrPreloadService } from '@/services/qrPreloadService'
import { isFeatureEnabled, checkNetworkConditions, getFeatureConfig } from '@/config/features'
import type { QRPreloadConfig } from '@/config/features'

const route = useRoute()
import type { TeamMember } from '@/types'
import AppLayout from '@/components/ui/AppLayout.vue'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import TeamMemberCard from '@/components/team/TeamMemberCard.vue'
import TeamCard from '@/components/team/TeamCard.vue'
import RefreshButton from '@/components/ui/RefreshButton.vue'
import PrimaryActionButton from '@/components/ui/PrimaryActionButton.vue'
import PlusIcon from '@/components/icons/PlusIcon.vue'
import UsersIcon from '@/components/icons/UsersIcon.vue'
import ShieldIcon from '@/components/icons/ShieldIcon.vue'
import TeamsIcon from '@/components/icons/TeamsIcon.vue'
import CheckIcon from '@/components/icons/CheckIcon.vue'

// Icons are now imported from separate .vue files

// 組合式函數
const { currentAgent } = useAuth()
const { showSuccess, showError } = useToast()
// const { 
//   inviteMember, 
//   updateMemberStatus, 
//   deleteMember, 
//   revokeInvitation 
// } = useTeam()

// 響應式數據
const addMemberLoading = ref(false)
const showAddPassword = ref(false)

// Team interface
interface Team {
  id: number
  name: string
  description?: string
  qrCode?: string
  lineUrl?: string  // 🆕 Phase 3: LINE 連結 URL
  isActive: boolean
  createdAt: string
  updatedAt: string
  memberCount?: number
}

// 團隊管理相關狀態
const teams = ref<Team[]>([])
const addTeamLoading = ref(false)
const editTeamLoading = ref(false)
const showAddTeamModal = ref(false)
const showEditTeamModal = ref(false)
const showQRModal = ref(false)
const currentQRCode = ref('')
const currentTeam = ref<Team | null>(null)
const qrImageLoading = ref(true)  // 追蹤 QR 圖片載入狀態
const qrGenerating = ref(false)   // 追蹤 QR 碼生成狀態

// 🆕 使用集中式 QR Code Store (取代本地快取)
const qrCodeStore = useQRCodeStore()

// 從 store 獲取數據
const teamStore = useTeamStore()
// Access computed properties from the store with System Administrator pinned to top
const teamMembers = computed(() => {
  const members = teamStore.members
  const systemAdmin = members.find(member => 
    member.role === 'admin' && (
      member.name?.includes('系統管理員') || 
      member.name?.includes('System Administrator') ||
      member.name?.toLowerCase().includes('admin') ||
      member.loginId === 'admin' ||
      member.email?.includes('admin')
    )
  )
  const otherMembers = members.filter(member => 
    !(member.role === 'admin' && (
      member.name?.includes('系統管理員') || 
      member.name?.includes('System Administrator') ||
      member.name?.toLowerCase().includes('admin') ||
      member.loginId === 'admin' ||
      member.email?.includes('admin')
    ))
  )
  
  return systemAdmin ? [systemAdmin, ...otherMembers] : members
})
const loading = computed(() => teamStore.loading)
const stats = computed(() => teamStore.stats)

// 模態框狀態
const showAddMemberModal = ref(false)
const showConfirmModal = ref(false)
const showPasswordResetModal = ref(false)
const passwordResetLoading = ref(false)
const passwordResetMember = ref<TeamMember | null>(null)

// 表單數據
const addMemberForm = reactive({
  loginId: '',
  name: '',
  email: '',
  password: '',
  role: 'agent' as 'admin' | 'agent', // Simplified from 3-tier to 2-tier role system
  group: '',
  isActive: true
})

// 密碼重設表單
const passwordResetForm = reactive({
  newPassword: '',
  confirmPassword: ''
})

// 團隊表單數據
const addTeamForm = reactive({
  name: '',
  description: '',
  selectedMembers: [] as string[] // 所選的成員 ID 列表
})

const editTeamForm = reactive({
  id: 0,
  name: '',
  description: '',
  isActive: true,
  membersToAdd: [] as string[], // 待新增的成員 ID 列表
  membersToRemove: [] as string[] // 待移除的成員 ID 列表
})

// 編輯團隊時的成員數據
const editTeamCurrentMembers = ref<TeamMember[]>([]) // 當前團隊成員

// 確認操作
const confirmMessage = ref('')
const confirmCallback = ref<(() => void) | null>(null)

// 密碼驗證
const passwordMismatch = computed(() => {
  return passwordResetForm.newPassword && 
         passwordResetForm.confirmPassword && 
         passwordResetForm.newPassword !== passwordResetForm.confirmPassword
})

const isPasswordFormValid = computed(() => {
  return passwordResetForm.newPassword.length >= 6 &&
         passwordResetForm.confirmPassword &&
         !passwordMismatch.value
})

// 可用成員列表 (多團隊支援：不再限制已有團隊的成員)
const availableMembers = computed(() => {
  return teamMembers.value.filter(member =>
    // 只排除管理員，允許客服加入多個團隊
    member.role !== 'admin'
  )
})

// 是否全選所有成員
const isAllMembersSelected = computed(() => {
  return availableMembers.value.length > 0 &&
         addTeamForm.selectedMembers.length === availableMembers.value.length
})

// 編輯團隊時：可新增的成員列表（多團隊支援：只排除已在當前團隊的成員）
const editTeamAvailableMembers = computed(() => {
  const currentMemberIds = editTeamCurrentMembers.value.map(m => m.id)
  return teamMembers.value.filter(member =>
    member.role !== 'admin' && // 排除管理員
    !currentMemberIds.includes(member.id) // 不在當前團隊成員中（但可以在其他團隊）
  )
})

// 是否全選所有可用成員（編輯團隊時）
const isAllAvailableMembersSelected = computed(() => {
  return editTeamAvailableMembers.value.length > 0 &&
         editTeamForm.membersToAdd.length === editTeamAvailableMembers.value.length
})

// 切換全選狀態（新增團隊時）
const toggleSelectAllMembers = () => {
  if (isAllMembersSelected.value) {
    addTeamForm.selectedMembers = []
  } else {
    addTeamForm.selectedMembers = availableMembers.value.map(member => member.id)
  }
}

// 切換全選可用成員（編輯團隊時）
const toggleSelectAllAvailableMembers = () => {
  if (isAllAvailableMembersSelected.value) {
    editTeamForm.membersToAdd = []
  } else {
    editTeamForm.membersToAdd = editTeamAvailableMembers.value.map(member => member.id)
  }
}

// 切換可用成員選擇狀態（編輯團隊時）
const toggleAvailableMemberSelection = (memberId: string) => {
  const index = editTeamForm.membersToAdd.indexOf(memberId)
  if (index > -1) {
    editTeamForm.membersToAdd.splice(index, 1)
  } else {
    editTeamForm.membersToAdd.push(memberId)
  }
}

// 從團隊移除成員
const removeMemberFromTeam = (memberId: string) => {
  // 找到該成員
  const memberIndex = editTeamCurrentMembers.value.findIndex(m => m.id === memberId)
  if (memberIndex === -1) {return}

  // 樂觀更新：立即從當前成員列表移除
  editTeamCurrentMembers.value.splice(memberIndex, 1)

  // 記錄到待移除列表
  if (!editTeamForm.membersToRemove.includes(memberId)) {
    editTeamForm.membersToRemove.push(memberId)
  }

  // 如果該成員在待新增列表中，移除它
  const addIndex = editTeamForm.membersToAdd.indexOf(memberId)
  if (addIndex > -1) {
    editTeamForm.membersToAdd.splice(addIndex, 1)
  }
}

// 切換單個成員選擇狀態
const toggleMemberSelection = (memberId: string) => {
  const index = addTeamForm.selectedMembers.indexOf(memberId)
  if (index > -1) {
    addTeamForm.selectedMembers.splice(index, 1)
  } else {
    addTeamForm.selectedMembers.push(memberId)
  }
}

// 取得姓名首字母
const getInitials = (name: string): string => {
  if (!name) {
    return '?'
  }
  const names = name.split(' ').filter(n => n.trim())
  if (names.length === 0) {
    return '?'
  }
  if (names.length === 1) {
    const firstName = names[0]
    return firstName ? firstName.charAt(0).toUpperCase() : '?'
  }
  const firstName = names[0]
  const lastName = names[names.length - 1]
  return firstName && lastName ? (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() : '?'
}

// 取得角色顯示名稱
const getRoleDisplayName = (role: string): string => {
  const roleMap: Record<string, string> = {
    admin: '管理員',
    agent: '客服'
  }
  return roleMap[role] || role
}

// 載入數據 - 添加快取機制避免不必要的重載
const lastLoadTime = ref<number>(0)
const CACHE_DURATION = 30 * 1000 // 30秒快取

const loadData = async (force = false) => {
  const now = Date.now()
  // 如果非強制刷新且在快取時間內，跳過載入
  if (!force && now - lastLoadTime.value < CACHE_DURATION) {
    console.log('📋 Using cached data, skipping reload')
    return
  }
  
  lastLoadTime.value = now
  await Promise.all([
    teamStore.loadMembers(),
    loadTeams()
  ])
}

// 載入團隊數據
const loadTeams = async () => {
  try {
    console.log('🔄 開始載入團隊列表...')
    const response = await teamApi.getTeams(true) // Include inactive teams
    console.log('📥 API 響應:', response)
    console.log('✅ success:', response.success, '📦 data:', response.data, '📊 data length:', response.data?.length)

    if (response.success && response.data) {
      teams.value = response.data
      // 🔧 修復：同步更新 teamStore.teams 以確保統計數據正確計算
      // stats.teamCount 依賴 teamStore.teams，不同步會導致顯示 0
      teamStore.teams.splice(0, teamStore.teams.length, ...response.data)
      console.log('✔️ 團隊數據已更新:', teams.value.length, '個團隊')

      // 🆕 Phase 1: 啟動背景預載 QR Code
      startBackgroundQRPreload()
    } else {
      console.warn('⚠️ API 調用成功但沒有數據或失敗:', response)
    }
  } catch (error) {
    console.error('❌ 載入團隊失敗:', error)
    showError('載入團隊失敗', '請檢查網路連線或稍後重試')
  }
}

// 新增成員
const submitAddMember = async () => {
  addMemberLoading.value = true
  try {
    // 使用email作為loginId
    const memberData = {
      ...addMemberForm,
      loginId: addMemberForm.email
    }
    await teamStore.addMember(memberData)

    // 成功提示
    showSuccess('新增成員成功', '已成功新增系統人員')

    // 重置表單
    Object.assign(addMemberForm, {
      loginId: '',
      name: '',
      email: '',
      password: '',
      role: 'agent' as 'admin' | 'agent',
      group: '',
      isActive: true
    })

    closeAddMemberModal()
  } catch (error) {
    console.error('新增成員失敗:', error)
    // 顯示錯誤訊息給用戶
    const errorMessage = error instanceof Error ? error.message : '新增成員失敗，請稍後重試'
    showError('新增成員失敗', errorMessage)
  } finally {
    addMemberLoading.value = false
  }
}

// 關閉新增成員模態框
const closeAddMemberModal = () => {
  showAddMemberModal.value = false
  showAddPassword.value = false
  // 重置表單
  Object.assign(addMemberForm, {
    loginId: '',
    name: '',
    email: '',
    password: '',
    role: 'agent' as 'admin' | 'agent',
    group: '',
    isActive: true
  })
}

// 密碼顯示/隱藏切換
const toggleAddPasswordVisibility = () => {
  showAddPassword.value = !showAddPassword.value
}

// 更新成員角色
const updateMemberRole = async (memberId: string, role: string) => {
  try {
    await teamStore.updateMemberRole(memberId, role as 'admin' | 'agent') // Simplified from 3-tier to 2-tier
  } catch (error) {
    console.error('更新角色失敗:', error)
  }
}

// 切換成員狀態
const toggleMemberStatus = async (member: TeamMember) => {
  const newStatus = member.status === 'active' ? 'inactive' : 'active'
  try {
    await teamStore.updateMemberStatus(member.id, newStatus)
  } catch (error) {
    console.error('更新狀態失敗:', error)
  }
}

// 重設密碼
const resetMemberPassword = async (member: TeamMember) => {
  passwordResetMember.value = member
  // 重置表單
  Object.assign(passwordResetForm, {
    newPassword: '',
    confirmPassword: ''
  })
  showPasswordResetModal.value = true
}

// 提交密碼重設
const submitPasswordReset = async () => {
  if (!isPasswordFormValid.value || !passwordResetMember.value) {return}

  passwordResetLoading.value = true
  try {
    await teamStore.resetPasswordWithPolicy(passwordResetMember.value.id, {
      newPassword: passwordResetForm.newPassword,
      policy: 'changeable' // 默認使用 changeable 政策
    })

    // 顯示成功訊息
    showSuccess(
      '密碼設定成功',
      `成功為 ${passwordResetMember.value.name || passwordResetMember.value.loginId} 設定新密碼`,
      {
        duration: 5000, // 5秒顯示時間
        actionText: '確定'
      }
    )
    closePasswordResetModal()
  } catch (error) {
    console.error('設定密碼失敗:', error)
    showError('設定密碼失敗', '請檢查網路連線或稍後重試')
  } finally {
    passwordResetLoading.value = false
  }
}

// 關閉密碼重設模態框
const closePasswordResetModal = () => {
  showPasswordResetModal.value = false
  passwordResetMember.value = null
  Object.assign(passwordResetForm, {
    newPassword: '',
    confirmPassword: ''
  })
}

// 移除成員
const confirmRemoveMember = (member: TeamMember) => {
  confirmMessage.value = `確定要移除成員 ${member.name} 嗎？此操作無法撤銷。`
  confirmCallback.value = async () => {
    try {
      await teamStore.removeMember(member.id)
      showSuccess('移除成員成功', `已成功移除成員 ${member.name || member.loginId}`)
    } catch (error) {
      console.error('移除成員失敗:', error)
      const errorMessage = error instanceof Error ? error.message : '移除成員失敗，請稍後重試'
      showError('移除成員失敗', errorMessage)
    }
  }
  showConfirmModal.value = true
}

// 編輯成員 - 現在由TeamMemberCard組件直接處理
// 這個函數已經不再需要，因為TeamMemberCard使用teamStore統一處理

// 模態框控制

const closeConfirmModal = () => {
  showConfirmModal.value = false
  confirmCallback.value = null
}

const confirmAction = () => {
  if (confirmCallback.value) {
    confirmCallback.value()
  }
  closeConfirmModal()
}

// 團隊管理函數
// 新增團隊
const submitAddTeam = async () => {
  // ① 立即關閉模態框和顯示成功提示（樂觀更新）
  const teamName = addTeamForm.name
  const memberCount = addTeamForm.selectedMembers.length
  const selectedMemberIds = [...addTeamForm.selectedMembers]

  // 立即重置表單並關閉模態框
  Object.assign(addTeamForm, { name: '', description: '', selectedMembers: [] })
  closeAddTeamModal()
  showSuccess('新增團隊成功', `正在建立團隊並加入 ${memberCount} 位成員...`)

  // ② 背景執行實際操作（不使用 loading 狀態）
  try {
    // 建立團隊
    const response = await teamApi.createTeam({
      name: teamName,
      description: addTeamForm.description
    })

    if (response.success && response.data) {
      const newTeamId = response.data.id

      // ③ 樂觀更新：直接將新團隊添加到列表（避免 loadTeams）
      teams.value = [...teams.value, response.data]

      // 🆕 Phase 3: 團隊創建時已預生成 QR 碼，觸發 Store 預載
      // 這樣其他元件也能共享這個 QR 碼
      if (response.data.qrCode) {
        // 觸發 Store 載入，讓 Store 快取這個 QR
        await qrCodeStore.loadQRCode(newTeamId, true)
        console.log(`🚀 [Phase 3] QR 碼已存入 Store: team ${newTeamId}`)
      }

      // ④ 如果有選擇成員，將他們加入團隊
      if (selectedMemberIds.length > 0) {
        // 並行處理成員更新（提高效率）
        await Promise.all(
          selectedMemberIds.map(async (memberId) => {
            try {
              await teamStore.updateMember(memberId, { teamId: newTeamId })
              // ⑤ 樂觀更新：直接更新成員的 teamId（避免 loadMembers）
              const member = teamStore.members.find(m => m.id === memberId)
              if (member) {
                member.teamId = newTeamId
              }
            } catch (memberError) {
              console.error(`新增成員 ${memberId} 到團隊失敗:`, memberError)
            }
          })
        )
      }

      console.log('✅ 團隊創建完成，已優化更新本地數據')
    } else {
      // API 失敗，顯示錯誤但不影響 UI 流程
      showError('新增團隊失敗', '團隊創建失敗，請重試')
    }
  } catch (error) {
    console.error('新增團隊失敗:', error)
    showError('新增團隊失敗', error instanceof Error ? error.message : '請稍後重試')
  }
}

// 關閉新增團隊模態框
const closeAddTeamModal = () => {
  showAddTeamModal.value = false
  Object.assign(addTeamForm, { name: '', description: '', selectedMembers: [] })
}

// 編輯團隊 (預留功能，暫未啟用)
// @ts-ignore - Reserved for future use
const _editTeam = async (team: Team) => {
  // 重置表單數據
  Object.assign(editTeamForm, {
    id: team.id,
    name: team.name,
    description: team.description || '',
    isActive: team.isActive,
    membersToAdd: [],
    membersToRemove: []
  })

  // 載入當前團隊成員
  try {
    const response = await teamApi.getTeamMembersByTeam(team.id)
    if (response.success && response.data) {
      editTeamCurrentMembers.value = response.data
    } else {
      editTeamCurrentMembers.value = []
    }
  } catch (error) {
    console.error('載入團隊成員失敗:', error)
    editTeamCurrentMembers.value = []
  }

  showEditTeamModal.value = true
}

// 提交編輯團隊（樂觀更新 + 成員管理）
const submitEditTeam = async () => {
  editTeamLoading.value = true

  // 找到團隊在列表中的位置
  const teamIndex = teams.value.findIndex(t => t.id === editTeamForm.id)
  if (teamIndex === -1) {
    console.error('Team not found in list:', editTeamForm.id)
    editTeamLoading.value = false
    return
  }

  const team = teams.value[teamIndex]
  if (!team) {
    console.error('Team object is undefined:', editTeamForm.id)
    editTeamLoading.value = false
    return
  }

  // 1️⃣ 保存原始數據（用於失敗恢復）
  const originalName = team.name
  const originalDescription = team.description
  const originalIsActive = team.isActive
  const originalMemberCount = team.memberCount || 0
  const { id, membersToAdd, membersToRemove, ...updateData } = editTeamForm

  // 計算成員數量變化
  const memberCountChange = membersToAdd.length - membersToRemove.length
  const newMemberCount = originalMemberCount + memberCountChange

  // 2️⃣ 樂觀更新：立即更新 UI
  team.name = updateData.name
  team.description = updateData.description
  team.isActive = updateData.isActive
  team.memberCount = newMemberCount

  // 3️⃣ 立即關閉模態框和顯示成功消息
  const totalChanges = membersToAdd.length + membersToRemove.length
  const changeMessage = totalChanges > 0
    ? `正在更新團隊資訊並處理 ${totalChanges} 位成員變更...`
    : '已成功更新團隊資訊'

  closeEditTeamModal()
  editTeamLoading.value = false
  showSuccess('更新團隊成功', changeMessage)

  try {
    // 4️⃣ 背景調用 API - 更新團隊基本資訊
    const response = await teamApi.updateTeam(id, {
      name: updateData.name,
      description: updateData.description,
      isActive: updateData.isActive
    })

    if (!response.success) {
      // 5️⃣ API 返回失敗，恢復原數據
      team.name = originalName
      team.description = originalDescription
      team.isActive = originalIsActive
      team.memberCount = originalMemberCount
      showError('更新團隊失敗', response.error || '請稍後重試')
      return
    }

    // 6️⃣ 處理成員變更
    const memberUpdatePromises: Promise<TeamMember | { success: false; memberId: string }>[] = []

    // 移除成員：設置 teamId = undefined (移除團隊關聯)
    membersToRemove.forEach(memberId => {
      memberUpdatePromises.push(
        teamStore.updateMember(memberId, { teamId: undefined })
          .catch(error => {
            console.error(`移除成員 ${memberId} 失敗:`, error)
            return { success: false, memberId }
          })
      )
    })

    // 新增成員：設置 teamId = 當前團隊 ID
    membersToAdd.forEach(memberId => {
      memberUpdatePromises.push(
        teamStore.updateMember(memberId, { teamId: id })
          .catch(error => {
            console.error(`新增成員 ${memberId} 到團隊失敗:`, error)
            return { success: false, memberId }
          })
      )
    })

    // 等待所有成員更新完成
    if (memberUpdatePromises.length > 0) {
      await Promise.all(memberUpdatePromises)
      console.log('✅ 團隊成員更新完成')
    }

    // 成功的情況不需要做任何事，UI 已經更新了
  } catch (error) {
    console.error('更新團隊失敗:', error)
    // 5️⃣ 發生錯誤，恢復原數據
    team.name = originalName
    team.description = originalDescription
    team.isActive = originalIsActive
    team.memberCount = originalMemberCount
    showError('更新團隊失敗', error instanceof Error ? error.message : '請稍後重試')
  }
}

// 關閉編輯團隊模態框
const closeEditTeamModal = () => {
  showEditTeamModal.value = false
  // 重置表單數據
  Object.assign(editTeamForm, {
    id: 0,
    name: '',
    description: '',
    isActive: true,
    membersToAdd: [],
    membersToRemove: []
  })
  // 清空當前成員列表
  editTeamCurrentMembers.value = []
}

// 切換團隊狀態
const toggleTeamStatus = async (team: Team) => {
  // 找到團隊在列表中的位置
  const teamIndex = teams.value.findIndex(t => t.id === team.id)
  if (teamIndex === -1) {
    console.warn('Team not found in list:', team.id)
    return
  }

  const teamObj = teams.value[teamIndex]
  if (!teamObj) {
    console.error('Team object is undefined:', team.id)
    return
  }

  // 1️⃣ 保存原始狀態（用於失敗恢復）
  const originalStatus = teamObj.isActive
  const newStatus = !originalStatus

  // 2️⃣ 樂觀更新：立即更新 UI
  teamObj.isActive = newStatus

  try {
    // 3️⃣ 背景調用 API
    const response = await teamApi.updateTeam(team.id, { isActive: newStatus })
    if (response.success) {
      showSuccess('團隊狀態更新成功', `已${newStatus ? '啟用' : '停用'}團隊`)
      // 不需要 loadTeams()，已經樂觀更新了
    } else {
      // 4️⃣ API 返回失敗，恢復原狀態
      teamObj.isActive = originalStatus
      showError('更新團隊狀態失敗', response.error || '請稍後重試')
    }
  } catch (error) {
    console.error('更新團隊狀態失敗:', error)
    // 4️⃣ 發生錯誤，恢復原狀態
    teamObj.isActive = originalStatus
    showError('更新團隊狀態失敗', '請稍後重試')
  }
}

// 處理成員更新事件 - 重新載入團隊數據以更新成員計數
const handleMemberUpdated = async () => {
  console.log('🔄 團隊成員已更新，重新載入團隊數據...')
  try {
    await loadTeams()
    console.log('✅ 團隊數據重新載入完成')
  } catch (error) {
    console.error('❌ 重新載入團隊數據失敗:', error)
  }
}

// ==================== 🆕 Background QR Preload ====================

/**
 * 啟動背景預載 QR Code
 *
 * 策略：
 * - 檢查 Feature Flag 是否啟用
 * - 檢查網路條件是否符合
 * - 延遲啟動以確保頁面完全可互動 (TTI)
 * - 使用 qrPreloadService 智能載入
 */
const startBackgroundQRPreload = () => {
  // 檢查 Feature Flag
  if (!isFeatureEnabled('QR_BACKGROUND_PRELOAD')) {
    console.log('🚫 [TeamManagement] Background QR preload is disabled (Feature Flag)')
    return
  }

  // 檢查網路條件
  if (!checkNetworkConditions()) {
    console.log('🚫 [TeamManagement] Background QR preload is disabled (Network Conditions)')
    return
  }

  // 檢查是否有團隊
  if (teams.value.length === 0) {
    console.log('📭 [TeamManagement] No teams to preload')
    return
  }

  // 取得配置
  const config = getFeatureConfig<QRPreloadConfig>('QR_BACKGROUND_PRELOAD')

  // 延遲啟動，確保頁面可互動
  const idleTimeout = config?.idleTimeout || 2000
  setTimeout(() => {
    console.log(`🚀 [TeamManagement] Starting background QR preload for ${teams.value.length} teams`)
    qrPreloadService.start(teams.value)
  }, idleTimeout)
}

// 🆕 Phase 1 (Fallback): 懸停預載 QR 碼（保留作為雙重保險）
// 使用 Pinia Store 統一管理 QR 碼狀態
const prefetchTeamQR = async (team: Team) => {
  // 如果背景預載已啟用且快取有效，跳過
  if (isFeatureEnabled('QR_BACKGROUND_PRELOAD') && qrCodeStore.isCacheValid(team.id)) {
    console.log(`⚡ [TeamManagement] QR already preloaded for team ${team.id}, skipping hover prefetch`)
    return
  }

  // Fallback: Hover prefetch（適用於背景預載禁用或快取未命中的情況）
  await qrCodeStore.prefetchQRCode(team.id)
}

// 🔄 查看團隊 QR 碼（僅查看，不自動生成）
// 如果沒有 QR Code，顯示警示提示用戶到團隊詳情頁面生成
const viewTeamQR = async (team: Team) => {
  // 立即顯示 Modal
  currentTeam.value = team
  showQRModal.value = true

  // Step 1: 優先使用 Store 快取
  const cachedQR = qrCodeStore.getQRCode(team.id)
  if (cachedQR) {
    console.log(`⚡ [viewTeamQR] Store 快取命中: team ${team.id}`)
    currentQRCode.value = cachedQR.qrCode
    qrGenerating.value = false
    qrImageLoading.value = true  // 圖片仍需載入
    return
  }

  // 無快取，嘗試從 API 載入現有 QR Code（不生成新的）
  currentQRCode.value = ''
  qrGenerating.value = true
  qrImageLoading.value = true

  try {
    // 使用 Store 的 loadQRCode 方法，僅載入現有 QR Code
    const qrCode = await qrCodeStore.loadQRCode(team.id)

    if (qrCode) {
      console.log(`✅ [viewTeamQR] QR 碼載入成功: team ${team.id}`)
      currentQRCode.value = qrCode.qrCode
      qrGenerating.value = false
    } else {
      // 沒有現有 QR Code，顯示警示訊息
      console.log(`📭 [viewTeamQR] 團隊尚未有 QR Code: team ${team.id}`)
      currentQRCode.value = ''
      qrGenerating.value = false
      qrImageLoading.value = false
      // 不關閉 Modal，讓用戶看到「尚未生成」的提示
    }
  } catch (error) {
    console.error('載入 QR 碼失敗:', error)
    currentQRCode.value = ''
    qrGenerating.value = false
    qrImageLoading.value = false
    // 不關閉 Modal，顯示錯誤狀態
  }
}

// QR 碼圖片載入完成
const onQRImageLoad = () => {
  console.log('✅ QR 碼圖片載入完成')
  qrImageLoading.value = false
}

// QR 碼圖片載入失敗
const onQRImageError = () => {
  console.error('❌ QR 碼圖片載入失敗')
  qrImageLoading.value = false
  showError('圖片載入失敗', '請嘗試重新生成')
}

/**
 * 📥 下載 QR Code 圖片 - Flex Bubble Card 樣式 (Image 2 設計)
 *
 * 功能：生成完整的 LINE 官方帳號 QR Code 卡片
 * - 完全符合 QRcodeDesign.html 的視覺設計
 * - 包含：QR Code、團隊名稱、副標題、操作按鈕
 * - iOS/Apple 風格設計語言
 * - 3x 高清輸出，適合印刷
 *
 * 輸出格式：PNG (高質量無損壓縮)
 */
const downloadQRCode = async () => {
  if (!currentQRCode.value || !currentTeam.value) {return}

  const qrCodeDataUrl = currentQRCode.value
  const teamName = currentTeam.value.name

  try {
    // 🎨 設計參數 (3x 縮放以獲得印刷級高清輸出)
    const scale = 3
    const cardWidth = 260 * scale
    const borderRadius = 20 * scale

    // 📐 Padding 設定 (完全對應 QRcodeDesign.html)
    const bodyPaddingTop = 35 * scale
    const footerPaddingX = 20 * scale
    const footerPaddingBottom = 20 * scale

    // 🎯 QR Code 尺寸
    const qrSize = 140 * scale

    // ✍️ 文字設定
    const titleFontSize = 19 * scale
    const titleMarginTop = 24 * scale
    const subtitleFontSize = 13 * scale
    const subtitleMarginTop = 8 * scale

    // 🔘 按鈕設定
    const btnHeight = 40 * scale
    const btnRadius = 10 * scale
    const btnFontSize = 15 * scale
    const btnMarginTop = 25 * scale

    // 📏 計算總高度
    const titleHeight = titleFontSize * 1.3
    const subtitleHeight = subtitleFontSize * 1.3
    const cardHeight = bodyPaddingTop + qrSize + titleMarginTop + titleHeight +
                       subtitleMarginTop + subtitleHeight + btnMarginTop +
                       btnHeight + footerPaddingBottom

    // 🎨 建立高清 Canvas
    const canvas = document.createElement('canvas')
    canvas.width = cardWidth
    canvas.height = cardHeight
    const ctx = canvas.getContext('2d', { alpha: false })

    if (!ctx) {
      throw new Error('無法創建 Canvas 2D 上下文')
    }

    // 🔧 啟用高質量渲染
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    // 🎨 輔助函數：繪製完美圓角矩形
    const drawRoundedRect = (
      x: number, y: number, w: number, h: number, r: number
    ) => {
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + w - r, y)
      ctx.quadraticCurveTo(x + w, y, x + w, y + r)
      ctx.lineTo(x + w, y + h - r)
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
      ctx.lineTo(x + r, y + h)
      ctx.quadraticCurveTo(x, y + h, x, y + h - r)
      ctx.lineTo(x, y + r)
      ctx.quadraticCurveTo(x, y, x + r, y)
      ctx.closePath()
    }

    // 1️⃣ 繪製卡片背景 (純白 + iOS 風格圓角 + 柔和陰影)
    ctx.shadowColor = 'rgba(0, 0, 0, 0.08)'
    ctx.shadowBlur = 12 * scale
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 4 * scale

    ctx.fillStyle = '#FFFFFF'
    drawRoundedRect(0, 0, cardWidth, cardHeight, borderRadius)
    ctx.fill()

    // 關閉陰影
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0

    // 2️⃣ 載入並繪製 QR Code
    const qrImg = new window.Image()
    await new Promise<void>((resolve, reject) => {
      qrImg.onload = () => resolve()
      qrImg.onerror = () => reject(new Error('QR Code 圖片載入失敗'))
      qrImg.src = qrCodeDataUrl
    })

    // QR Code 水平置中
    const qrX = (cardWidth - qrSize) / 2
    const qrY = bodyPaddingTop
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)

    // 3️⃣ 繪製標題 (團隊名稱 - iOS 風格字體)
    ctx.fillStyle = '#000000'  // 純黑標題
    ctx.font = `600 ${titleFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft JhengHei", Roboto, Helvetica, Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    const titleY = qrY + qrSize + titleMarginTop
    ctx.fillText(teamName, cardWidth / 2, titleY)

    // 4️⃣ 繪製副標題 (iOS 灰色)
    ctx.fillStyle = '#8E8E93'  // Apple System Gray
    ctx.font = `400 ${subtitleFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft JhengHei", Roboto, Helvetica, Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    const subtitleY = titleY + titleHeight + subtitleMarginTop
    ctx.fillText('掃描加入 LINE 官方帳號', cardWidth / 2, subtitleY)

    // 5️⃣ 繪製按鈕 (iOS Secondary 風格)
    const btnWidth = cardWidth - (footerPaddingX * 2)
    const btnX = footerPaddingX
    const btnY = subtitleY + subtitleHeight + btnMarginTop

    // 按鈕背景
    ctx.fillStyle = '#F2F2F7'
    drawRoundedRect(btnX, btnY, btnWidth, btnHeight, btnRadius)
    ctx.fill()

    // 按鈕文字
    ctx.fillStyle = '#007AFF'
    ctx.font = `600 ${btnFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft JhengHei", Roboto, Helvetica, Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('掃描 QR Code 加入', cardWidth / 2, btnY + btnHeight / 2)

    // 6️⃣ 轉換為高質量 PNG 並下載
    // 生成專業檔名格式: {團隊名稱}_LINE_QR_{YYYYMMDD}.png
    const now = new Date()
    const year = now.getFullYear()
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const day = now.getDate().toString().padStart(2, '0')
    const dateStr = `${year}${month}${day}`

    const pngDataUrl = canvas.toDataURL('image/png', 1.0)
    const link = document.createElement('a')
    link.href = pngDataUrl
    link.download = `${teamName}_LINE_QR_${dateStr}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    showSuccess('下載成功', `✅ QR Code 卡片已下載 (${teamName})`)
  } catch (error) {
    console.error('❌ 下載 QR 碼失敗:', error)
    showError('下載失敗', '無法下載 QR 碼')
  }
}

// 關閉 QR 碼模態框
const closeQRModal = () => {
  showQRModal.value = false
  currentQRCode.value = ''
  currentTeam.value = null
  qrGenerating.value = false
  qrImageLoading.value = true
}

// 確認刪除團隊
const confirmRemoveTeam = (team: Team) => {
  confirmMessage.value = `確定要刪除團隊 ${team.name} 嗎？此操作無法撤銷。`
  confirmCallback.value = async () => {
    // 樂觀更新: 先從列表中移除團隊
    const teamIndex = teams.value.findIndex(t => t.id === team.id)

    if (teamIndex === -1) {
      console.warn('Team not found in list:', team.id)
      return
    }

    const removedTeam = teams.value[teamIndex]
    if (!removedTeam) {
      console.error('Failed to retrieve team from list')
      return
    }
    teams.value.splice(teamIndex, 1)

    try {
      const response = await teamApi.deleteTeam(team.id)
      if (response.success) {
        showSuccess('刪除團隊成功', '已成功刪除團隊')
        // 不需要重新載入所有團隊，已經樂觀更新了
      } else {
        // API 返回失敗，恢復團隊到列表
        teams.value.splice(teamIndex, 0, removedTeam)
        showError('刪除團隊失敗', response.error || '請稍後重試')
      }
    } catch (error) {
      console.error('刪除團隊失敗:', error)
      // 發生錯誤，恢復團隊到列表
      teams.value.splice(teamIndex, 0, removedTeam)
      showError('刪除團隊失敗', '請稍後重試')
    }
  }
  showConfirmModal.value = true
}

// 監聽路由變化，只在真正需要時刷新數據
watch(() => route.path, (newPath, oldPath) => {
  // 只在從其他頁面首次進入團隊管理頁面時才刷新資料
  if (newPath === '/team' && oldPath && oldPath !== '/team') {
    console.log('🔄 TeamManagement: Entering from external page, refreshing data')
    loadData()
  }
}, { immediate: false })

// 生命週期
onMounted(() => {
  console.log('🚀 TeamManagement mounted')
  loadData()
})

// 🆕 頁面卸載時停止背景預載
onUnmounted(() => {
  console.log('🛑 TeamManagement unmounted, stopping background QR preload')
  qrPreloadService.stop()
})
</script>
<style scoped>
.team-management {
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4);
}

/* Header Section */
.page-header {
  margin-bottom: var(--space-12);
  padding: var(--space-8) 0;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 100%;
}

.header-info {
  flex: 1;
}

.page-title {
  font-size: 2.5rem;
  font-weight: 800;
  color: var(--gray-900);
  margin-bottom: var(--space-2);
  letter-spacing: -0.025em;
}

.page-subtitle {
  font-size: 1rem;
  color: var(--gray-600);
  font-weight: 400;
  margin: 0;
}

.header-actions {
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
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-6);
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

.stat-card.members::before {
  background: linear-gradient(180deg, #3b82f6, #2563eb);
}

.stat-card.active::before {
  background: linear-gradient(180deg, #10b981, #059669);
}

.stat-card.admins::before {
  background: linear-gradient(180deg, #8b5cf6, #7c3aed);
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

/* Content Section */
.content-section {
  background: white;
  border-radius: var(--radius-2xl);
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
  border: 1px solid var(--gray-100);
  overflow: hidden;
}

.content-header {
  padding: var(--space-6) var(--space-8);
  border-bottom: 1px solid var(--gray-200);
  background: var(--gray-25);
}

.content-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
  color: var(--gray-900);
  font-size: 1.25rem;
  font-weight: 600;
}

.content-body {
  padding: var(--space-8);
}

/* Lists */
.members-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.teams-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-4);
}

.modal {
  background: white;
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

/* 大型模態框（用於編輯團隊 + 成員管理） */
.modal-large {
  max-width: 800px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-6);
  border-bottom: 1px solid var(--gray-200);
}

.modal-header h2 {
  margin: 0;
  color: var(--gray-900);
  font-size: 1.25rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--gray-500);
  cursor: pointer;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.close-btn:hover {
  color: var(--gray-700);
  background-color: var(--gray-100);
}

.modal-body {
  padding: var(--space-6);
}

.form-group {
  margin-bottom: var(--space-5);
}

.form-group label {
  display: block;
  margin-bottom: var(--space-2);
  color: var(--gray-700);
  font-size: 0.875rem;
  font-weight: 500;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  transition: all var(--transition-fast);
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px rgb(59 130 246 / 0.1);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  font-size: 0.875rem;
}

.checkbox-label input[type="checkbox"] {
  width: auto;
}

/* Password Input Styling */
.password-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input-wrapper input {
  padding-right: 3rem;
}

.password-toggle-btn {
  position: absolute;
  right: var(--space-3);
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  font-size: 1rem;
  line-height: 1;
  color: var(--gray-500);
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
}

.password-toggle-btn:hover {
  background-color: var(--gray-100);
  color: var(--gray-700);
}

.password-toggle-btn:focus {
  outline: none;
  background-color: var(--gray-100);
  box-shadow: 0 0 0 2px rgb(59 130 246 / 0.2);
}

.modal-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
  margin-top: var(--space-6);
}

.password-reset-modal {
  max-width: 520px;
  max-height: 90vh; /* 限制最大高度 */
  padding: 0;
  text-align: left;
  border: none;
  background: white;
  border-radius: var(--radius-3xl);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  position: relative;
  display: flex; /* 使用 Flexbox 佈局 */
  flex-direction: column; /* 垂直排列 */
}

.modal-close {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  z-index: 10;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-full);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  color: var(--gray-500);
  cursor: pointer;
  transition: all var(--transition-fast);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.modal-close:hover {
  background: white;
  color: var(--gray-700);
  border-color: var(--gray-300);
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.simple-confirm-modal {
  max-width: 420px;
  padding: var(--space-8);
  text-align: center;
  border: none;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.modal-icon {
  padding: var(--space-8) var(--space-8) var(--space-4);
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  flex-shrink: 0; /* 確保圖標區域不會被壓縮 */
}

.icon-container {
  width: 64px;
  height: 64px;
  margin: 0 auto;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 25px -8px rgba(99, 102, 241, 0.4);
}

.icon-container svg {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.icon-container svg path,
.icon-container svg rect,
.icon-container svg circle {
  stroke: white;
  fill: white;
}

.modal-content {
  padding: var(--space-4) var(--space-8) var(--space-6);
  flex: 1; /* 讓內容區塊填滿可用空間 */
  overflow-y: auto; /* 內容可滾動 */
  min-height: 0; /* 允許 flex item 縮小 */
}

.modal-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0 0 var(--space-3) 0;
  letter-spacing: -0.025em;
}

.modal-subtitle {
  font-size: 1rem;
  color: var(--gray-600);
  line-height: 1.6;
  margin: 0 0 var(--space-5) 0;
}

.warning-notice {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: #fef3c7;
  border: 1px solid #fbbf24;
  border-radius: var(--radius-lg);
  font-size: 0.875rem;
  color: #92400e;
  font-weight: 500;
}

.warning-notice svg {
  flex-shrink: 0;
}

.modal-actions {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-6) var(--space-8) var(--space-8);
  justify-content: center;
  flex-shrink: 0; /* 確保按鈕區域不會被壓縮 */
  border-top: 1px solid var(--gray-100); /* 添加分隔線 */
  background: white; /* 確保背景不透明 */
}

.btn-modern {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-lg);
  font-size: 0.875rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
  min-width: 120px;
  justify-content: center;
}

.btn-secondary {
  background: var(--gray-100);
  color: var(--gray-700);
  border: 1px solid var(--gray-200);
}

.btn-secondary:hover {
  background: var(--gray-200);
  border-color: var(--gray-300);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.btn-primary {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
}

/* Password Reset Form Styles */
.password-input {
  font-family: monospace;
  letter-spacing: 0.5px;
}

.form-hint {
  display: block;
  margin-top: var(--space-1);
  font-size: 0.75rem;
  color: var(--gray-500);
}

.error-message {
  display: block;
  margin-top: var(--space-1);
  font-size: 0.75rem;
  color: #ef4444;
  font-weight: 500;
}

.section-label {
  display: block;
  margin-bottom: var(--space-4);
  color: var(--gray-900);
  font-size: 0.875rem;
  font-weight: 600;
}

.password-policy-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.radio-option {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.radio-option:hover {
  border-color: var(--gray-300);
  background-color: var(--gray-25);
}

.radio-option input[type="radio"]:checked + .radio-text {
  color: var(--gray-900);
}

.radio-option:has(input[type="radio"]:checked) {
  border-color: #6366f1;
  background-color: #f0f9ff;
}

.radio-option input[type="radio"] {
  margin: 0;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 2px;
}

.radio-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  color: var(--gray-700);
}

.radio-text strong {
  font-weight: 600;
  color: var(--gray-900);
}

.radio-text small {
  font-size: 0.75rem;
  color: var(--gray-500);
  font-weight: 400;
}

/* Simple Confirm Modal Styles */
.confirm-icon {
  margin-bottom: var(--space-6);
  display: flex;
  justify-content: center;
}

.confirm-content {
  margin-bottom: var(--space-8);
}

.confirm-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0 0 var(--space-3) 0;
}

.confirm-message {
  font-size: 1rem;
  color: var(--gray-600);
  line-height: 1.6;
  margin: 0;
}

/* Member Selection Styles */
.member-selection {
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.member-selection-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: var(--gray-100);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-3);
}

.selection-count {
  font-size: 0.875rem;
  color: var(--gray-700);
  font-weight: 600;
}

.btn-link {
  background: var(--gray-900);
  border: none;
  color: white;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.btn-link:hover {
  background: black;
  color: white;
}

/* Modern Member Grid Design */
.member-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-4);
  max-height: 400px;
  overflow-y: auto;
  padding: var(--space-2);
}

.member-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: white;
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-normal);
  box-shadow: none;
}

.member-card:hover {
  border-color: var(--gray-500);
  background: var(--gray-50);
  transform: none;
  box-shadow: none;
}

.member-card.selected {
  border-color: var(--gray-900);
  background: var(--gray-50);
  box-shadow: 0 0 0 1px var(--gray-900);
}

.member-avatar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-circle {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-full);
  background: var(--gray-200);
  color: var(--gray-700);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1rem;
  letter-spacing: -0.025em;
}

.selection-indicator {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: scale(0);
  transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.member-card.selected .selection-indicator {
  opacity: 1;
  transform: scale(1);
}

.selection-indicator svg {
  width: 18px;
  height: 18px;
}

/* 極簡邊框增強 */
.member-card.selected .selection-indicator svg circle {
  stroke: var(--gray-100);
  stroke-width: 1;
}

.member-details {
  flex: 1;
  min-width: 0;
}

.member-name {
  font-weight: 700;
  color: black;
  font-size: 0.875rem;
  margin-bottom: var(--space-1);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-role-badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.member-role-badge.role-admin {
  background: black;
  color: white;
  border: 1px solid black;
}

.member-role-badge.role-team {
  background: var(--gray-700);
  color: white;
  border: 1px solid var(--gray-700);
}

.member-role-badge.role-agent {
  background: var(--gray-200);
  color: var(--gray-800);
  border: 1px solid var(--gray-400);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .member-grid {
    grid-template-columns: 1fr;
    gap: var(--space-3);
  }
  
  .member-card {
    padding: var(--space-3);
  }
  
  .avatar-circle {
    width: 40px;
    height: 40px;
    font-size: 0.875rem;
  }
}

.no-members {
  padding: var(--space-6) var(--space-4);
  text-align: center;
  color: var(--gray-500);
  font-size: 0.875rem;
}

.confirm-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: center;
}

.btn-cancel {
  background: var(--gray-100);
  color: var(--gray-700);
}

.btn-cancel:hover {
  background: var(--gray-200);
  transform: translateY(-1px);
}

.btn-confirm {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: white;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.btn-confirm:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4);
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* Responsive Design */
@media (max-width: 1024px) {
  .team-management {
    padding: var(--space-4) var(--space-3);
  }

  .header-content {
    flex-direction: column;
    text-align: center;
    gap: var(--space-6);
  }

  .page-title {
    font-size: 2rem;
  }

  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--space-4);
  }
}

@media (max-width: 768px) {
  .team-management {
    padding: var(--space-3) var(--space-2);
  }

  .page-title {
    font-size: 1.75rem;
  }

  .stat-card {
    padding: var(--space-6);
  }

  .stat-number {
    font-size: 2rem;
  }

  .content-header {
    padding: var(--space-4) var(--space-6);
  }

  .content-body {
    padding: var(--space-6);
  }

  .modal {
    margin: var(--space-2);
    max-width: none;
  }

  .modal-actions {
    flex-direction: column;
  }
}

@media (max-width: 640px) {
  .header-actions {
    flex-direction: column;
    width: 100%;
    gap: var(--space-3);
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .content-header {
    padding: var(--space-3) var(--space-4);
  }

  .content-title {
    font-size: 1.125rem;
  }

  .content-body {
    padding: var(--space-4);
  }

  .password-reset-modal {
    max-width: 350px;
    margin: var(--space-4);
    max-height: 85vh; /* 確保不會太高 */
    display: flex;
    flex-direction: column;
  }

  .simple-confirm-modal {
    max-width: 350px;
    margin: var(--space-4);
    padding: var(--space-6);
  }

  .modal-icon {
    padding: var(--space-6) var(--space-6) var(--space-3);
    flex-shrink: 0; /* 確保圖標區域不會被壓縮 */
  }

  .icon-container {
    width: 56px;
    height: 56px;
  }

  .modal-content {
    padding: var(--space-3) var(--space-6) var(--space-4);
    flex: 1; /* 讓內容區塊填滿可用空間 */
    overflow-y: auto; /* 內容可滾動 */
    min-height: 0; /* 允許 flex item 縮小 */
  }

  .modal-title {
    font-size: 1.25rem;
  }

  .modal-actions {
    flex-direction: column;
    padding: var(--space-4) var(--space-6) var(--space-6);
    flex-shrink: 0; /* 確保按鈕區域不會被壓縮 */
    border-top: 1px solid var(--gray-100); /* 添加分隔線 */
    background: white; /* 確保背景不透明 */
  }

  .btn-modern {
    min-width: 100%;
  }

  .password-policy-options {
    gap: var(--space-2);
  }

  .radio-option {
    padding: var(--space-2) var(--space-3);
  }

  .radio-text strong {
    font-size: 0.875rem;
  }

  .radio-text small {
    font-size: 0.7rem;
  }
}

/* ============================================
   Flex Bubble Card - QR Modal (Image 2 設計)
   ============================================ */
.flex-bubble {
  background-color: #FFFFFF;
  width: 280px;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  text-align: center;
  margin: 0 auto;
}

.bubble-body {
  padding: 35px 30px 20px 30px;
}

.bubble-footer {
  padding: 0 20px 20px 20px;
}

/* QR Code Image Wrapper */
.qr-image-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  width: 140px;
  height: 140px;
  margin: 0 auto;
}

.qr-image {
  width: 140px;
  height: 140px;
  display: block;
  object-fit: contain;
}

/* Typography - iOS/Apple Style */
.bubble-title {
  color: #000000;
  font-size: 19px;
  font-weight: 600;
  margin-top: 24px;
  margin-bottom: 0;
  letter-spacing: -0.5px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft JhengHei", Roboto, Helvetica, Arial, sans-serif;
}

.bubble-subtitle {
  color: #8E8E93;
  font-size: 13px;
  margin-top: 8px;
  margin-bottom: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft JhengHei", Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.5;
}

.bubble-subtitle-warning {
  color: #f59e0b;
}

/* Footer Button - iOS Secondary Style */
.bubble-btn {
  display: block;
  width: 100%;
  text-decoration: none;
  line-height: 40px;
  font-size: 15px;
  font-weight: 600;
  border-radius: 10px;
  background-color: #F2F2F7;
  color: #007AFF;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s ease;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft JhengHei", Roboto, Helvetica, Arial, sans-serif;
}

.bubble-btn:hover {
  background-color: #E5E5EA;
}

.bubble-btn:active {
  background-color: #D1D1D6;
}

/* QR 碼淡入動畫 */
.qr-fade-in {
  animation: qrFadeIn 0.3s ease-out forwards;
}

@keyframes qrFadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* QR 碼骨架屏樣式 */
.qr-skeleton {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 140px;
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  border-radius: 12px;
}

.qr-skeleton-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.qr-pulse {
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 10px;
  animation: qrPulse 1.5s ease-in-out infinite;
  position: relative;
}

.qr-pulse::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 24px;
  height: 24px;
  background: white;
  border-radius: 4px;
  transform: translate(-50%, -50%);
}

.qr-pulse::after {
  content: '';
  position: absolute;
  top: 6px;
  left: 6px;
  right: 6px;
  bottom: 6px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
}

@keyframes qrPulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(0.95);
  }
}

.qr-loading-text {
  color: #667eea;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
}

/* Empty State - Flex Bubble 樣式 */
.flex-bubble-empty .bubble-body {
  padding: 40px 30px;
}

.flex-bubble-empty .empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  margin: 0 auto 20px;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border-radius: 16px;
}

/* Team section header actions */
.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
}

.content-header .header-actions {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}

/* 成員管理樣式 */
.form-section {
  margin-bottom: var(--space-6);
  padding-bottom: var(--space-6);
  border-bottom: 1px solid var(--gray-200);
}

.form-section:last-of-type {
  border-bottom: none;
  padding-bottom: 0;
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0 0 var(--space-4) 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.member-count-badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-3);
  background: var(--gray-100);
  border-radius: var(--radius-full);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--gray-700);
}

.current-members-section,
.available-members-section {
  margin-bottom: var(--space-4);
}

.no-members-message,
.no-available-members-message {
  padding: var(--space-4);
  text-align: center;
  color: var(--gray-500);
  font-size: 0.875rem;
  background: var(--gray-50);
  border-radius: var(--radius-md);
  border: 1px dashed var(--gray-300);
}

/* 當前成員列表樣式 */
.members-list-compact {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-height: 300px;
  overflow-y: auto;
  padding: var(--space-2);
  background: var(--gray-50);
  border-radius: var(--radius-md);
}

.member-item-compact {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.member-item-compact:hover {
  border-color: var(--gray-300);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.member-avatar-small {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.875rem;
  flex-shrink: 0;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.member-info-compact {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.member-info-compact .member-name {
  font-weight: 600;
  color: var(--gray-900);
  font-size: 0.875rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-role-badge-small {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  flex-shrink: 0;
}

.member-role-badge-small.role-admin {
  background: var(--gray-900);
  color: white;
}

.member-role-badge-small.role-agent {
  background: var(--gray-200);
  color: var(--gray-800);
  border: 1px solid var(--gray-300);
}

/* 多團隊支援：成員已加入團隊數量標籤 */
.member-teams-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  margin-top: 4px;
  background: #dbeafe;
  color: #1e40af;
  border-radius: var(--radius-sm);
  font-size: 0.7rem;
  font-weight: 500;
}

.member-teams-badge-small {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  margin-left: 4px;
  background: #dbeafe;
  color: #1e40af;
  border-radius: var(--radius-sm);
  font-size: 0.65rem;
  font-weight: 500;
}

.btn-remove-member {
  padding: var(--space-2) var(--space-3);
  background: var(--gray-100);
  color: var(--gray-700);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.btn-remove-member:hover:not(:disabled) {
  background: #fee2e2;
  color: #991b1b;
  border-color: #fecaca;
  transform: translateY(-1px);
}

.btn-remove-member:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 可新增成員網格樣式 */
.member-grid-compact {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-3);
  max-height: 300px;
  overflow-y: auto;
  padding: var(--space-2);
  background: var(--gray-50);
  border-radius: var(--radius-md);
}

.member-card-compact {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  background: white;
  border: 2px solid var(--gray-200);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
}

.member-card-compact:hover {
  border-color: var(--gray-400);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.member-card-compact.selected {
  border-color: var(--gray-900);
  background: var(--gray-50);
  box-shadow: 0 0 0 1px var(--gray-900);
}

.member-card-compact .member-info-compact {
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
}

.member-card-compact .member-info-compact .member-name {
  font-size: 0.875rem;
  max-width: 120px;
}

.selection-indicator-small {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: scale(0);
  transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.member-card-compact.selected .selection-indicator-small {
  opacity: 1;
  transform: scale(1);
}

.selection-indicator-small svg {
  width: 16px;
  height: 16px;
}

/* Reduced Motion Preference */
@media (prefers-reduced-motion: reduce) {
  .stat-card,
  .content-section,
  .btn,
  .btn-modern,
  .btn-primary,
  .btn-confirm,
  .btn-cancel,
  .modal,
  .team-card,
  .member-card {
    transition: none !important;
    transform: none !important;
  }

  .animate-spin {
    animation: none !important;
  }

  .slide-in-from-right {
    animation: none !important;
  }

  @keyframes spin {
    0%, 100% {
      transform: rotate(0deg);
    }
  }
}
</style>