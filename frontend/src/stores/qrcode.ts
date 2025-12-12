/**
 * QR Code Store - 統一管理團隊 QR 碼狀態
 *
 * 解決問題：
 * - TeamManagement.vue 和 TeamCard.vue 的 QR 碼狀態不同步
 * - 重複的 API 呼叫
 * - 快取管理分散
 *
 * 架構：
 * - 以 teamId 為 key 的集中式快取
 * - 自動 TTL 過期管理
 * - 樂觀更新支援
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { teamApi } from '@/api/team'
import type { QRCode } from '@/types'

// 快取條目結構
interface QRCacheEntry {
  data: QRCode | null      // 完整 QR 資料，null 表示該團隊無 QR
  timestamp: number        // 快取時間戳
  loading: boolean         // 載入狀態
}

// 快取配置
const CACHE_TTL = 5 * 60 * 1000  // 5 分鐘快取有效期

export const useQRCodeStore = defineStore('qrcode', () => {
  // ==================== 狀態 ====================

  // 以 teamId 為 key 的 QR 碼快取
  const qrCodeCache = ref<Map<number, QRCacheEntry>>(new Map())

  // 全域錯誤狀態
  const error = ref<string | null>(null)

  // 正在生成 QR 的團隊 ID 集合
  const generatingTeamIds = ref<Set<number>>(new Set())

  // ==================== Getters ====================

  /**
   * 取得指定團隊的 QR 碼
   */
  const getQRCode = computed(() => {
    return (teamId: number): QRCode | null => {
      const entry = qrCodeCache.value.get(teamId)
      if (!entry) {return null}

      // 檢查是否過期
      if (Date.now() - entry.timestamp > CACHE_TTL) {
        return null
      }

      return entry.data
    }
  })

  /**
   * 檢查指定團隊是否正在載入 QR
   */
  const isLoading = computed(() => {
    return (teamId: number): boolean => {
      const entry = qrCodeCache.value.get(teamId)
      return entry?.loading ?? false
    }
  })

  /**
   * 檢查指定團隊是否正在生成 QR
   */
  const isGenerating = computed(() => {
    return (teamId: number): boolean => {
      return generatingTeamIds.value.has(teamId)
    }
  })

  /**
   * 檢查快取是否有效
   */
  const isCacheValid = computed(() => {
    return (teamId: number): boolean => {
      const entry = qrCodeCache.value.get(teamId)
      if (!entry) {return false}
      return Date.now() - entry.timestamp < CACHE_TTL
    }
  })

  // ==================== Actions ====================

  /**
   * 載入團隊 QR 碼（優先使用快取）
   * @param teamId 團隊 ID
   * @param forceRefresh 是否強制刷新（忽略快取）
   */
  const loadQRCode = async (teamId: number, forceRefresh = false): Promise<QRCode | null> => {
    // 檢查快取
    if (!forceRefresh && isCacheValid.value(teamId)) {
      console.log(`⚡ [QRStore] 快取命中: team ${teamId}`)
      return getQRCode.value(teamId)
    }

    // 設定載入狀態
    const existingEntry = qrCodeCache.value.get(teamId)
    qrCodeCache.value.set(teamId, {
      data: existingEntry?.data ?? null,
      timestamp: existingEntry?.timestamp ?? 0,
      loading: true
    })

    try {
      console.log(`🔍 [QRStore] 載入 QR 碼: team ${teamId}`)

      // Step 1: 快速檢查是否有現有 QR
      const fastResponse = await teamApi.getLatestQRCodeFast(teamId)

      if (fastResponse.success && fastResponse.data?.qrCode) {
        console.log(`✅ [QRStore] 找到現有 QR (來源: ${fastResponse.data.fromCache ? 'KV快取' : '資料庫'})`)

        // Step 2: 取得完整資料
        const fullResponse = await teamApi.getTeamQRCodes(teamId)

        if (fullResponse.success && fullResponse.data && fullResponse.data.length > 0) {
          const activeQRCodes = fullResponse.data.filter((qr: QRCode) => qr.isActive)
          // Length check above guarantees data[0] exists
          const qrCode: QRCode = activeQRCodes[0] ?? (fullResponse.data[0] as QRCode)

          // 更新快取
          qrCodeCache.value.set(teamId, {
            data: qrCode,
            timestamp: Date.now(),
            loading: false
          })

          return qrCode
        } else {
          // 使用快速響應的基本資料作為備用
          const basicQRCode: QRCode = {
            id: 'cached',
            qrCode: fastResponse.data.qrCode,
            lineUrl: fastResponse.data.lineUrl,
            token: '',
            campaignName: '',
            usageCount: 0,
            isActive: true,
            createdAt: new Date()
          }

          qrCodeCache.value.set(teamId, {
            data: basicQRCode,
            timestamp: Date.now(),
            loading: false
          })

          return basicQRCode
        }
      } else {
        // 無現有 QR
        console.log(`📭 [QRStore] 團隊尚未有 QR Code: team ${teamId}`)
        qrCodeCache.value.set(teamId, {
          data: null,
          timestamp: Date.now(),
          loading: false
        })
        return null
      }
    } catch (err) {
      console.error(`❌ [QRStore] 載入 QR 碼失敗: team ${teamId}`, err)
      error.value = '載入 QR 碼失敗'

      qrCodeCache.value.set(teamId, {
        data: null,
        timestamp: 0,
        loading: false
      })

      return null
    }
  }

  /**
   * 生成新的 QR 碼
   * @param teamId 團隊 ID
   * @param teamName 團隊名稱
   * @param isRegeneration 是否為重新生成（會使舊 QR 失效）
   */
  const generateQRCode = async (
    teamId: number,
    teamName: string,
    isRegeneration = false
  ): Promise<QRCode | null> => {
    // 如果不是重新生成，先檢查是否有現有 QR
    if (!isRegeneration) {
      console.log(`🔍 [QRStore] 生成前檢查現有 QR: team ${teamId}`)
      const existingQR = await loadQRCode(teamId)

      if (existingQR) {
        console.log(`✅ [QRStore] 發現現有 QR，直接使用`)
        return existingQR
      }
      console.log(`📭 [QRStore] 確認無現有 QR，開始生成新的`)
    }

    // 標記為生成中
    generatingTeamIds.value.add(teamId)
    error.value = null

    try {
      console.log(`🆕 [QRStore] ${isRegeneration ? '重新' : ''}生成 QR 碼: team ${teamId}`)

      const response = await teamApi.generateTeamQR(teamId, {
        campaignName: `${teamName} QR Code`,
        description: `團隊 ${teamName} 的客服 QR 碼`
        // QR Codes are now permanent (no expiration)
      })

      if (response.success && response.data) {
        const newQRCode: QRCode = {
          id: response.data.id,
          qrCode: response.data.qrCode,
          lineUrl: response.data.lineUrl,
          token: response.data.token,
          campaignName: response.data.campaignName || '',
          usageCount: response.data.usageCount || 0,
          maxUses: response.data.maxUses,
          // QR Codes are now permanent (no expiresAt)
          isActive: true,
          createdAt: new Date()
        }

        // 更新快取
        qrCodeCache.value.set(teamId, {
          data: newQRCode,
          timestamp: Date.now(),
          loading: false
        })

        console.log(`✅ [QRStore] QR 碼${isRegeneration ? '重新' : ''}生成成功: team ${teamId}`)
        return newQRCode
      } else {
        error.value = response.error || '生成 QR 碼失敗'
        return null
      }
    } catch (err) {
      console.error(`❌ [QRStore] 生成 QR 碼失敗: team ${teamId}`, err)
      error.value = '生成 QR 碼失敗'
      return null
    } finally {
      generatingTeamIds.value.delete(teamId)
    }
  }

  /**
   * 預載 QR 碼（用於懸停預載）
   * 靜默載入，不影響 UI
   */
  const prefetchQRCode = async (teamId: number): Promise<void> => {
    // 如果快取有效或正在載入，跳過
    if (isCacheValid.value(teamId) || isLoading.value(teamId)) {
      return
    }

    try {
      console.log(`🔄 [QRStore] 預載 QR 碼: team ${teamId}`)
      const response = await teamApi.getLatestQRCodeFast(teamId)

      if (response.success && response.data?.qrCode) {
        // 只存基本資料，完整資料等需要時再載入
        const basicQRCode: QRCode = {
          id: 'prefetched',
          qrCode: response.data.qrCode,
          lineUrl: response.data.lineUrl,
          token: '',
          campaignName: '',
          usageCount: 0,
          isActive: true,
          createdAt: new Date()
        }

        qrCodeCache.value.set(teamId, {
          data: basicQRCode,
          timestamp: Date.now(),
          loading: false
        })

        console.log(`✅ [QRStore] 預載完成: team ${teamId}`)
      }
    } catch (_err) {
      // 預載失敗靜默處理
      console.log(`⚠️ [QRStore] 預載失敗: team ${teamId}`)
    }
  }

  /**
   * 清除指定團隊的快取
   */
  const invalidateCache = (teamId: number): void => {
    qrCodeCache.value.delete(teamId)
    console.log(`🗑️ [QRStore] 快取已清除: team ${teamId}`)
  }

  /**
   * 清除所有快取
   */
  const clearAllCache = (): void => {
    qrCodeCache.value.clear()
    console.log(`🗑️ [QRStore] 所有快取已清除`)
  }

  /**
   * 清除錯誤狀態
   */
  const clearError = (): void => {
    error.value = null
  }

  /**
   * 重置 Store 狀態
   */
  const $reset = (): void => {
    qrCodeCache.value.clear()
    generatingTeamIds.value.clear()
    error.value = null
  }

  return {
    // 狀態
    qrCodeCache,
    error,
    generatingTeamIds,

    // Getters
    getQRCode,
    isLoading,
    isGenerating,
    isCacheValid,

    // Actions
    loadQRCode,
    generateQRCode,
    prefetchQRCode,
    invalidateCache,
    clearAllCache,
    clearError,
    $reset
  }
})
