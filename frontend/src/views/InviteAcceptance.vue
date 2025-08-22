<template>
  <div class="invite-acceptance">
    <div class="container">
      <div class="invite-card">
        <!-- 載入狀態 -->
        <div
          v-if="loading"
          class="loading-state"
        >
          <div class="spinner" />
          <p>驗證邀請中...</p>
        </div>

        <!-- 邀請無效 -->
        <div
          v-else-if="!invitation.valid"
          class="invalid-state"
        >
          <div class="icon error-icon">
            ⚠️
          </div>
          <h2>邀請無效</h2>
          <p>此邀請連結已過期或無效。</p>
          <div class="actions">
            <router-link
              to="/login"
              class="btn btn-primary"
            >
              返回登入頁面
            </router-link>
          </div>
        </div>

        <!-- 有效邀請 -->
        <div
          v-else
          class="valid-invitation"
        >
          <!-- 邀請資訊 -->
          <div class="invitation-info">
            <div class="icon success-icon">
              ✉️
            </div>
            <h2>邀請加入團隊</h2>
            <div class="invitation-details">
              <p><strong>邀請郵箱:</strong> {{ invitation.invitation.email }}</p>
              <p><strong>角色:</strong> {{ getRoleText(invitation.invitation.role) }}</p>
              <p v-if="invitation.invitation.teamName">
                <strong>團隊:</strong> {{ invitation.invitation.teamName }}
              </p>
              <p v-if="invitation.invitation.inviterName">
                <strong>邀請人:</strong> {{ invitation.invitation.inviterName }}
              </p>
              <p><strong>到期時間:</strong> {{ formatDate(invitation.invitation.expiresAt) }}</p>
            </div>
          </div>

          <!-- 接受邀請表單 -->
          <form
            class="acceptance-form"
            @submit.prevent="acceptInvitation"
          >
            <h3>完成註冊</h3>
            
            <div class="form-group">
              <label for="name">姓名 *</label>
              <input 
                id="name"
                v-model="form.name"
                type="text"
                required
                placeholder="請輸入您的姓名"
                :disabled="submitting"
              >
            </div>

            <div class="form-group">
              <label for="password">密碼 *</label>
              <input 
                id="password"
                v-model="form.password"
                type="password"
                required
                placeholder="請設定您的密碼"
                :disabled="submitting"
                minlength="6"
              >
              <small class="form-hint">密碼至少需要 6 個字符</small>
            </div>

            <div class="form-group">
              <label for="confirmPassword">確認密碼 *</label>
              <input 
                id="confirmPassword"
                v-model="form.confirmPassword"
                type="password"
                required
                placeholder="請再次輸入密碼"
                :disabled="submitting"
              >
              <div
                v-if="passwordMismatch"
                class="error-message"
              >
                密碼不一致
              </div>
            </div>

            <div class="form-actions">
              <button 
                type="button" 
                class="btn btn-secondary"
                :disabled="submitting"
                @click="declineInvitation"
              >
                拒絕邀請
              </button>
              <button 
                type="submit" 
                class="btn btn-primary"
                :disabled="submitting || passwordMismatch || !isFormValid"
              >
                {{ submitting ? '處理中...' : '接受邀請' }}
              </button>
            </div>
          </form>
        </div>

        <!-- 成功狀態 -->
        <div
          v-if="success"
          class="success-state"
        >
          <div class="icon success-icon">
            ✅
          </div>
          <h2>歡迎加入團隊！</h2>
          <p>您已成功加入團隊，正在為您跳轉到系統...</p>
          <div class="actions">
            <router-link
              to="/dashboard"
              class="btn btn-primary"
            >
              進入系統
            </router-link>
          </div>
        </div>

        <!-- 錯誤狀態 -->
        <div
          v-if="error"
          class="error-state"
        >
          <div class="icon error-icon">
            ❌
          </div>
          <h2>處理失敗</h2>
          <p>{{ error }}</p>
          <div class="actions">
            <button
              class="btn btn-primary"
              @click="resetForm"
            >
              重試
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'
import { teamApi } from '@/api/team'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'

// 路由和認證
const route = useRoute()
const router = useRouter()
// const { } = useAuth() // Not using any auth methods here
const authStore = useAuthStore()
const { showSuccess } = useToast()
const { confirmWarning } = useConfirm()

// 響應式數據
const loading = ref(true)
const submitting = ref(false)
const success = ref(false)
const error = ref('')

const invitation = reactive({
  valid: false,
  invitation: {
    email: '',
    role: '',
    teamName: '',
    inviterName: '',
    expiresAt: ''
  }
})

const form = reactive({
  name: '',
  password: '',
  confirmPassword: ''
})

// 計算屬性
const passwordMismatch = computed(() => {
  return form.password && form.confirmPassword && form.password !== form.confirmPassword
})

const isFormValid = computed(() => {
  return form.name.trim() && 
         form.password.length >= 6 && 
         form.confirmPassword && 
         !passwordMismatch.value
})

// 獲取邀請令牌
const token = computed(() => route.params.token as string)

// 驗證邀請
const validateInvitation = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const response = await teamApi.validateInvitation(token.value)
    if (response.success) {
      Object.assign(invitation, response.data)
    } else {
      invitation.valid = false
    }
  } catch (err) {
    console.error('驗證邀請失敗:', err)
    invitation.valid = false
  } finally {
    loading.value = false
  }
}

// 接受邀請
const acceptInvitation = async () => {
  if (!isFormValid.value) {return}
  
  submitting.value = true
  error.value = ''
  
  try {
    const response = await teamApi.acceptInvitation(token.value, {
      name: form.name.trim(),
      password: form.password
    })
    
    if (response.success && response.data) {
      // 自動登入 - 直接設置認證狀態
      authStore.token = response.data.token
      authStore.refreshToken = response.data.refreshToken || null
      // 將 TeamMember 轉換為 Agent 類型
      const agent = response.data.agent
      authStore.currentAgent = {
        ...agent,
        email: agent.email || '', // 確保 email 不是 undefined
        name: agent.name || agent.loginId, // 確保 name 不是 undefined
        isOnline: true, // 新註冊的用戶默認為在線
        platforms: [], // 新用戶默認沒有分配平台
        isActive: true, // 新用戶默認為活躍
        createdAt: typeof agent.createdAt === 'string' ? new Date(agent.createdAt).getTime() : 
                   typeof agent.createdAt === 'number' ? agent.createdAt : agent.createdAt.getTime()
      }
      
      // 設置會話過期時間
      const expiry = Date.now() + (24 * 60 * 60 * 1000)
      authStore.sessionExpiry = expiry
      
      // 儲存到 localStorage
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('token', response.data.token)
        if (response.data.refreshToken) {
          localStorage.setItem('refreshToken', response.data.refreshToken)
        }
        localStorage.setItem('sessionExpiry', expiry.toString())
      }
      
      success.value = true
      
      // 3秒後跳轉到儀表板
      setTimeout(() => {
        router.push('/dashboard')
      }, 3000)
    }
  } catch (err: unknown) {
    console.error('接受邀請失敗:', err)
    error.value = (err instanceof Error ? err.message : String(err)) || '接受邀請失敗，請稍後重試'
  } finally {
    submitting.value = false
  }
}

// 拒絕邀請
const declineInvitation = async () => {
  const confirmed = await confirmWarning(
    '拒絕邀請',
    '確定要拒絕此邀請嗎？此操作無法復原。',
    '拒絕邀請'
  )
  if (!confirmed) {return}
  
  submitting.value = true
  
  try {
    const response = await teamApi.declineInvitation(token.value)
    if (response.success) {
      showSuccess('邀請已拒絕', '您已成功拒絕此邀請', { duration: 3000 })
      router.push('/login')
    }
  } catch (err) {
    console.error('拒絕邀請失敗:', err)
    error.value = '拒絕邀請失敗，請稍後重試'
  } finally {
    submitting.value = false
  }
}

// 重置表單
const resetForm = () => {
  error.value = ''
  success.value = false
  Object.assign(form, {
    name: '',
    password: '',
    confirmPassword: ''
  })
}

// 工具函數
const getRoleText = (role: string) => {
  return role === 'admin' ? '管理員' : '客服'
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleString('zh-TW')
}

// 生命週期
onMounted(() => {
  validateInvitation()
})
</script>

<style scoped>
.invite-acceptance {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.container {
  width: 100%;
  max-width: 500px;
}

.invite-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.loading-state,
.invalid-state,
.valid-invitation,
.success-state,
.error-state {
  padding: 40px;
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.icon {
  font-size: 48px;
  margin-bottom: 20px;
}

.invitation-info {
  margin-bottom: 30px;
  padding-bottom: 30px;
  border-bottom: 1px solid #eee;
}

.invitation-details {
  text-align: left;
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin-top: 20px;
}

.invitation-details p {
  margin: 8px 0;
  color: #666;
}

.acceptance-form {
  text-align: left;
}

.acceptance-form h3 {
  text-align: center;
  margin-bottom: 30px;
  color: #333;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

.form-group input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 16px;
  transition: border-color 0.3s;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-group input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.form-hint {
  display: block;
  margin-top: 5px;
  font-size: 14px;
  color: #666;
}

.error-message {
  color: #dc3545;
  font-size: 14px;
  margin-top: 5px;
}

.form-actions {
  display: flex;
  gap: 15px;
  margin-top: 30px;
}

.btn {
  flex: 1;
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #5a6fd8;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #5a6268;
}

.actions {
  margin-top: 30px;
}

.actions .btn {
  min-width: 150px;
}

@media (max-width: 768px) {
  .invite-acceptance {
    padding: 10px;
  }
  
  .loading-state,
  .invalid-state,
  .valid-invitation,
  .success-state,
  .error-state {
    padding: 30px 20px;
  }
  
  .form-actions {
    flex-direction: column;
  }
}
</style>