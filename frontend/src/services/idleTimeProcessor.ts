// 空閒時間處理器服務
// 充分利用瀏覽器空閒時間執行低優先級任務

import { ref } from 'vue'

// 任務優先級
export enum TaskPriority {
  _LOW = 1,
  _NORMAL = 2,
  _HIGH = 3,
  _CRITICAL = 4
}

// 空閒任務接口
interface IdleTask {
  id: string
  priority: TaskPriority
  task: (_deadline: globalThis.IdleDeadline) => Promise<unknown> | unknown
  resolve: (_result: unknown) => void
  reject: (_error: Error) => void
  timeout?: number
  createdAt: number
}

// 擴展 IdleDeadline 接口以支援更多瀏覽器
interface ExtendedIdleDeadline {
  timeRemaining(): number
  didTimeout: boolean
}

// 空閒處理器配置
interface IdleProcessorConfig {
  maxIdleTime: number // 最大空閒處理時間（毫秒）
  taskTimeout: number // 任務超時時間（毫秒）
  enableScheduling: boolean // 是否啟用任務調度
  batchSize: number // 批次處理大小
}

const DEFAULT_CONFIG: IdleProcessorConfig = {
  maxIdleTime: 50, // 50ms
  taskTimeout: 5000, // 5 seconds
  enableScheduling: true,
  batchSize: 3
}

export class IdleTimeProcessor {
  private taskQueue: IdleTask[] = []
  private isProcessing = false
  private config: IdleProcessorConfig
  private nextTaskId = 0
  
  // 響應式狀態
  public queueSize = ref(0)
  public isIdle = ref(false)
  public stats = ref({
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    averageProcessingTime: 0,
    totalIdleTime: 0
  })

  constructor(config?: Partial<IdleProcessorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.startIdleProcessing()
    this.setupPerformanceMonitoring()
  }

  // 檢查瀏覽器支援
  private get supportsRequestIdleCallback(): boolean {
    return typeof window !== 'undefined' && 'requestIdleCallback' in window
  }

  // Polyfill for requestIdleCallback
  private requestIdleCallback(
    callback: (_deadline: ExtendedIdleDeadline) => void,
    options?: { timeout?: number }
  ): number {
    if (this.supportsRequestIdleCallback) {
      return window.requestIdleCallback(callback, options)
    } else {
      // Fallback implementation
      const start = performance.now()
      return window.setTimeout(() => {
        callback({
          timeRemaining: () => Math.max(0, 16.67 - (performance.now() - start)),
          didTimeout: false
        })
      }, 1) as unknown as number
    }
  }

  // Polyfill for cancelIdleCallback
  // @ts-expect-error - 將來可能會使用
  private cancelIdleCallback(id: number): void {
    if (this.supportsRequestIdleCallback) {
      window.cancelIdleCallback(id)
    } else {
      window.clearTimeout(id)
    }
  }

  // 開始空閒處理
  private startIdleProcessing(): void {
    const processIdleTasks = (deadline: ExtendedIdleDeadline) => {
      this.isIdle.value = true
      const startTime = performance.now()
      
      // 批次處理任務
      let processedCount = 0
      const maxBatchSize = this.config.batchSize
      
      while (
        deadline.timeRemaining() > 1 && 
        this.taskQueue.length > 0 && 
        processedCount < maxBatchSize
      ) {
        const task = this.getNextTask()
        if (task) {
          this.processTask(task, deadline)
          processedCount++
        }
      }
      
      // 更新統計
      const idleTime = performance.now() - startTime
      this.stats.value.totalIdleTime += idleTime
      
      this.isIdle.value = false
      this.queueSize.value = this.taskQueue.length
      
      // 如果還有任務，繼續請求空閒時間
      if (this.taskQueue.length > 0) {
        this.requestIdleCallback(processIdleTasks, {
          timeout: this.config.maxIdleTime
        })
      } else {
        this.isProcessing = false
      }
    }

    // 啟動處理迴圈
    if (!this.isProcessing && this.taskQueue.length > 0) {
      this.isProcessing = true
      this.requestIdleCallback(processIdleTasks)
    }
  }

  // 根據優先級獲取下一個任務
  private getNextTask(): IdleTask | null {
    if (this.taskQueue.length === 0) {return null}
    
    // 按優先級和創建時間排序
    this.taskQueue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority // 高優先級優先
      }
      return a.createdAt - b.createdAt // 早創建的優先
    })
    
    return this.taskQueue.shift() || null
  }

  // 處理單個任務
  private async processTask(task: IdleTask, deadline: ExtendedIdleDeadline): Promise<void> {
    const startTime = performance.now()
    
    try {
      // 檢查任務是否超時
      if (task.timeout && Date.now() - task.createdAt > task.timeout) {
        throw new Error('Task timeout')
      }
      
      // 執行任務
      const result = await task.task(deadline)
      
      // 更新統計
      const processingTime = performance.now() - startTime
      this.updateStats(processingTime, true)
      
      task.resolve(result)
      this.stats.value.completedTasks++
      
    } catch (error) {
      console.error(`[IdleTimeProcessor] Task ${task.id} failed:`, error)
      task.reject(error instanceof Error ? error : new Error(String(error)))
      this.stats.value.failedTasks++
    }
  }

  // 更新統計信息
  private updateStats(processingTime: number, success: boolean): void {
    if (success) {
      const currentAvg = this.stats.value.averageProcessingTime
      const completed = this.stats.value.completedTasks
      this.stats.value.averageProcessingTime = 
        (currentAvg * completed + processingTime) / (completed + 1)
    }
  }

  // 設置性能監控
  private setupPerformanceMonitoring(): void {
    if (typeof window !== 'undefined' && 'globalThis.PerformanceObserver' in window) {
      try {
        const observer = new globalThis.PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach(entry => {
            if (entry.entryType === 'measure' && entry.name.includes('idle-task')) {
              // 監控空閒任務的性能
              console.log(`[IdleTimeProcessor] ${entry.name}: ${entry.duration}ms`)
            }
          })
        })
        
        observer.observe({ entryTypes: ['measure'] })
      } catch (error) {
        console.warn('[IdleTimeProcessor] Performance monitoring not available:', error)
      }
    }
  }

  // 調度任務
  scheduleTask<T>(
    taskFn: (_deadline: globalThis.IdleDeadline) => Promise<T> | T,
    priority: TaskPriority = TaskPriority._NORMAL,
    timeout?: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const taskId = `task_${++this.nextTaskId}`
      
      const task: IdleTask = {
        id: taskId,
        priority,
        task: taskFn as (_deadline: globalThis.IdleDeadline) => Promise<unknown> | unknown,
        resolve: resolve as (_result: unknown) => void,
        reject,
        timeout,
        createdAt: Date.now()
      }
      
      this.taskQueue.push(task)
      this.queueSize.value = this.taskQueue.length
      this.stats.value.totalTasks++
      
      // 啟動處理（如果尚未啟動）
      if (!this.isProcessing) {
        this.startIdleProcessing()
      }
    })
  }

  // 批次調度任務
  batchSchedule<T>(
    tasks: Array<{
      taskFn: (_deadline: globalThis.IdleDeadline) => Promise<T> | T
      priority?: TaskPriority
      timeout?: number
    }>
  ): Promise<T[]> {
    const promises = tasks.map(({ taskFn, priority, timeout }) =>
      this.scheduleTask(taskFn, priority, timeout)
    )
    
    return Promise.all(promises)
  }

  // 高優先級任務（立即執行）
  scheduleImmediate<T>(
    taskFn: () => Promise<T> | T
  ): Promise<T> {
    return this.scheduleTask(
      () => taskFn(),
      TaskPriority._CRITICAL,
      100 // 100ms timeout
    )
  }

  // 預載入任務（低優先級）
  schedulePreload<T>(
    taskFn: (_deadline: globalThis.IdleDeadline) => Promise<T> | T
  ): Promise<T> {
    return this.scheduleTask(taskFn, TaskPriority._LOW)
  }

  // 背景清理任務
  scheduleCleanup(
    taskFn: (_deadline: globalThis.IdleDeadline) => Promise<void> | void
  ): Promise<void> {
    return this.scheduleTask(taskFn, TaskPriority._LOW)
  }

  // 數據預處理任務
  scheduleDataPreprocessing<T>(
    taskFn: (_deadline: globalThis.IdleDeadline) => Promise<T> | T
  ): Promise<T> {
    return this.scheduleTask(taskFn, TaskPriority._NORMAL)
  }

  // 取消所有任務
  cancelAllTasks(): void {
    this.taskQueue.forEach(task => {
      task.reject(new Error('Task cancelled'))
    })
    
    this.taskQueue.length = 0
    this.queueSize.value = 0
    this.isProcessing = false
    
    console.log('[IdleTimeProcessor] All tasks cancelled')
  }

  // 取消特定優先級的任務
  cancelTasksByPriority(priority: TaskPriority): number {
    let cancelledCount = 0
    
    this.taskQueue = this.taskQueue.filter(task => {
      if (task.priority === priority) {
        task.reject(new Error(`Tasks with priority ${priority} cancelled`))
        cancelledCount++
        return false
      }
      return true
    })
    
    this.queueSize.value = this.taskQueue.length
    
    console.log(`[IdleTimeProcessor] Cancelled ${cancelledCount} tasks with priority ${priority}`)
    return cancelledCount
  }

  // 獲取性能統計
  getStats() {
    return {
      ...this.stats.value,
      queueSize: this.queueSize.value,
      isIdle: this.isIdle.value,
      isProcessing: this.isProcessing,
      supportsRequestIdleCallback: this.supportsRequestIdleCallback,
      config: this.config
    }
  }

  // 更新配置
  updateConfig(newConfig: Partial<IdleProcessorConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  // 清理資源
  destroy(): void {
    this.cancelAllTasks()
    console.log('[IdleTimeProcessor] Processor destroyed')
  }
}

// 創建全局實例
export const idleTimeProcessor = new IdleTimeProcessor()

// 便捷函數
export const scheduleIdleTask = <T>(
  taskFn: (_deadline: globalThis.IdleDeadline) => Promise<T> | T,
  priority: TaskPriority = TaskPriority._NORMAL
): Promise<T> => {
  return idleTimeProcessor.scheduleTask(taskFn, priority)
}

export const schedulePreloadTask = <T>(
  taskFn: (_deadline: globalThis.IdleDeadline) => Promise<T> | T
): Promise<T> => {
  return idleTimeProcessor.schedulePreload(taskFn)
}

export const scheduleCleanupTask = (
  taskFn: (_deadline: globalThis.IdleDeadline) => Promise<void> | void
): Promise<void> => {
  return idleTimeProcessor.scheduleCleanup(taskFn)
}