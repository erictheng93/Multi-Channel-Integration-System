/**
 * QR Code Background Preload Service
 *
 * 功能：頁面載入後在背景持續性異步預載 QR Code，提升用戶體驗
 *
 * 策略：
 * - Phase 1: 立即載入前 3 個團隊 (優先)
 * - Phase 2: 持續性異步載入剩餘團隊 (requestIdleCallback)
 *
 * 特性：
 * 使用 requestIdleCallback 避免阻塞主執行緒
 * 並發控制 (自適應 2-5 個，根據設備性能)
 * 智能優先順序排序
 * 持續性異步載入，無需用戶互動暫停
 * 設備性能自動檢測與調整
 *
 * @version 2.0.0 - 簡化版（移除用戶互動暫停機制）
 * @date 2025-01-28
 */

/* eslint-disable no-undef */
// Browser APIs - 瀏覽器原生 API，ESLint 需要明確聲明

import { useQRCodeStore } from '@/stores/qrcode'

// ==================== 型別定義 ====================

// Team 介面（從 TeamManagement.vue 複製）
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

interface PreloadConfig {
  maxConcurrent: number // 最大並發請求數
  idleTimeout: number // 閒置偵測時間 (ms)
  memoryThreshold: number // 記憶體閾值 (MB)
  adaptiveThrottling: boolean // 自適應節流
  enableLogging: boolean // 啟用詳細日誌
}

interface PreloadMetrics {
  totalTeams: number // 總團隊數
  loadedTeams: number // 已載入數
  failedTeams: number // 失敗數
  cacheHitRate: number // 快取命中率 (%)
  avgLoadTime: number // 平均載入時間 (ms)
  totalNetworkCalls: number // 總網路呼叫數
  startTime: number // 開始時間
  endTime?: number // 結束時間
}

interface LoadTask {
  team: Team
  priority: number
  attempts: number
}

// 優先順序計算權重
const PRIORITY_WEIGHTS = {
  inViewport: 10, // 在可視範圍內（暫不實現，預留）
  memberCount: 1, // 成員數量
  isActive: 5, // 團隊活躍狀態
  recentlyUsed: 8 // 最近使用（預留）
}

// 預設配置
const DEFAULT_CONFIG: PreloadConfig = {
  maxConcurrent: 3,
  idleTimeout: 2000,
  memoryThreshold: 100,
  adaptiveThrottling: true,
  enableLogging: true
}

// ==================== 核心服務類別 ====================

export class QRPreloadService {
  private config: PreloadConfig
  private qrStore = useQRCodeStore()

  // 狀態管理
  private loadQueue: LoadTask[] = []
  private currentLoading = 0
  private isRunning = false
  private isPaused = false

  // 控制器
  private abortController: AbortController | null = null
  private idleCallbackId: number | null = null

  // 性能監控
  private devicePerformance: 'high' | 'medium' | 'low' = 'medium'

  // 指標收集
  private metrics: PreloadMetrics = {
    totalTeams: 0,
    loadedTeams: 0,
    failedTeams: 0,
    cacheHitRate: 0,
    avgLoadTime: 0,
    totalNetworkCalls: 0,
    startTime: 0
  }

  // 載入時間記錄
  private loadTimes: number[] = []

  constructor(config: Partial<PreloadConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }

    // 檢測設備性能
    this.detectDevicePerformance()
  }

  // ====================  設備性能檢測 ====================

  /**
   * 檢測設備性能等級
   */
  private detectDevicePerformance(): void {
    // 檢查硬體並發數（CPU 核心數）
    const cores = navigator.hardwareConcurrency || 4

    // 檢查記憶體（如可用）
    const memory = (performance as unknown as { memory?: { jsHeapSizeLimit: number } }).memory?.jsHeapSizeLimit || 0
    const memoryGB = memory / (1024 * 1024 * 1024)

    // 性能評分
    if (cores >= 8 && memoryGB >= 4) {
      this.devicePerformance = 'high'
      this.config.maxConcurrent = 5  // 高性能設備：5 個並發
    } else if (cores >= 4 && memoryGB >= 2) {
      this.devicePerformance = 'medium'
      this.config.maxConcurrent = 3  // 中等設備：3 個並發（預設）
    } else {
      this.devicePerformance = 'low'
      this.config.maxConcurrent = 2  // 低性能設備：2 個並發
    }

    this.log('info', ` Device performance: ${this.devicePerformance} (${cores} cores, ${memoryGB.toFixed(1)}GB RAM)`)
    this.log('info', ` Adjusted maxConcurrent: ${this.config.maxConcurrent}`)
  }

  // ==================== 公開方法 ====================

  /**
   * 啟動背景預載
   * @param teams 團隊列表
   */
  public start(teams: Team[]): void {
    if (this.isRunning) {
      this.log('warn', ' Already running, skipping start')
      return
    }

    if (teams.length === 0) {
      this.log('info', ' No teams to preload')
      return
    }

    this.isRunning = true
    this.abortController = new AbortController()
    this.metrics.startTime = Date.now()
    this.metrics.totalTeams = teams.length

    this.log('info', ` Starting background preload for ${teams.length} teams`)

    // Phase 1: 立即載入前 3 個團隊
    this.startPhase1(teams)

    // Phase 2: 閒置時間載入剩餘團隊（持續性異步載入）
    this.schedulePhase2(teams)
  }

  /**
   * 停止背景預載
   */
  public stop(): void {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false
    this.isPaused = false
    this.abortController?.abort()

    // 取消閒置回調
    if (this.idleCallbackId !== null && typeof cancelIdleCallback !== 'undefined') {
      cancelIdleCallback(this.idleCallbackId)
      this.idleCallbackId = null
    }

    this.loadQueue = []
    this.currentLoading = 0
    this.metrics.endTime = Date.now()

    this.log('info', ' Stopped background preload')
    this.logMetrics()
  }

  /**
   * 暫停背景預載（用戶互動時）
   */
  public pause(): void {
    if (!this.isRunning || this.isPaused) {
      return
    }

    this.isPaused = true
    this.log('info', ' Paused background preload (user interaction)')
  }

  /**
   * 恢復背景預載
   */
  public resume(): void {
    if (!this.isRunning || !this.isPaused) {
      return
    }

    this.isPaused = false
    this.log('info', ' Resumed background preload')

    // 繼續處理隊列
    this.processQueue()
  }

  /**
   * 取得當前指標
   */
  public getMetrics(): Readonly<PreloadMetrics> {
    return { ...this.metrics }
  }

  // ==================== Phase 1: 立即載入 ====================

  /**
   * Phase 1: 立即載入前 3 個團隊
   */
  private async startPhase1(teams: Team[]): Promise<void> {
    // 取得前 3 個團隊（未來可改為可見團隊）
    const priorityTeams = teams.slice(0, 3)

    this.log('info', ` Phase 1: Loading ${priorityTeams.length} priority teams`)

    // 並發載入
    const promises = priorityTeams.map(team => this.loadTeamQR(team, 'phase1'))
    await Promise.allSettled(promises)

    this.log('info', ` Phase 1 completed`)
  }

  // ==================== Phase 2: 閒置時載入 ====================

  /**
   * Phase 2: 排程閒置時間載入
   */
  private schedulePhase2(teams: Team[]): void {
    // 延遲啟動，確保頁面完全可互動
    setTimeout(() => {
      if (!this.isRunning) {return}

      this.log('info', ` Phase 2: Scheduling idle-time loading`)

      // 建立載入隊列（排除前 3 個已載入的）
      const remainingTeams = teams.slice(3)
      this.loadQueue = this.buildLoadQueue(remainingTeams)

      this.log('info', ` Load queue built: ${this.loadQueue.length} teams`)

      // 開始處理隊列
      this.processQueue()
    }, this.config.idleTimeout)
  }

  /**
   * 建立載入隊列（按優先順序排序）
   */
  private buildLoadQueue(teams: Team[]): LoadTask[] {
    return teams
      .map(team => ({
        team,
        priority: this.calculatePriority(team),
        attempts: 0
      }))
      .sort((a, b) => b.priority - a.priority) // 優先順序由高到低
  }

  /**
   * 計算團隊優先順序分數
   */
  private calculatePriority(team: Team): number {
    let score = 0

    // 成員數量權重
    score += (team.memberCount || 0) * PRIORITY_WEIGHTS.memberCount

    // 活躍狀態權重
    if (team.isActive) {
      score += PRIORITY_WEIGHTS.isActive
    }

    // 未來擴展：
    // - 從 localStorage 讀取最近使用記錄
    // - Intersection Observer 偵測可見性

    return score
  }

  /**
   * 處理載入隊列
   */
  private async processQueue(): Promise<void> {
    // 使用 requestIdleCallback（如可用）
    if (typeof requestIdleCallback !== 'undefined') {
      this.idleCallbackId = requestIdleCallback((deadline) => {
        this.processQueueDuringIdle(deadline)
      }, { timeout: this.config.idleTimeout })
    } else {
      // Fallback: 直接處理
      this.processQueueDirect()
    }
  }

  /**
   * 在閒置時間內處理隊列（持續性異步載入）
   */
  private async processQueueDuringIdle(deadline: IdleDeadline): Promise<void> {
    while (this.loadQueue.length > 0 && deadline.timeRemaining() > 50) {
      if (!this.isRunning) {
        break
      }

      // 檢查並發限制
      if (this.currentLoading >= this.config.maxConcurrent) {
        break
      }

      const task = this.loadQueue.shift()
      if (task) {
        // 計算進度百分比
        const progress = Math.round(((this.metrics.loadedTeams + this.metrics.failedTeams) / this.metrics.totalTeams) * 100)
        const remaining = this.loadQueue.length

        this.log('info', `[Phase 2] Progress: ${progress}% | Remaining: ${remaining} teams | Queue: ${this.currentLoading}/${this.config.maxConcurrent}`)

        this.loadTeamQR(task.team, 'phase2')
      }
    }

    // 如果還有任務，繼續排程（持續性載入，不暫停）
    if (this.isRunning && this.loadQueue.length > 0) {
      this.processQueue()
    } else if (this.loadQueue.length === 0) {
      // 最終統計
      const finalProgress = Math.round((this.metrics.loadedTeams / this.metrics.totalTeams) * 100)
      this.log('info', ` Phase 2 completed - ${this.metrics.loadedTeams}/${this.metrics.totalTeams} teams loaded (${finalProgress}%)`)
      this.stop()
    }
  }

  /**
   * 直接處理隊列（Fallback - 不支援 requestIdleCallback 的瀏覽器）
   */
  private async processQueueDirect(): Promise<void> {
    while (this.loadQueue.length > 0) {
      if (!this.isRunning) {
        break
      }

      // 檢查並發限制
      if (this.currentLoading >= this.config.maxConcurrent) {
        await this.waitForSlot()
      }

      const task = this.loadQueue.shift()
      if (task) {
        this.loadTeamQR(task.team, 'phase2')
      }
    }
  }

  // ==================== 載入邏輯 ====================

  /**
   * 載入單一團隊 QR
   */
  private async loadTeamQR(team: Team, phase: 'phase1' | 'phase2'): Promise<void> {
    // 檢查快取是否有效
    if (this.qrStore.isCacheValid(team.id)) {
      this.log('info', ` Cache hit for team ${team.id} (${team.name})`)
      this.metrics.loadedTeams++
      return
    }

    this.currentLoading++
    this.metrics.totalNetworkCalls++
    const startTime = Date.now()

    try {
      this.log('info', `[${phase}] Loading QR for team ${team.id} (${team.name})`)

      await this.qrStore.loadQRCode(team.id)

      const loadTime = Date.now() - startTime
      this.loadTimes.push(loadTime)
      this.metrics.loadedTeams++

      this.log('info', `[${phase}] Loaded QR for team ${team.id} in ${loadTime}ms`)
    } catch (error) {
      this.metrics.failedTeams++
      this.log('error', `[${phase}] Failed to load team ${team.id}:`, error)
    } finally {
      this.currentLoading--
    }
  }

  /**
   * 等待並發槽位
   */
  private async waitForSlot(): Promise<void> {
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (this.currentLoading < this.config.maxConcurrent) {
          clearInterval(checkInterval)
          resolve()
        }
      }, 100)
    })
  }

  // ==================== 工具方法 ====================

  /**
   * 日誌輸出
   */
  private log(level: 'info' | 'warn' | 'error', message: string, ...args: unknown[]): void {
    if (!this.config.enableLogging) {return}

    const prefix = '[QRPreload]'

    switch (level) {
      case 'info':
        console.log(prefix, message, ...args)
        break
      case 'warn':
        console.warn(prefix, message, ...args)
        break
      case 'error':
        console.error(prefix, message, ...args)
        break
    }
  }

  /**
   * 輸出指標統計
   */
  private logMetrics(): void {
    if (!this.config.enableLogging) {return}

    // 計算平均載入時間
    if (this.loadTimes.length > 0) {
      this.metrics.avgLoadTime = Math.round(
        this.loadTimes.reduce((sum, time) => sum + time, 0) / this.loadTimes.length
      )
    }

    // 計算快取命中率
    const totalAttempts = this.metrics.loadedTeams + this.metrics.failedTeams
    if (totalAttempts > 0) {
      const cacheHits = this.metrics.loadedTeams - this.metrics.totalNetworkCalls
      this.metrics.cacheHitRate = Math.round((cacheHits / totalAttempts) * 100)
    }

    const duration = this.metrics.endTime
      ? this.metrics.endTime - this.metrics.startTime
      : Date.now() - this.metrics.startTime

    console.log('[QRPreload] Performance Metrics:')
    console.table({
      'Total Teams': this.metrics.totalTeams,
      'Loaded Successfully': this.metrics.loadedTeams,
      'Failed': this.metrics.failedTeams,
      'Network Calls': this.metrics.totalNetworkCalls,
      'Cache Hit Rate': `${this.metrics.cacheHitRate}%`,
      'Avg Load Time': `${this.metrics.avgLoadTime}ms`,
      'Total Duration': `${Math.round(duration / 1000)}s`
    })
  }
}

// ==================== 匯出單例 ====================

/**
 * QR 預載服務單例
 *
 * 使用方式：
 * ```typescript
 * import { qrPreloadService } from '@/services/qrPreloadService'
 *
 * // 啟動預載
 * qrPreloadService.start(teams)
 *
 * // 停止預載
 * qrPreloadService.stop()
 *
 * // 查看指標
 * const metrics = qrPreloadService.getMetrics()
 * ```
 */
export const qrPreloadService = new QRPreloadService()
