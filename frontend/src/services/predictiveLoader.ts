// 預測性預載入系統
// AI驅動的用戶行為預測和智能預載入

import { ref, reactive } from 'vue'
import type { Conversation, ConversationFilters, Platform } from '@/types'
import { conversationApi } from '@/api/conversations'
import { idleTimeProcessor, TaskPriority } from './idleTimeProcessor'

// 滾動數據類型
interface ScrollData {
  speed: number
  distance: number
}

// 點擊數據類型
interface ClickData {
  target: string
  position: { x: number; y: number }
  timestamp: number
}

// 用戶行為模式
interface UserBehaviorPattern {
  frequentFilters: ConversationFilters[]
  timeBasedFilters: ConversationFilters[]
  statusBasedFilters: ConversationFilters[]
  scrollPatterns: {
    averageScrollSpeed: number
    preferredDirection: 'up' | 'down'
    sessionDuration: number
  }
  interactionPatterns: {
    clickFrequency: number
    searchFrequency: number
    filterChangeFrequency: number
  }
  temporalPatterns: {
    activeHours: number[]
    dayOfWeekPreferences: number[]
    sessionPatterns: { start: number; duration: number }[]
  }
}

// 預測結果
interface PredictionResult {
  confidence: number
  filters: ConversationFilters
  priority: number
  estimatedAccessTime: number
  reason: string
}

// 行為跟踪事件
interface BehaviorEvent {
  type: 'filter' | 'scroll' | 'click' | 'search' | 'navigate'
  timestamp: number
  data: unknown
}

// 預載入配置
interface PredictiveLoaderConfig {
  maxPredictions: number
  confidenceThreshold: number
  preloadTimeout: number
  enableUserTracking: boolean
  enableTemporalAnalysis: boolean
  cacheStrategy: 'aggressive' | 'conservative' | 'balanced'
}

const DEFAULT_CONFIG: PredictiveLoaderConfig = {
  maxPredictions: 5,
  confidenceThreshold: 0.6,
  preloadTimeout: 30000, // 30 seconds
  enableUserTracking: true,
  enableTemporalAnalysis: true,
  cacheStrategy: 'balanced'
}

export class PredictiveLoader {
  private config: PredictiveLoaderConfig
  private behaviorHistory: BehaviorEvent[] = []
  private userPattern: UserBehaviorPattern
  private preloadCache = new Map<string, { data: Conversation[]; timestamp: number }>()
  private activePreloads = new Set<string>()
  
  // 響應式狀態
  public isEnabled = ref(true)
  public stats = ref({
    totalPredictions: 0,
    successfulPredictions: 0,
    cacheMisses: 0,
    cacheHits: 0,
    averageConfidence: 0,
    preloadedDataSize: 0
  })
  
  public currentPredictions = reactive<PredictionResult[]>([])

  constructor(config?: Partial<PredictiveLoaderConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.userPattern = this.initializeUserPattern()
    this.startBehaviorTracking()
    this.setupPeriodicAnalysis()
  }

  // 初始化用戶模式
  private initializeUserPattern(): UserBehaviorPattern {
    const savedPattern = this.loadUserPattern()
    if (savedPattern) {return savedPattern}

    return {
      frequentFilters: [],
      timeBasedFilters: [],
      statusBasedFilters: [],
      scrollPatterns: {
        averageScrollSpeed: 0,
        preferredDirection: 'down',
        sessionDuration: 0
      },
      interactionPatterns: {
        clickFrequency: 0,
        searchFrequency: 0,
        filterChangeFrequency: 0
      },
      temporalPatterns: {
        activeHours: [],
        dayOfWeekPreferences: [],
        sessionPatterns: []
      }
    }
  }

  // 開始行為跟踪
  private startBehaviorTracking(): void {
    if (!this.config.enableUserTracking) {return}

    // 監聽用戶交互事件
    if (typeof window !== 'undefined') {
      // 滾動行為跟踪
      let scrollStartTime = 0
      let scrollDistance = 0

      window.addEventListener('scroll', () => {
        if (scrollStartTime === 0) {
          scrollStartTime = Date.now()
        }
        
        scrollDistance = window.scrollY
      })

      // 滾動結束檢測
      let scrollTimer: NodeJS.Timeout
      window.addEventListener('scroll', () => {
        clearTimeout(scrollTimer)
        scrollTimer = setTimeout(() => {
          if (scrollStartTime > 0) {
            const duration = Date.now() - scrollStartTime
            const speed = scrollDistance / duration
            
            this.recordBehavior({
              type: 'scroll',
              timestamp: Date.now(),
              data: { speed, distance: scrollDistance, duration }
            })
            
            scrollStartTime = 0
            scrollDistance = 0
          }
        }, 100)
      })

      // 點擊行為跟踪
      window.addEventListener('click', (event) => {
        this.recordBehavior({
          type: 'click',
          timestamp: Date.now(),
          data: {
            target: (event.target as HTMLElement)?.tagName,
            position: { x: event.clientX, y: event.clientY }
          }
        })
      })
    }
  }

  // 記錄用戶行為
  recordBehavior(event: BehaviorEvent): void {
    this.behaviorHistory.push(event)
    
    // 限制歷史記錄大小
    if (this.behaviorHistory.length > 1000) {
      this.behaviorHistory = this.behaviorHistory.slice(-500)
    }
    
    // 立即分析新行為（低優先級）
    idleTimeProcessor.scheduleTask(
      () => this.analyzeRecentBehavior(event),
      TaskPriority.LOW
    )
  }

  // 記錄篩選行為
  recordFilterChange(filters: ConversationFilters): void {
    this.recordBehavior({
      type: 'filter',
      timestamp: Date.now(),
      data: filters
    })

    // 立即預測並預載入
    this.predictAndPreload()
  }

  // 記錄搜索行為
  recordSearch(query: string): void {
    this.recordBehavior({
      type: 'search',
      timestamp: Date.now(),
      data: { query }
    })
  }

  // 分析最近行為
  private analyzeRecentBehavior(event: BehaviorEvent): void {
    const recentEvents = this.behaviorHistory.slice(-20) // 最近20個事件
    
    switch (event.type) {
      case 'filter':
        this.analyzeFilterPattern(event.data as ConversationFilters, recentEvents)
        break
      case 'scroll':
        this.analyzeScrollPattern(event.data as ScrollData, recentEvents)
        break
      case 'click':
        this.analyzeClickPattern(event.data as ClickData, recentEvents)
        break
    }
  }

  // 分析篩選模式
  private analyzeFilterPattern(filters: ConversationFilters, _recentEvents: BehaviorEvent[]): void {
    // 更新頻繁篩選條件
    const existingFilter = this.userPattern.frequentFilters.find(f => 
      JSON.stringify(f) === JSON.stringify(filters)
    )
    
    if (!existingFilter) {
      this.userPattern.frequentFilters.push(filters)
      
      // 限制頻繁篩選條件數量
      if (this.userPattern.frequentFilters.length > 10) {
        this.userPattern.frequentFilters = this.userPattern.frequentFilters.slice(-10)
      }
    }

    // 分析時間相關的篩選模式
    if (this.config.enableTemporalAnalysis) {
      const currentHour = new Date().getHours()
      const dayOfWeek = new Date().getDay()
      
      // 更新時間偏好
      if (!this.userPattern.temporalPatterns.activeHours.includes(currentHour)) {
        this.userPattern.temporalPatterns.activeHours.push(currentHour)
      }
      
      if (!this.userPattern.temporalPatterns.dayOfWeekPreferences.includes(dayOfWeek)) {
        this.userPattern.temporalPatterns.dayOfWeekPreferences.push(dayOfWeek)
      }
    }

    // 保存用戶模式
    this.saveUserPattern()
  }

  // 分析滾動模式
  private analyzeScrollPattern(scrollData: ScrollData, _recentEvents: BehaviorEvent[]): void {
    const { speed, distance } = scrollData
    
    // 更新滾動速度平均值
    if (this.userPattern.scrollPatterns.averageScrollSpeed === 0) {
      this.userPattern.scrollPatterns.averageScrollSpeed = speed
    } else {
      this.userPattern.scrollPatterns.averageScrollSpeed = 
        (this.userPattern.scrollPatterns.averageScrollSpeed + speed) / 2
    }

    // 判斷滾動方向偏好
    if (distance > 0) {
      this.userPattern.scrollPatterns.preferredDirection = 'down'
    }
  }

  // 分析點擊模式
  private analyzeClickPattern(_clickData: ClickData, recentEvents: BehaviorEvent[]): void {
    // 更新點擊頻率
    const clickEvents = recentEvents.filter(e => e.type === 'click')
    this.userPattern.interactionPatterns.clickFrequency = clickEvents.length
  }

  // 執行預測
  private async makePredictions(): Promise<PredictionResult[]> {
    const predictions: PredictionResult[] = []
    
    // 基於頻繁篩選條件的預測
    for (const filters of this.userPattern.frequentFilters.slice(0, 3)) {
      const confidence = this.calculateFilterConfidence(filters)
      
      if (confidence >= this.config.confidenceThreshold) {
        predictions.push({
          confidence,
          filters,
          priority: Math.round(confidence * 10),
          estimatedAccessTime: this.estimateAccessTime(filters),
          reason: 'Frequent filter pattern'
        })
      }
    }

    // 基於時間模式的預測
    if (this.config.enableTemporalAnalysis) {
      const temporalPrediction = this.predictBasedOnTime()
      if (temporalPrediction) {
        predictions.push(temporalPrediction)
      }
    }

    // 基於狀態轉換的預測
    const statusPrediction = this.predictStatusTransition()
    if (statusPrediction) {
      predictions.push(statusPrediction)
    }

    // 按信心度排序
    return predictions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxPredictions)
  }

  // 計算篩選條件的信心度
  private calculateFilterConfidence(filters: ConversationFilters): number {
    const recentFilterEvents = this.behaviorHistory
      .filter(e => e.type === 'filter')
      .slice(-10)
    
    const matchingEvents = recentFilterEvents.filter(e => {
      const eventFilters = e.data as ConversationFilters
      return JSON.stringify(eventFilters) === JSON.stringify(filters)
    })

    const baseConfidence = matchingEvents.length / recentFilterEvents.length
    
    // 時間權重：最近的事件權重更高
    const timeWeightedConfidence = this.applyTimeWeight(matchingEvents, baseConfidence)
    
    return Math.min(timeWeightedConfidence, 1)
  }

  // 應用時間權重
  private applyTimeWeight(events: BehaviorEvent[], baseConfidence: number): number {
    if (events.length === 0) {return 0}
    
    const now = Date.now()
    const recentThreshold = 10 * 60 * 1000 // 10 minutes
    
    const recentEvents = events.filter(e => now - e.timestamp < recentThreshold)
    const recentWeight = recentEvents.length / events.length
    
    return baseConfidence * (0.5 + recentWeight * 0.5)
  }

  // 基於時間的預測
  private predictBasedOnTime(): PredictionResult | null {
    if (!this.config.enableTemporalAnalysis) {return null}
    
    const currentHour = new Date().getHours()
    const currentDay = new Date().getDay()
    
    // 檢查是否是活躍時間
    const isActiveHour = this.userPattern.temporalPatterns.activeHours.includes(currentHour)
    const isActiveDay = this.userPattern.temporalPatterns.dayOfWeekPreferences.includes(currentDay)
    
    if (isActiveHour && isActiveDay) {
      // 預測用戶可能查看的篩選條件
      const timeBasedFilters = this.getTimeBasedFilters(currentHour, currentDay)
      
      if (timeBasedFilters) {
        return {
          confidence: 0.7,
          filters: timeBasedFilters,
          priority: 7,
          estimatedAccessTime: 5 * 60 * 1000, // 5 minutes
          reason: 'Time-based pattern'
        }
      }
    }
    
    return null
  }

  // 獲取基於時間的篩選條件
  private getTimeBasedFilters(hour: number, _day: number): ConversationFilters | null {
    // 工作時間偏好
    if (hour >= 9 && hour <= 17) {
      return { status: 'open' } // 工作時間更關注待處理的對話
    }
    
    // 晚上時間偏好
    if (hour >= 18 || hour <= 8) {
      return { status: 'assigned' } // 非工作時間查看已指派的對話
    }
    
    return null
  }

  // 預測狀態轉換
  private predictStatusTransition(): PredictionResult | null {
    const recentFilterEvents = this.behaviorHistory
      .filter(e => e.type === 'filter')
      .slice(-5)
    
    if (recentFilterEvents.length < 2) {return null}
    
    // 分析狀態轉換模式
    const statusTransitions = []
    for (let i = 1; i < recentFilterEvents.length; i++) {
      const prevFilters = recentFilterEvents[i - 1]?.data as ConversationFilters
      const currentFilters = recentFilterEvents[i]?.data as ConversationFilters
      
      if (prevFilters?.status && currentFilters?.status && prevFilters.status !== currentFilters.status) {
        statusTransitions.push({
          from: prevFilters.status,
          to: currentFilters.status
        })
      }
    }
    
    // 找到最常見的轉換
    if (statusTransitions.length > 0) {
      const lastTransition = statusTransitions[statusTransitions.length - 1]
      
      // 預測下一個狀態
      let nextStatus: 'open' | 'assigned' | 'closed' = 'open'
      if (lastTransition?.to === 'open') {nextStatus = 'assigned'}
      else if (lastTransition?.to === 'assigned') {nextStatus = 'closed'}
      else if (lastTransition?.to === 'closed') {nextStatus = 'open'}
      
      return {
        confidence: 0.65,
        filters: { status: nextStatus },
        priority: 6,
        estimatedAccessTime: 3 * 60 * 1000, // 3 minutes
        reason: 'Status transition pattern'
      }
    }
    
    return null
  }

  // 估計訪問時間
  private estimateAccessTime(filters: ConversationFilters): number {
    // 基於歷史數據估計用戶何時會訪問此篩選條件
    const similarFilterEvents = this.behaviorHistory
      .filter(e => e.type === 'filter')
      .filter(e => {
        const eventFilters = e.data as ConversationFilters
        return eventFilters && this.filtersMatch(eventFilters, filters, 0.8)
      })
    
    if (similarFilterEvents.length === 0) {return 10 * 60 * 1000} // 默認10分鐘
    
    // 計算平均間隔
    const intervals = []
    for (let i = 1; i < similarFilterEvents.length; i++) {
      const current = similarFilterEvents[i]
      const previous = similarFilterEvents[i - 1]
      if (current && previous) {
        intervals.push(current.timestamp - previous.timestamp)
      }
    }
    
    const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
    return Math.min(averageInterval, 30 * 60 * 1000) // 最多30分鐘
  }

  // 檢查篩選條件是否匹配
  private filtersMatch(filters1: ConversationFilters, filters2: ConversationFilters, threshold: number): boolean {
    const keys = new Set([...Object.keys(filters1), ...Object.keys(filters2)])
    let matches = 0
    
    for (const key of keys) {
      if (filters1[key as keyof ConversationFilters] === filters2[key as keyof ConversationFilters]) {
        matches++
      }
    }
    
    return matches / keys.size >= threshold
  }

  // 執行預測並預載入
  public async predictAndPreload(): Promise<void> {
    if (!this.isEnabled.value) {return}
    
    try {
      const predictions = await this.makePredictions()
      this.currentPredictions.splice(0, this.currentPredictions.length, ...predictions)
      
      this.stats.value.totalPredictions++
      
      if (predictions.length > 0) {
        this.stats.value.averageConfidence = 
          predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length
      }
      
      // 執行預載入
      for (const prediction of predictions) {
        await this.preloadData(prediction)
      }
      
    } catch (error) {
      console.error('❌ [PredictiveLoader] Prediction failed:', error)
    }
  }

  // 預載入數據
  private async preloadData(prediction: PredictionResult): Promise<void> {
    const cacheKey = this.generateCacheKey(prediction.filters)
    
    // 檢查是否已經預載入或正在預載入
    if (this.preloadCache.has(cacheKey) || this.activePreloads.has(cacheKey)) {
      return
    }
    
    this.activePreloads.add(cacheKey)
    
    try {
      // 在空閒時間執行預載入
      const data = await idleTimeProcessor.scheduleTask(
        async () => {
          const cleanFilters = { ...prediction.filters }
          
          // 清理空字串狀態
          if (cleanFilters.status === '') {
            delete cleanFilters.status
          }
          if (cleanFilters.platform === '') {
            delete cleanFilters.platform
          }
          
          const apiParams: { page: number; pageSize: number; status?: 'open' | 'assigned' | 'closed'; platform?: Platform; assignedTo?: string } = {
            page: 1,
            pageSize: 20
          }
          
          if (cleanFilters.status) {
            apiParams.status = cleanFilters.status as 'open' | 'assigned' | 'closed'
          }
          
          if (cleanFilters.platform) {
            apiParams.platform = cleanFilters.platform
          }
          
          if (cleanFilters.assignedTo) {
            apiParams.assignedTo = cleanFilters.assignedTo
          }
          const response = await conversationApi.list(apiParams)
          
          if (response.success && response.data) {
            return response.data.items || []
          }
          return []
        },
        TaskPriority.LOW
      ) as Conversation[]
      
      // 快取預載入的數據
      this.preloadCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      })
      
      this.stats.value.preloadedDataSize += JSON.stringify(data).length
      
      console.log(`🔮 [PredictiveLoader] Preloaded data for filters:`, prediction.filters)
      
    } catch (error) {
      console.error('❌ [PredictiveLoader] Preload failed:', error)
    } finally {
      this.activePreloads.delete(cacheKey)
    }
  }

  // 生成快取鍵
  private generateCacheKey(filters: ConversationFilters): string {
    return `preload_${JSON.stringify(filters)}`
  }

  // 獲取預載入的數據
  public getPreloadedData(filters: ConversationFilters): Conversation[] | null {
    const cacheKey = this.generateCacheKey(filters)
    const cached = this.preloadCache.get(cacheKey)
    
    if (!cached) {
      this.stats.value.cacheMisses++
      return null
    }
    
    // 檢查數據是否過期
    if (Date.now() - cached.timestamp > this.config.preloadTimeout) {
      this.preloadCache.delete(cacheKey)
      this.stats.value.cacheMisses++
      return null
    }
    
    this.stats.value.cacheHits++
    this.stats.value.successfulPredictions++
    
    console.log(`✨ [PredictiveLoader] Cache hit for filters:`, filters)
    return cached.data
  }

  // 清理過期的預載入數據
  private cleanupExpiredData(): void {
    const now = Date.now()
    
    for (const [key, cached] of this.preloadCache.entries()) {
      if (now - cached.timestamp > this.config.preloadTimeout) {
        this.preloadCache.delete(key)
      }
    }
  }

  // 設置定期分析
  private setupPeriodicAnalysis(): void {
    // 每5分鐘執行一次預測分析
    setInterval(() => {
      if (this.isEnabled.value && this.behaviorHistory.length > 10) {
        idleTimeProcessor.scheduleTask(
          () => this.predictAndPreload(),
          TaskPriority.LOW
        )
      }
    }, 5 * 60 * 1000)
    
    // 每10分鐘清理過期數據
    setInterval(() => {
      this.cleanupExpiredData()
    }, 10 * 60 * 1000)
  }

  // 保存用戶模式
  private saveUserPattern(): void {
    try {
      localStorage.setItem('user_behavior_pattern', JSON.stringify(this.userPattern))
    } catch (error) {
      console.warn('[PredictiveLoader] Failed to save user pattern:', error)
    }
  }

  // 載入用戶模式
  private loadUserPattern(): UserBehaviorPattern | null {
    try {
      const saved = localStorage.getItem('user_behavior_pattern')
      return saved ? JSON.parse(saved) : null
    } catch (error) {
      console.warn('[PredictiveLoader] Failed to load user pattern:', error)
      return null
    }
  }

  // 重置用戶模式
  public resetUserPattern(): void {
    this.userPattern = this.initializeUserPattern()
    this.behaviorHistory.length = 0
    this.preloadCache.clear()
    this.activePreloads.clear()
    
    try {
      localStorage.removeItem('user_behavior_pattern')
    } catch (error) {
      console.warn('[PredictiveLoader] Failed to remove user pattern:', error)
    }
    
    console.log('🔄 [PredictiveLoader] User pattern reset')
  }

  // 獲取統計信息
  getStats() {
    return {
      ...this.stats.value,
      activePreloads: this.activePreloads.size,
      cachedItems: this.preloadCache.size,
      behaviorHistorySize: this.behaviorHistory.length,
      currentPredictions: this.currentPredictions.length,
      config: this.config
    }
  }

  // 啟用/禁用預測系統
  setEnabled(enabled: boolean): void {
    this.isEnabled.value = enabled
    
    if (!enabled) {
      this.activePreloads.clear()
      this.currentPredictions.splice(0)
    }
  }

  // 更新配置
  updateConfig(newConfig: Partial<PredictiveLoaderConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  // 銷毀預測系統
  destroy(): void {
    this.preloadCache.clear()
    this.activePreloads.clear()
    this.behaviorHistory.length = 0
    this.isEnabled.value = false
    
    console.log('🔴 [PredictiveLoader] Destroyed')
  }
}

// 創建全局實例
export const predictiveLoader = new PredictiveLoader()

// 在頁面卸載時保存數據
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    predictiveLoader.destroy()
  })
}