<template>
  <div class="qr-code-manager">
    <!-- QR Code 生成表單 -->
    <div class="qr-form-section">
      <h3 class="section-title">
        <QRIcon />
        生成新的 QR 碼
      </h3>
      <form @submit.prevent="generateQRCode">
        <div class="form-grid">
          <div class="form-group">
            <label for="campaignName">活動名稱</label>
            <input
              id="campaignName"
              v-model="qrForm.campaignName"
              type="text"
              placeholder="例如：2025 新年優惠"
              required
            >
          </div>
          
          <div class="form-group">
            <label for="description">描述</label>
            <textarea
              id="description"
              v-model="qrForm.description"
              rows="2"
              placeholder="QR 碼用途說明（可選）"
            />
          </div>
          
          <div class="form-group">
            <label for="expiresAt">有效期限</label>
            <input
              id="expiresAt"
              v-model="qrForm.expiresAt"
              type="datetime-local"
              :min="minDate"
            >
          </div>
          
          <div class="form-group">
            <label for="maxUses">最大使用次數</label>
            <input
              id="maxUses"
              v-model="qrForm.maxUses"
              type="number"
              min="0"
              placeholder="0 表示無限制"
            >
          </div>
        </div>
        
        <div class="form-actions">
          <button 
            type="submit" 
            class="btn btn-primary"
            :disabled="generating"
          >
            <GenerateIcon v-if="!generating" />
            <LoadingIcon
              v-else
              class="animate-spin"
            />
            {{ generating ? '生成中...' : '生成 QR 碼' }}
          </button>
        </div>
      </form>
    </div>

    <!-- 當前 QR Code 顯示 -->
    <div
      v-if="currentQRCode"
      class="current-qr-section"
    >
      <h3 class="section-title">
        當前 QR 碼
      </h3>
      <div class="qr-display-card">
        <div class="qr-image-container">
          <img 
            :src="currentQRCode.qrCode" 
            alt="QR Code"
            class="qr-image"
          >
          <div class="qr-overlay">
            <button 
              class="btn-icon"
              title="下載 QR 碼"
              @click="downloadQRCode"
            >
              <DownloadIcon />
            </button>
            <button 
              class="btn-icon"
              title="複製連結"
              @click="copyLink"
            >
              <CopyIcon />
            </button>
          </div>
        </div>
        
        <div class="qr-info">
          <div class="info-item">
            <span class="info-label">活動名稱</span>
            <span class="info-value">{{ currentQRCode.campaignName || '未命名' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">使用次數</span>
            <span class="info-value">
              {{ currentQRCode.usageCount }}
              <span v-if="currentQRCode.maxUses"> / {{ currentQRCode.maxUses }}</span>
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">有效期限</span>
            <span class="info-value">
              {{ formatDate(currentQRCode.expiresAt) }}
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">狀態</span>
            <span 
              class="status-badge"
              :class="getStatusClass(currentQRCode)"
            >
              {{ getStatusText(currentQRCode) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- QR Code 歷史列表 -->
    <div
      v-if="qrCodeHistory.length > 0"
      class="history-section"
    >
      <h3 class="section-title">
        <HistoryIcon />
        歷史 QR 碼 ({{ qrCodeHistory.length }})
      </h3>
      <div class="history-list">
        <div 
          v-for="qrCode in qrCodeHistory"
          :key="qrCode.id"
          class="history-card"
          :class="{ 'inactive': !qrCode.isActive }"
        >
          <img 
            :src="qrCode.qrCode"
            alt="QR Code"
            class="history-qr-image"
          >
          <div class="history-info">
            <h4>{{ qrCode.campaignName || '未命名活動' }}</h4>
            <div class="history-stats">
              <span>使用: {{ qrCode.usageCount }}</span>
              <span>建立: {{ formatDate(qrCode.createdAt) }}</span>
            </div>
          </div>
          <div class="history-actions">
            <button
              v-if="qrCode.isActive"
              class="btn-sm btn-warning"
              @click="deactivateQRCode(qrCode.id)"
            >
              停用
            </button>
            <button
              class="btn-sm btn-secondary"
              @click="viewQRCode(qrCode)"
            >
              查看
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 統計資訊 -->
    <div class="stats-section">
      <h3 class="section-title">
        <StatsIcon />
        QR 碼統計
      </h3>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">
            {{ stats.totalScans }}
          </div>
          <div class="stat-label">
            總掃描次數
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-value">
            {{ stats.newCustomers }}
          </div>
          <div class="stat-label">
            新客戶數
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-value">
            {{ stats.conversionRate }}%
          </div>
          <div class="stat-label">
            轉換率
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-value">
            {{ stats.activeQRCodes }}
          </div>
          <div class="stat-label">
            有效 QR 碼
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useToast } from '@/composables/useToast'
import { teamApi } from '@/api/team'
import type { PropType } from 'vue'
import type { QRCode } from '@/types'

// Props
const props = defineProps({
  teamId: {
    type: Number as PropType<number>,
    required: true
  },
  teamName: {
    type: String,
    default: ''
  }
})

// Icons
const QRIcon = {
  template: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="3" width="7" height="7"/>
    <rect x="14" y="3" width="7" height="7"/>
    <rect x="3" y="14" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/>
  </svg>`
}

const GenerateIcon = {
  template: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M12 2v6m0 4v6m0 4v-2"/>
    <path d="M2 12h6m4 0h6m4 0h-2"/>
  </svg>`
}

const LoadingIcon = {
  template: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M21 12a9 9 0 11-6.219-8.56"/>
  </svg>`
}

const DownloadIcon = {
  template: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>`
}

const CopyIcon = {
  template: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
  </svg>`
}

const HistoryIcon = {
  template: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
    <path d="M12 7v5l4 2"/>
  </svg>`
}

const StatsIcon = {
  template: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>`
}

// Composables
const { showSuccess, showError } = useToast()

// State
const generating = ref(false)
const currentQRCode = ref<QRCode | null>(null)
const qrCodeHistory = ref<QRCode[]>([])
const stats = reactive({
  totalScans: 0,
  newCustomers: 0,
  conversionRate: 0,
  activeQRCodes: 0
})

// QR Form
const qrForm = reactive({
  campaignName: '',
  description: '',
  expiresAt: '',
  maxUses: null as number | null
})

// Computed
const minDate = computed(() => {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
})

// Methods
const generateQRCode = async () => {
  generating.value = true
  try {
    const response = await teamApi.generateTeamQR(props.teamId, {
      campaignName: qrForm.campaignName,
      description: qrForm.description,
      expiresAt: qrForm.expiresAt || undefined,
      maxUses: qrForm.maxUses || undefined
    })
    
    if (response.success && response.data) {
      currentQRCode.value = {
        ...response.data,
        campaignName: response.data.campaignName || '',
        isActive: true,
        createdAt: new Date()
      }
      showSuccess('QR 碼生成成功', `已為 ${props.teamName} 生成新的 QR 碼`)
      
      // 重置表單
      Object.assign(qrForm, {
        campaignName: '',
        description: '',
        expiresAt: '',
        maxUses: null
      })
      
      // 重新載入歷史
      await loadQRCodeHistory()
    }
  } catch (error) {
    console.error('Generate QR code error:', error)
    showError('生成失敗', '無法生成 QR 碼，請稍後重試')
  } finally {
    generating.value = false
  }
}

const loadQRCodeHistory = async () => {
  try {
    const response = await teamApi.getTeamQRCodes(props.teamId)
    if (response.success && response.data) {
      qrCodeHistory.value = response.data
      
      // 更新統計
      stats.activeQRCodes = response.data.filter((qr: QRCode) => qr.isActive).length
      
      // 設定當前 QR Code（最新的活躍 QR Code）
      const activeQRCodes = response.data.filter((qr: QRCode) => qr.isActive)
      if (activeQRCodes.length > 0 && !currentQRCode.value) {
        currentQRCode.value = activeQRCodes[0] || null
      }
    }
  } catch (error) {
    console.error('Load QR codes error:', error)
  }
}

const loadStats = async () => {
  try {
    const response = await teamApi.getTeamQRStats(props.teamId)
    if (response.success && response.data) {
      Object.assign(stats, response.data)
    }
  } catch (error) {
    console.error('Load stats error:', error)
  }
}

const downloadQRCode = () => {
  if (!currentQRCode.value) {return}
  
  const link = document.createElement('a')
  link.href = currentQRCode.value.qrCode
  link.download = `qr-code-${currentQRCode.value.campaignName || 'team'}-${Date.now()}.png`
  link.click()
}

const copyLink = async () => {
  if (!currentQRCode.value) {return}
  
  try {
    await navigator.clipboard.writeText(currentQRCode.value.lineUrl)
    showSuccess('已複製', 'LINE 連結已複製到剪貼簿')
  } catch {
    showError('複製失敗', '無法複製連結')
  }
}

const deactivateQRCode = async (qrCodeId: string) => {
  try {
    const response = await teamApi.deactivateQRCode(props.teamId, qrCodeId)
    if (response.success) {
      showSuccess('已停用', 'QR 碼已停用')
      await loadQRCodeHistory()
    }
  } catch {
    showError('停用失敗', '無法停用 QR 碼')
  }
}

const viewQRCode = (qrCode: QRCode) => {
  currentQRCode.value = qrCode
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const formatDate = (date: string | Date | undefined) => {
  if (!date) {return '無期限'}
  const d = new Date(date)
  if (isNaN(d.getTime())) {return '無效日期'}
  return d.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getStatusClass = (qrCode: QRCode) => {
  if (!qrCode.isActive) {return 'inactive'}
  if (qrCode.expiresAt && new Date(qrCode.expiresAt) < new Date()) {return 'expired'}
  if (qrCode.maxUses && qrCode.usageCount >= qrCode.maxUses) {return 'limit-reached'}
  return 'active'
}

const getStatusText = (qrCode: QRCode) => {
  if (!qrCode.isActive) {return '已停用'}
  if (qrCode.expiresAt && new Date(qrCode.expiresAt) < new Date()) {return '已過期'}
  if (qrCode.maxUses && qrCode.usageCount >= qrCode.maxUses) {return '達到上限'}
  return '有效'
}

// Lifecycle
onMounted(() => {
  loadQRCodeHistory()
  loadStats()
})
</script>

<style scoped>
.qr-code-manager {
  max-width: 1200px;
  margin: 0 auto;
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--gray-900);
  margin-bottom: var(--space-6);
}

/* Form Section */
.qr-form-section {
  background: white;
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
  margin-bottom: var(--space-8);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--gray-700);
}

.form-group input,
.form-group textarea {
  padding: var(--space-3);
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  transition: all var(--transition-fast);
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px rgb(59 130 246 / 0.1);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}

/* Current QR Section */
.current-qr-section {
  background: white;
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
  margin-bottom: var(--space-8);
}

.qr-display-card {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-6);
  align-items: center;
}

.qr-image-container {
  position: relative;
  width: 200px;
  height: 200px;
}

.qr-image {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-lg);
  border: 2px solid var(--gray-200);
}

.qr-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.qr-image-container:hover .qr-overlay {
  opacity: 1;
}

.btn-icon {
  background: white;
  border: none;
  border-radius: var(--radius-full);
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-icon:hover {
  transform: scale(1.1);
  background: var(--gray-100);
}

.qr-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--space-4);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.info-label {
  font-size: 0.75rem;
  color: var(--gray-500);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.info-value {
  font-size: 1rem;
  font-weight: 500;
  color: var(--gray-900);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  width: fit-content;
}

.status-badge.active {
  background: var(--success-100);
  color: var(--success-700);
}

.status-badge.inactive {
  background: var(--gray-100);
  color: var(--gray-600);
}

.status-badge.expired {
  background: var(--warning-100);
  color: var(--warning-700);
}

.status-badge.limit-reached {
  background: var(--error-100);
  color: var(--error-700);
}

/* History Section */
.history-section {
  background: white;
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
  margin-bottom: var(--space-8);
}

.history-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-4);
}

.history-card {
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  transition: all var(--transition-fast);
}

.history-card:hover {
  box-shadow: var(--shadow-md);
}

.history-card.inactive {
  opacity: 0.6;
}

.history-qr-image {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-md);
  border: 1px solid var(--gray-200);
}

.history-info h4 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0 0 var(--space-2) 0;
}

.history-stats {
  display: flex;
  gap: var(--space-3);
  font-size: 0.75rem;
  color: var(--gray-600);
}

.history-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: auto;
}

.btn-sm {
  padding: var(--space-2) var(--space-3);
  font-size: 0.75rem;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-warning {
  background: var(--warning-500);
  color: white;
}

.btn-warning:hover {
  background: var(--warning-600);
}

.btn-secondary {
  background: var(--gray-200);
  color: var(--gray-700);
}

.btn-secondary:hover {
  background: var(--gray-300);
}

/* Stats Section */
.stats-section {
  background: white;
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--space-4);
}

.stat-card {
  text-align: center;
  padding: var(--space-4);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--primary-600);
  margin-bottom: var(--space-2);
}

.stat-label {
  font-size: 0.875rem;
  color: var(--gray-600);
}

/* Utilities */
.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-primary {
  background: var(--primary-600);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-700);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Responsive */
@media (max-width: 768px) {
  .qr-display-card {
    grid-template-columns: 1fr;
    text-align: center;
  }
  
  .qr-image-container {
    margin: 0 auto;
  }
  
  .form-grid {
    grid-template-columns: 1fr;
  }
  
  .history-list {
    grid-template-columns: 1fr;
  }
}
</style>