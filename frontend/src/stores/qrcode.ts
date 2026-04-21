/**
 * QR Code Store - LIFF QR Code 系统（完全迁移）
 *
 * 功能：
 * - 每个团队一个永久性 LIFF QR Code
 * - 统一管理团队 LIFF QR 码状态
 * - 集中式缓存管理
 * - 扫描统计追踪
 *
 * 架构：
 * - 以 teamId 为 key 的集中式快取
 * - 自动 TTL 过期管理
 * - 樂觀更新支援
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { teamApi } from '@/api/team'
import type { LiffQRCode, LiffQRCodeStats } from '@/types'
import { nowISO } from '@/utils/timestamp'
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('qrcode')

// 快取條目結構
interface LiffQRCacheEntry {
  data: LiffQRCode | null // 完整 LIFF QR 資料，null 表示該團隊無 QR
  timestamp: number // 快取時間戳
  loading: boolean // 載入狀態
}

// 快取配置
const CACHE_TTL = 5 * 60 * 1000  // 5 分鐘快取有效期

export const useQRCodeStore = defineStore('qrcode', () => {
  // ==================== 狀態 ====================

  // 以 teamId 為 key 的 LIFF QR 碼快取
  const liffQRCache = ref<Map<number, LiffQRCacheEntry>>(new Map())

  // 全域錯誤狀態
  const error = ref<string | null>(null)

  // 正在生成 QR 的團隊 ID 集合
  const generatingTeamIds = ref<Set<number>>(new Set())

  // ==================== Getters ====================

  /**
   * 取得指定團隊的 LIFF QR 碼
   */
  const getQRCode = computed(() => {
    return (teamId: number): LiffQRCode | null => {
      const entry = liffQRCache.value.get(teamId)
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
      const entry = liffQRCache.value.get(teamId)
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
      const entry = liffQRCache.value.get(teamId)
      if (!entry) {return false}
      return Date.now() - entry.timestamp < CACHE_TTL
    }
  })

  // ==================== Actions ====================

  /**
   * 載入團隊 LIFF QR 碼（優先使用快取）
   * @param teamId 團隊 ID
   * @param forceRefresh 是否強制刷新（忽略快取）
   */
  const loadQRCode = async (teamId: number, forceRefresh = false): Promise<LiffQRCode | null> => {
    // 檢查快取
    if (!forceRefresh && isCacheValid.value(teamId)) {
      frontendLogger.debug(`[LIFF QR Store] 快取命中: team ${teamId}`)
      return getQRCode.value(teamId)
    }

    // 設定載入狀態
    const existingEntry = liffQRCache.value.get(teamId)
    liffQRCache.value.set(teamId, {
      data: existingEntry?.data ?? null,
      timestamp: existingEntry?.timestamp ?? 0,
      loading: true
    })

    try {
      frontendLogger.debug(`[LIFF QR Store] 載入 LIFF QR 碼: team ${teamId}`)

      const response = await teamApi.getLiffQRCode(teamId)

      if (response.success && response.data) {
        const liffQRCode: LiffQRCode = {
          id: response.data.id,
          liffUrl: response.data.liffUrl,
          qrCodeUrl: response.data.qrCodeUrl,
          scanCount: response.data.scanCount || 0,
          isActive: response.data.isActive,
          createdAt: response.data.createdAt,
          updatedAt: response.data.updatedAt,
          type: 'liff'
        }

        // 更新快取
        liffQRCache.value.set(teamId, {
          data: liffQRCode,
          timestamp: Date.now(),
          loading: false
        })

        frontendLogger.debug(`[LIFF QR Store] LIFF QR 碼載入成功`)
        return liffQRCode
      } else {
        // 無現有 LIFF QR Code
        frontendLogger.debug(`[LIFF QR Store] 團隊尚未有 LIFF QR Code: team ${teamId}`)
        liffQRCache.value.set(teamId, {
          data: null,
          timestamp: Date.now(),
          loading: false
        })
        return null
      }
    } catch (err) {
      console.error(`[LIFF QR Store] 載入 LIFF QR 碼失敗: team ${teamId}`, err)
      error.value = '載入 LIFF QR 碼失敗'

      liffQRCache.value.set(teamId, {
        data: null,
        timestamp: 0,
        loading: false
      })

      return null
    }
  }

  /**
   * 生成新的 LIFF QR 碼（或重新生成）
   * 每個團隊只有一個永久性 LIFF QR Code
   * @param teamId 團隊 ID
   * @param _teamName 團隊名稱（保留參數以保持 API 兼容性）
   * @param isRegeneration 是否為重新生成
   */
  const generateQRCode = async (
    teamId: number,
    _teamName: string,
    isRegeneration = false
  ): Promise<LiffQRCode | null> => {
    // 如果不是重新生成，先檢查是否有現有 LIFF QR
    if (!isRegeneration) {
      frontendLogger.debug(`[LIFF QR Store] 生成前檢查現有 LIFF QR: team ${teamId}`)
      const existingQR = await loadQRCode(teamId)

      if (existingQR) {
        frontendLogger.debug(`[LIFF QR Store] 發現現有 LIFF QR，直接使用`)
        return existingQR
      }
      frontendLogger.debug(`[LIFF QR Store] 確認無現有 LIFF QR，開始生成新的`)
    }

    // 標記為生成中
    generatingTeamIds.value.add(teamId)
    error.value = null

    try {
      frontendLogger.debug(`[LIFF QR Store] ${isRegeneration ? '重新' : ''}生成 LIFF QR 碼: team ${teamId}`)

      const response = await teamApi.generateLiffQR(teamId)

      if (response.success && response.data) {
        const newLiffQRCode: LiffQRCode = {
          id: response.data.id,
          liffUrl: response.data.liffUrl,
          qrCodeUrl: response.data.qrCodeUrl,
          scanCount: response.data.scanCount || 0,
          isActive: response.data.isActive,
          createdAt: nowISO(),
          updatedAt: nowISO(),
          type: 'liff'
        }

        // 更新快取
        liffQRCache.value.set(teamId, {
          data: newLiffQRCode,
          timestamp: Date.now(),
          loading: false
        })

        frontendLogger.debug(`[LIFF QR Store] LIFF QR 碼${isRegeneration ? '重新' : ''}生成成功: team ${teamId}`)
        return newLiffQRCode
      } else {
        error.value = response.error || '生成 LIFF QR 碼失敗'
        return null
      }
    } catch (err) {
      console.error(`[LIFF QR Store] 生成 LIFF QR 碼失敗: team ${teamId}`, err)
      error.value = '生成 LIFF QR 碼失敗'
      return null
    } finally {
      generatingTeamIds.value.delete(teamId)
    }
  }

  /**
   * 獲取 LIFF QR Code 統計
   * @param teamId 團隊 ID
   */
  const getQRStats = async (teamId: number): Promise<LiffQRCodeStats | null> => {
    try {
      frontendLogger.debug(`[LIFF QR Store] 載入統計: team ${teamId}`)

      const response = await teamApi.getLiffQRStats(teamId)

      if (response.success && response.data) {
        frontendLogger.debug(`[LIFF QR Store] 統計載入成功`)
        return response.data
      } else {
        frontendLogger.debug(`[LIFF QR Store] 統計載入失敗`)
        return null
      }
    } catch (err) {
      console.error(`[LIFF QR Store] 載入統計失敗: team ${teamId}`, err)
      return null
    }
  }

  /**
   * 預載 LIFF QR 碼（用於懸停預載）
   * 靜默載入，不影響 UI
   */
  const prefetchQRCode = async (teamId: number): Promise<void> => {
    // 如果快取有效或正在載入，跳過
    if (isCacheValid.value(teamId) || isLoading.value(teamId)) {
      return
    }

    try {
      frontendLogger.debug(`[LIFF QR Store] 預載 LIFF QR 碼: team ${teamId}`)
      await loadQRCode(teamId)
      frontendLogger.debug(`[LIFF QR Store] 預載完成: team ${teamId}`)
    } catch (_err) {
      // 預載失敗靜默處理
      frontendLogger.debug(`[LIFF QR Store] 預載失敗: team ${teamId}`)
    }
  }

  /**
   * 清除指定團隊的快取
   */
  const invalidateCache = (teamId: number): void => {
    liffQRCache.value.delete(teamId)
    frontendLogger.debug(`[LIFF QR Store] 快取已清除: team ${teamId}`)
  }

  /**
   * 清除所有快取
   */
  const clearAllCache = (): void => {
    liffQRCache.value.clear()
    frontendLogger.debug(`[LIFF QR Store] 所有快取已清除`)
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
    liffQRCache.value.clear()
    generatingTeamIds.value.clear()
    error.value = null
  }

  return {
    // 狀態
    liffQRCache,
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
    getQRStats,
    prefetchQRCode,
    invalidateCache,
    clearAllCache,
    clearError,
    $reset
  }
})
