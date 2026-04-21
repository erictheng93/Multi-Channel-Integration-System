/**
 * QR Code Operations Composable
 *
 * 职责：
 * - QR 码查看和下载
 * - 背景预加载管理
 * - 懸停预加载
 * - 模态框状态管理
 *
 * @module composables/team-management/useQRCodeOperations
 */

import { ref, type Ref } from 'vue'
import { useQRCodeStore } from '@/stores/qrcode'
import { isFeatureEnabled, checkNetworkConditions, getFeatureConfig } from '@/config/features'
import { qrPreloadService } from '@/services/qrPreloadService'
import type { QRPreloadConfig } from '@/config/features'
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('useQRCodeOperations')

// ==================== Types ====================

export interface Team {
  id: number
  name: string
  description?: string
  qrCode?: string
  lineUrl?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  memberCount?: number
}

export interface UseQRCodeOperationsReturn {
  // QR Modal State
  qrModal: Ref<boolean>
  currentTeam: Ref<Team | null>
  currentQRCode: Ref<string>
  qrImageLoading: Ref<boolean>
  qrGenerating: Ref<boolean>

  // QR Modal Operations
  viewQR: (_team: Team) => Promise<void>
  downloadQR: () => void
  closeQRModal: () => void
  onQRImageLoad: () => void
  onQRImageError: () => void

  // Preload Operations
  startBackgroundPreload: (_teams: Team[]) => void
  stopBackgroundPreload: () => void
  prefetchOnHover: (_team: Team) => Promise<void>
}

// ==================== Composable ====================

/**
 * QR 码操作 Composable
 *
 * @example
 * ```typescript
 * const qrOps = useQRCodeOperations()
 *
 * // 查看 QR 码
 * await qrOps.viewQR(team)
 *
 * // 下载 QR 码
 * qrOps.downloadQR()
 *
 * // 启动背景预加载
 * qrOps.startBackgroundPreload(teams)
 * ```
 */
export function useQRCodeOperations(): UseQRCodeOperationsReturn {
  const qrCodeStore = useQRCodeStore()

  // ==================== QR Modal State ====================

  const qrModal = ref(false)
  const currentTeam = ref<Team | null>(null)
  const currentQRCode = ref('')
  const qrImageLoading = ref(true)
  const qrGenerating = ref(false)

  // ==================== QR Modal Operations ====================

  /**
   * 查看团队 QR 码（仅查看，不自动生成）
   * 如果没有 QR Code，显示警示提示用户到团队详情页面生成
   */
  async function viewQR(team: Team) {
    currentTeam.value = team
    qrModal.value = true
    qrImageLoading.value = true
    qrGenerating.value = true

    try {
      // 优先从 Store 获取（共享快取）
      const cachedQRData = qrCodeStore.getQRCode(team.id)
      let qrCode = cachedQRData?.qrCodeUrl || ''

      // 如果 Store 没有，从 API 载入（但不自动生成）
      // 注意：已移除舊系統 team.qrCode fallback，統一使用新 LIFF QR Code 系統 (team_liff_qr_codes 表)
      if (!qrCode) {
        const loadedQR = await qrCodeStore.loadQRCode(team.id, false) // force=false，不自动生成
        qrCode = loadedQR?.qrCodeUrl || ''
      }

      currentQRCode.value = qrCode
      qrGenerating.value = false

      // 如果有 QR 码，QR 图片开始载入
      if (qrCode) {
        // qrImageLoading 会在图片 onLoad 时设为 false
      } else {
        // 没有 QR 码，直接显示空状态
        qrImageLoading.value = false
      }
    } catch (error) {
      console.error('載入 QR 碼失敗:', error)
      currentQRCode.value = ''
      qrImageLoading.value = false
      qrGenerating.value = false
    }
  }

  /**
   * QR 图片加载完成
   */
  function onQRImageLoad() {
    qrImageLoading.value = false
  }

  /**
   * QR 图片加载错误
   */
  function onQRImageError() {
    console.error('QR 圖片載入失敗')
    qrImageLoading.value = false
  }

  /**
   * 下载 QR 码
   */
  function downloadQR() {
    if (!currentQRCode.value || !currentTeam.value) {
      return
    }

    try {
      // 创建下载链接
      const link = document.createElement('a')
      link.href = currentQRCode.value
      link.download = `${currentTeam.value.name}-QRCode.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      frontendLogger.debug(` QR 碼已下載: ${currentTeam.value.name}`)
    } catch (error) {
      console.error('下載 QR 碼失敗:', error)
    }
  }

  /**
   * 关闭 QR 模态框
   */
  function closeQRModal() {
    qrModal.value = false
    currentTeam.value = null
    currentQRCode.value = ''
    qrImageLoading.value = true
    qrGenerating.value = false
  }

  // ==================== Preload Operations ====================

  /**
   * 启动背景预载 QR Code
   *
   * 策略：
   * - 检查 Feature Flag 是否启用
   * - 检查网路条件是否符合
   * - 延迟启动以确保页面完全可互动 (TTI)
   * - 使用 qrPreloadService 智能载入
   */
  function startBackgroundPreload(teams: Team[]) {
    // 检查 Feature Flag
    if (!isFeatureEnabled('QR_BACKGROUND_PRELOAD')) {
      frontendLogger.debug(' Background QR preload is disabled (Feature Flag)')
      return
    }

    // 检查网路条件
    if (!checkNetworkConditions()) {
      frontendLogger.debug(' Background QR preload is disabled (Network Conditions)')
      return
    }

    // 检查是否有团队
    if (teams.length === 0) {
      frontendLogger.debug(' No teams to preload')
      return
    }

    // 取得配置
    const config = getFeatureConfig<QRPreloadConfig>('QR_BACKGROUND_PRELOAD')

    // 延迟启动，确保页面可互动
    const idleTimeout = config?.idleTimeout || 2000
    setTimeout(() => {
      frontendLogger.debug(` Starting background QR preload for ${teams.length} teams`)
      qrPreloadService.start(teams)
    }, idleTimeout)
  }

  /**
   * 停止背景预载
   */
  function stopBackgroundPreload() {
    qrPreloadService.stop()
    frontendLogger.debug(' Stopped background QR preload')
  }

  /**
   * 懸停预载 QR 码（Fallback 机制）
   * 使用 Pinia Store 统一管理 QR 码状态
   */
  async function prefetchOnHover(team: Team) {
    // 如果背景预载已启用且快取有效，跳过
    if (isFeatureEnabled('QR_BACKGROUND_PRELOAD') && qrCodeStore.isCacheValid(team.id)) {
      frontendLogger.debug(` QR already preloaded for team ${team.id}, skipping hover prefetch`)
      return
    }

    // Fallback: Hover prefetch（适用于背景预载禁用或快取未命中的情况）
    await qrCodeStore.prefetchQRCode(team.id)
  }

  // ==================== Return ====================

  return {
    // QR Modal State
    qrModal,
    currentTeam,
    currentQRCode,
    qrImageLoading,
    qrGenerating,

    // QR Modal Operations
    viewQR,
    downloadQR,
    closeQRModal,
    onQRImageLoad,
    onQRImageError,

    // Preload Operations
    startBackgroundPreload,
    stopBackgroundPreload,
    prefetchOnHover
  }
}
