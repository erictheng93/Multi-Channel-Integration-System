<template>
  <div
    class="team-card"
    @click="showTeamDetails"
  >
    <!-- 主要卡片內容 -->
    <div class="team-info">
      <div class="team-avatar">
        <div class="avatar-placeholder">
          {{ getTeamInitial(team.name) }}
        </div>
      </div>
      <div class="team-details">
        <h3>{{ team.name }}</h3>
        <p class="description">
          {{ team.description || '無描述' }}
        </p>
        <div class="team-meta">
          <span :class="['status', team.isActive ? 'active' : 'inactive']">
            {{ team.isActive ? '活躍' : '停用' }}
          </span>
          <span class="member-count">{{ team.memberCount || 0 }} 成員</span>
        </div>
      </div>
    </div>
    
    <!-- 操作按鈕區 -->
    <div
      class="team-actions"
      @click.stop
    >
      <button 
        class="btn btn-sm btn-secondary" 
        :disabled="loading"
        @click="$emit('edit-team', team)"
      >
        編輯團隊
      </button>
      <button 
        :class="['btn', 'btn-sm', team.isActive ? 'btn-warning' : 'btn-success']" 
        :disabled="loading"
        @click="$emit('toggle-status', team)"
      >
        {{ team.isActive ? '停用' : '啟用' }}
      </button>
      <button 
        class="btn btn-sm btn-info" 
        :disabled="loading"
        @click="$emit('generate-qr', team)"
      >
        QR 碼
      </button>
      <button 
        class="btn btn-sm btn-danger" 
        :disabled="loading"
        @click="$emit('remove-team', team)"
      >
        刪除團隊
      </button>
    </div>
  </div>

  <!-- 團隊詳情 Modal -->
  <div 
    v-if="showModal" 
    class="modal-overlay"
    @click="closeModal"
  >
    <div 
      class="modal-content" 
      @click.stop
    >
      <!-- Modal Header -->
      <div class="modal-header">
        <h2>{{ team.name }} 詳細資訊</h2>
        <button 
          class="close-button" 
          @click="closeModal"
        >
          &times;
        </button>
      </div>

      <!-- Modal Body -->
      <div class="modal-body">
        <!-- 團隊統計資訊 -->
        <div class="team-stats">
          <h3>團隊資訊</h3>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-label">創建時間</span>
              <span class="stat-value">{{ formatDate(team.createdAt) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">最後更新</span>
              <span class="stat-value">{{ formatDate(team.updatedAt) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">團隊狀態</span>
              <span :class="['stat-value', 'status-badge', team.isActive ? 'active' : 'inactive']">
                {{ team.isActive ? '活躍中' : '已停用' }}
              </span>
            </div>
            <div class="stat-item">
              <span class="stat-label">成員數量</span>
              <span class="stat-value">{{ team.memberCount || 0 }} 位成員</span>
            </div>
          </div>
        </div>

        <!-- 成員列表 -->
        <div class="team-members-section">
          <h3>團隊成員</h3>
          
          <div 
            v-if="loadingMembers" 
            class="loading-members"
          >
            <HamsterLoader
              message="載入成員中..."
            />
          </div>
          
          <div 
            v-else-if="members.length === 0" 
            class="no-members"
          >
            <EmptyIcon />
            <span>此團隊暫無成員</span>
          </div>
          
          <div 
            v-else 
            class="members-grid"
          >
            <div 
              v-for="member in members" 
              :key="member.id"
              class="member-item"
            >
              <div class="member-avatar">
                {{ getInitials(member.name) }}
              </div>
              <div class="member-info">
                <span class="member-name">{{ member.name }}</span>
                <span class="member-role">{{ getRoleDisplayName(member.role) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="modal-footer">
        <button 
          class="btn btn-secondary" 
          @click="closeModal"
        >
          關閉
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'

interface Team {
  id: number;
  name: string;
  description?: string;
  qrCode?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
}

interface Member {
  id: string;
  name: string;
  role: string;
  email: string;
  isActive: boolean;
}

const props = defineProps<{
  team: Team;
  loading?: boolean;
}>();

defineEmits<{
  'edit-team': [team: Team];
  'toggle-status': [team: Team];
  'generate-qr': [team: Team];
  'remove-team': [team: Team];
}>();

// 組件狀態
const showModal = ref(false)
const members = ref<Member[]>([])
const loadingMembers = ref(false)

// 圖標組件
const EmptyIcon = {
  template: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"></circle>
    <path d="m9,9 6,6"></path>
    <path d="m15,9-6,6"></path>
  </svg>`
}

// 工具函數
const getTeamInitial = (name: string): string => {
  return name.charAt(0).toUpperCase();
};

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

const getRoleDisplayName = (role: string): string => {
  const roleMap: Record<string, string> = {
    admin: '管理員',
    team: '組長', 
    agent: '客服'
  }
  return roleMap[role] || role
}

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// Modal 控制功能
const showTeamDetails = async () => {
  showModal.value = true
  
  // 如果還沒載入成員，則載入成員資料
  if (members.value.length === 0) {
    await loadTeamMembers()
  }
}

const closeModal = () => {
  showModal.value = false
}

// 載入團隊成員
const loadTeamMembers = async () => {
  loadingMembers.value = true
  try {
    // TODO: 實際的 API 調用
    // const response = await teamApi.getTeamMembers(props.team.id)
    // members.value = response.data
    
    // 模擬 API 調用
    await new Promise(resolve => setTimeout(resolve, 1000))
    members.value = [
      { id: '1', name: 'DAC Agent', role: 'agent', email: 'dac@example.com', isActive: true },
      { id: '2', name: 'Test Agent', role: 'agent', email: 'test@example.com', isActive: true },
      { id: '3', name: 'Team Leader', role: 'team', email: 'leader@example.com', isActive: true },
    ]
  } catch (error) {
    console.error('載入團隊成員失敗:', error)
    members.value = []
  } finally {
    loadingMembers.value = false
  }
}

// 監聽 team 變化，重置 modal 狀態
watch(() => props.team.id, () => {
  showModal.value = false
  members.value = []
})
</script>

<style scoped>
.team-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  transition: all 0.3s ease;
  min-height: 120px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.team-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.team-info {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.team-avatar {
  width: 60px;
  height: 60px;
  border-radius: 16px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.avatar-placeholder {
  color: white;
  font-weight: 700;
  font-size: 1.375rem;
  text-transform: uppercase;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.team-details {
  flex: 1;
  min-width: 0;
}

.team-details h3 {
  margin: 0 0 6px 0;
  color: #1e293b;
  font-size: 1.375rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.description {
  margin: 0 0 12px 0;
  color: #64748b;
  font-size: 1rem;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.team-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.status {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.status.active {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.status.inactive {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.member-count {
  color: #64748b;
  font-size: 0.875rem;
  font-weight: 500;
  padding: 6px 12px;
  background: #e2e8f0;
  border-radius: 12px;
}

.team-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
  flex-wrap: wrap;
}

/* Modal 樣式 */
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
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-content {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  max-width: 700px;
  width: 90%;
  max-height: 85vh;
  overflow: hidden;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28px;
  border-bottom: 1px solid #e2e8f0;
  background: white;
}

.modal-header h2 {
  color: #1e293b;
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  border-radius: 8px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 1.5rem;
  font-weight: normal;
  line-height: 1;
}

.close-button:hover {
  background: #e2e8f0;
  border-color: #94a3b8;
  color: #475569;
  transform: translateY(-1px);
}

.modal-body {
  padding: 28px;
  max-height: 65vh;
  overflow-y: auto;
  background: #f8fafc;
}

.team-stats {
  margin-bottom: 28px;
}

.team-stats h3 {
  color: #1e293b;
  font-size: 1.375rem;
  font-weight: 700;
  margin: 0 0 20px 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 20px;
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.stat-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
}

.stat-label {
  color: #64748b;
  font-size: 1rem;
  font-weight: 500;
}

.stat-value {
  color: #1e293b;
  font-size: 1.125rem;
  font-weight: 700;
}

.status-badge {
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 600;
  display: inline-block;
  width: fit-content;
}

.status-badge.active {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.status-badge.inactive {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.team-members-section h3 {
  color: #1e293b;
  font-size: 1.375rem;
  font-weight: 700;
  margin: 0 0 20px 0;
}

.loading-members, .no-members {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #64748b;
  font-size: 1rem;
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.no-members {
  flex-direction: column;
  gap: 12px;
}

.members-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.member-item:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
}

.member-avatar {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 1rem;
  flex-shrink: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.member-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.member-name {
  color: #1e293b;
  font-size: 1.125rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.member-role {
  color: #64748b;
  font-size: 0.875rem;
  font-weight: 500;
}

.modal-footer {
  padding: 20px 28px;
  border-top: 1px solid #e2e8f0;
  background: white;
  display: flex;
  justify-content: flex-end;
}

.btn {
  padding: 16px 24px;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  border: 1px solid;
  cursor: pointer;
  transition: all 0.3s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 120px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sm {
  padding: 14px 20px;
  font-size: 1rem;
}

.btn-secondary {
  background: #f8fafc;
  color: #475569;
  border: 1px solid #cbd5e1;
}

.btn-secondary:hover:not(:disabled) {
  background: #e2e8f0;
  border-color: #94a3b8;
  transform: translateY(-1px);
}

.btn-warning {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fbbf24;
}

.btn-warning:hover:not(:disabled) {
  background: #fde68a;
  border-color: #f59e0b;
  transform: translateY(-1px);
}

.btn-success {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #16a34a;
}

.btn-success:hover:not(:disabled) {
  background: #bbf7d0;
  border-color: #15803d;
  transform: translateY(-1px);
}

.btn-info {
  background: #dbeafe;
  color: #1e40af;
  border: 1px solid #3b82f6;
}

.btn-info:hover:not(:disabled) {
  background: #bfdbfe;
  border-color: #2563eb;
  transform: translateY(-1px);
}

.btn-danger {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #ef4444;
}

.btn-danger:hover:not(:disabled) {
  background: #fecaca;
  border-color: #dc2626;
  transform: translateY(-1px);
}

@media (max-width: 768px) {
  .team-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    padding: 20px;
  }

  .team-info {
    width: 100%;
  }

  .team-actions {
    width: 100%;
    justify-content: flex-end;
    gap: 6px;
  }

  .btn {
    flex: 1;
    min-width: 0;
    font-size: 0.75rem;
    padding: 6px 12px;
  }

  .modal-content {
    width: 95%;
    max-height: 90vh;
  }

  .modal-header,
  .modal-body,
  .modal-footer {
    padding: 16px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .members-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .team-info {
    gap: 12px;
  }

  .team-avatar {
    width: 48px;
    height: 48px;
  }

  .avatar-placeholder {
    font-size: 1.125rem;
  }

  .team-meta {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .team-actions {
    flex-wrap: wrap;
  }

  .modal-header h2 {
    font-size: 1.125rem;
  }

  .modal-body {
    max-height: 70vh;
  }

  .team-stats h3,
  .team-members-section h3 {
    font-size: 1rem;
  }
}
</style>