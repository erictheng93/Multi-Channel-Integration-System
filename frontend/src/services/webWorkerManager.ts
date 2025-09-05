// Web Worker 管理服務
// 提供高效的背景數據處理能力

import { ref } from 'vue'
import type { Conversation } from '@/types'

// Worker 消息接口
interface WorkerMessage {
  id: string
  type: string
  payload: unknown
}

interface WorkerResponse {
  id: string
  type: string
  result?: unknown
  error?: string
  performance?: {
    processingTime: number
    memoryUsage: number
  }
}

// Worker 任務接口
interface WorkerTask {
  id: string
  type: string
  payload: unknown
  resolve: (result: unknown) => void
  reject: (error: Error) => void
  timeout?: NodeJS.Timeout
}

// Worker 池配置
interface WorkerPoolConfig {
  maxWorkers: number
  taskTimeout: number
  enablePerformanceMonitoring: boolean
  autoScaling: boolean
}

const DEFAULT_CONFIG: WorkerPoolConfig = {
  maxWorkers: Math.max(1, Math.floor(navigator.hardwareConcurrency / 2)),
  taskTimeout: 30000, // 30 seconds
  enablePerformanceMonitoring: true,
  autoScaling: true
}

export class WebWorkerManager {
  private workers: Worker[] = []
  private workerQueue: WorkerTask[] = []
  private activeTasks = new Map<string, WorkerTask>()
  private config: WorkerPoolConfig
  private workerIndex = 0
  
  // 響應式狀態
  public isReady = ref(false)
  public activeWorkers = ref(0)
  public queueSize = ref(0)
  public stats = ref({
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    averageProcessingTime: 0,
    totalMemoryUsage: 0
  })

  constructor(config?: Partial<WorkerPoolConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.initializeWorkerPool()
  }

  // 初始化 Worker 池
  private async initializeWorkerPool() {
    try {
      const workerPromises = []
      
      for (let i = 0; i < this.config.maxWorkers; i++) {
        const worker = new Worker(
          new URL('../workers/dataProcessor.worker.ts', import.meta.url),
          { type: 'module' }
        )
        
        workerPromises.push(this.initializeWorker(worker, i))
        this.workers.push(worker)
      }
      
      await Promise.all(workerPromises)
      this.activeWorkers.value = this.workers.length
      this.isReady.value = true
      
      console.log(`🏭 [WebWorkerManager] Initialized ${this.workers.length} workers`)
      
    } catch (error) {
      console.error('❌ [WebWorkerManager] Failed to initialize worker pool:', error)
    }
  }

  // 初始化單個 Worker
  private initializeWorker(worker: Worker, index: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Worker ${index} initialization timeout`))
      }, 5000)

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const { id, type, result, error, performance } = event.data
        
        if (type === 'WORKER_READY') {
          clearTimeout(timeout)
          resolve()
          return
        }
        
        this.handleWorkerResponse(id, result, error, performance)
      }
      
      worker.onerror = (error) => {
        console.error(`❌ [WebWorkerManager] Worker ${index} error:`, error)
        clearTimeout(timeout)
        reject(error)
      }
    })
  }

  // 處理 Worker 響應
  private handleWorkerResponse(
    taskId: string, 
    result?: unknown, 
    error?: string, 
    performance?: { processingTime: number; memoryUsage: number }
  ) {
    const task = this.activeTasks.get(taskId)
    if (!task) {return}

    this.activeTasks.delete(taskId)
    this.queueSize.value = this.workerQueue.length + this.activeTasks.size

    // 清除超時定時器
    if (task.timeout) {
      clearTimeout(task.timeout)
    }

    // 更新統計
    if (performance) {
      this.updateStats(performance, !error)
    }

    if (error) {
      this.stats.value.failedTasks++
      task.reject(new Error(error))
    } else {
      this.stats.value.completedTasks++
      task.resolve(result)
    }

    // 處理隊列中的下一個任務
    this.processQueue()
  }

  // 更新統計信息
  private updateStats(performance: { processingTime: number; memoryUsage: number }, success: boolean) {
    this.stats.value.totalMemoryUsage = performance.memoryUsage
    
    if (success) {
      const currentAvg = this.stats.value.averageProcessingTime
      const completed = this.stats.value.completedTasks
      this.stats.value.averageProcessingTime = 
        (currentAvg * completed + performance.processingTime) / (completed + 1)
    }
  }

  // 處理任務隊列
  private processQueue() {
    if (this.workerQueue.length === 0) {return}
    
    // 找到可用的 Worker
    const availableWorker = this.getAvailableWorker()
    if (!availableWorker) {return}
    
    const task = this.workerQueue.shift()
    if (!task) {return}
    
    this.activeTasks.set(task.id, task)
    this.queueSize.value = this.workerQueue.length + this.activeTasks.size

    // 設置超時
    if (this.config.taskTimeout > 0) {
      task.timeout = setTimeout(() => {
        this.handleWorkerResponse(task.id, undefined, 'Task timeout')
      }, this.config.taskTimeout)
    }

    // 發送任務到 Worker
    const message: WorkerMessage = {
      id: task.id,
      type: task.type,
      payload: task.payload
    }
    
    availableWorker.postMessage(message)
  }

  // 獲取可用的 Worker
  private getAvailableWorker(): Worker | null {
    if (this.workers.length === 0) {return null}
    
    // 簡單的輪詢策略
    const worker = this.workers[this.workerIndex % this.workers.length]
    this.workerIndex++
    
    return worker || null
  }

  // 生成任務 ID
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // 執行任務
  private executeTask<T>(type: string, payload: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.isReady.value) {
        reject(new Error('Worker pool not ready'))
        return
      }

      const task: WorkerTask = {
        id: this.generateTaskId(),
        type,
        payload,
        resolve: resolve as (result: unknown) => void,
        reject
      }

      this.stats.value.totalTasks++
      
      // 如果有可用 Worker，立即處理；否則加入隊列
      if (this.activeTasks.size < this.workers.length) {
        this.activeTasks.set(task.id, task)
        this.processQueue()
      } else {
        this.workerQueue.push(task)
        this.queueSize.value = this.workerQueue.length + this.activeTasks.size
      }
    })
  }

  // 處理對話數據
  async processConversations(rawData: unknown[]): Promise<Conversation[]> {
    return this.executeTask<Conversation[]>('PROCESS_CONVERSATIONS', rawData)
  }

  // 過濾對話
  async filterConversations(
    conversations: Conversation[], 
    filters: {
      status?: string
      platform?: string
      assignedTo?: string
      search?: string
      dateRange?: { start: Date; end: Date }
      tags?: string[]
      priority?: string
    }
  ): Promise<Conversation[]> {
    return this.executeTask<Conversation[]>('FILTER_CONVERSATIONS', { conversations, filters })
  }

  // 排序對話
  async sortConversations(
    conversations: Conversation[], 
    sortBy: 'lastMessageAt' | 'createdAt' | 'customerName' | 'unreadCount' | 'priority',
    order: 'asc' | 'desc' = 'desc'
  ): Promise<Conversation[]> {
    return this.executeTask<Conversation[]>('SORT_CONVERSATIONS', { conversations, sortBy, order })
  }

  // 搜索對話
  async searchConversations(conversations: Conversation[], query: string): Promise<Conversation[]> {
    return this.executeTask<Conversation[]>('SEARCH_CONVERSATIONS', { conversations, query })
  }

  // 聚合統計
  async aggregateStats(conversations: Conversation[]): Promise<{
    total: number
    unread: number
    byStatus: Record<string, number>
    byPlatform: Record<string, number>
    byAssignee: Record<string, number>
    overdue: number
    avgResponseTime: number
    topTags: Record<string, number>
  }> {
    return this.executeTask('AGGREGATE_STATS', conversations)
  }

  // 批量處理（並行）
  async batchProcess<T>(
    tasks: Array<{ type: string; payload: unknown }>
  ): Promise<T[]> {
    const promises = tasks.map(task => this.executeTask<T>(task.type, task.payload))
    return Promise.all(promises)
  }

  // 取消所有任務
  cancelAllTasks(): void {
    // 清除隊列
    this.workerQueue.length = 0
    
    // 取消活動任務
    for (const [_taskId, task] of this.activeTasks) {
      if (task.timeout) {
        clearTimeout(task.timeout)
      }
      task.reject(new Error('Task cancelled'))
    }
    
    this.activeTasks.clear()
    this.queueSize.value = 0
    
    console.log('🚫 [WebWorkerManager] All tasks cancelled')
  }

  // 擴展 Worker 池
  // @ts-expect-error - 將來可能會使用
  private async scaleUp(): Promise<void> {
    if (!this.config.autoScaling || this.workers.length >= navigator.hardwareConcurrency) {
      return
    }
    
    try {
      const worker = new Worker(
        new URL('../workers/dataProcessor.worker.ts', import.meta.url),
        { type: 'module' }
      )
      
      await this.initializeWorker(worker, this.workers.length)
      this.workers.push(worker)
      this.activeWorkers.value = this.workers.length
      
      console.log(`📈 [WebWorkerManager] Scaled up to ${this.workers.length} workers`)
    } catch (error) {
      console.error('❌ [WebWorkerManager] Failed to scale up:', error)
    }
  }

  // 縮減 Worker 池
  // @ts-expect-error - 將來可能會使用
  private scaleDown(): void {
    if (!this.config.autoScaling || this.workers.length <= 1) {
      return
    }
    
    const worker = this.workers.pop()
    if (worker) {
      worker.terminate()
      this.activeWorkers.value = this.workers.length
      
      console.log(`📉 [WebWorkerManager] Scaled down to ${this.workers.length} workers`)
    }
  }

  // 獲取性能統計
  getPerformanceStats() {
    return {
      ...this.stats.value,
      activeWorkers: this.activeWorkers.value,
      queueSize: this.queueSize.value,
      isReady: this.isReady.value,
      config: this.config
    }
  }

  // 銷毀 Worker 池
  destroy(): void {
    this.cancelAllTasks()
    
    this.workers.forEach(worker => {
      worker.terminate()
    })
    
    this.workers.length = 0
    this.activeWorkers.value = 0
    this.isReady.value = false
    
    console.log('🔴 [WebWorkerManager] Worker pool destroyed')
  }
}

// 創建全局實例
export const webWorkerManager = new WebWorkerManager()

// 在頁面卸載時清理
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    webWorkerManager.destroy()
  })
}