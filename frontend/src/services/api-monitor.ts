// import { apiClient } from '../api/client'

export interface ApiEndpointStatus {
  id: string
  endpoint: string
  method: string
  category: string
  description: string
  status: 'healthy' | 'warning' | 'error' | 'unknown'
  responseTime: number
  avgResponseTime: number
  successRate: number
  requestCount: number
  errorCount: number
  lastCheck: Date
  error?: string
  errorTime?: Date
  uptime?: number
  downtime?: number
}

export interface ApiMonitorStats {
  totalEndpoints: number
  healthyCount: number
  warningCount: number
  errorCount: number
  avgResponseTime: number
  overallSuccessRate: number
  systemStatus: 'healthy' | 'degraded' | 'down'
}

class ApiMonitorService {
  private endpoints: Map<string, ApiEndpointStatus> = new Map()
  private historyData: Map<string, { time: Date, responseTime: number, success: boolean }[]> = new Map()
  private maxHistoryLength = 100

  // 預定義的API端點列表
  private readonly endpointDefinitions = [
    // 系統相關
    {
      id: 'system-health',
      endpoint: '/api/system/health',
      method: 'GET',
      category: 'system',
      description: '系統健康檢查',
      requiresAuth: false
    },
    {
      id: 'system-info',
      endpoint: '/api/system/info',
      method: 'GET',
      category: 'system',
      description: '獲取系統信息',
      requiresAuth: true
    },
    {
      id: 'system-metrics',
      endpoint: '/api/system/metrics',
      method: 'GET',
      category: 'system',
      description: '系統性能指標',
      requiresAuth: true
    },
    
    // 認證相關
    {
      id: 'auth-login',
      endpoint: '/api/auth/login',
      method: 'POST',
      category: 'auth',
      description: '用戶登入',
      requiresAuth: false
    },
    {
      id: 'auth-refresh',
      endpoint: '/api/auth/refresh',
      method: 'POST',
      category: 'auth',
      description: '刷新令牌',
      requiresAuth: true
    },
    
    // 對話相關
    {
      id: 'conversations-list',
      endpoint: '/api/conversations',
      method: 'GET',
      category: 'conversation',
      description: '獲取對話列表',
      requiresAuth: true
    },
    {
      id: 'conversations-create',
      endpoint: '/api/conversations',
      method: 'POST',
      category: 'conversation',
      description: '創建新對話',
      requiresAuth: true
    },
    
    // 客戶相關
    {
      id: 'customers-list',
      endpoint: '/api/customers',
      method: 'GET',
      category: 'customer',
      description: '獲取客戶列表',
      requiresAuth: true
    },
    
    // 團隊相關
    {
      id: 'team-members',
      endpoint: '/api/team/members',
      method: 'GET',
      category: 'team',
      description: '獲取團隊成員',
      requiresAuth: true
    },
    
    // 延遲訊息
    {
      id: 'delayed-messages',
      endpoint: '/api/delayed-messages',
      method: 'GET',
      category: 'message',
      description: '獲取延遲訊息',
      requiresAuth: true
    },
    
    // Webhook
    {
      id: 'webhook',
      endpoint: '/api/webhook',
      method: 'POST',
      category: 'integration',
      description: 'LINE Webhook端點',
      requiresAuth: false
    }
  ]

  constructor() {
    this.initializeEndpoints()
  }

  private initializeEndpoints(): void {
    this.endpointDefinitions.forEach(def => {
      this.endpoints.set(def.id, {
        id: def.id,
        endpoint: def.endpoint,
        method: def.method,
        category: def.category,
        description: def.description,
        status: 'unknown',
        responseTime: 0,
        avgResponseTime: 0,
        successRate: 100,
        requestCount: 0,
        errorCount: 0,
        lastCheck: new Date(),
        uptime: 0,
        downtime: 0
      })
      
      this.historyData.set(def.id, [])
    })
  }

  /**
   * 檢查單個API端點狀態
   */
  async checkEndpoint(id: string): Promise<ApiEndpointStatus | null> {
    const endpoint = this.endpoints.get(id)
    const definition = this.endpointDefinitions.find(d => d.id === id)
    
    if (!endpoint || !definition) {
      return null
    }

    const startTime = Date.now()
    let success = false
    let error: string | undefined

    try {
      let response: Response

      if (definition.requiresAuth) {
        // 對於需要認證的API，我們只檢查端點是否存在
        response = await fetch(definition.endpoint, { method: 'HEAD' })
        
        // 如果是401錯誤，說明端點存在但需要認證，這是正常的
        if (response.status === 401) {
          success = true
        }
      } else {
        // 對於不需要認證的API，直接調用
        if (definition.endpoint === '/api/system/health') {
          response = await fetch(definition.endpoint)
        } else {
          response = await fetch(definition.endpoint, { method: 'HEAD' })
        }
      }

      const responseTime = Date.now() - startTime
      
      // 判斷成功標準
      if (definition.requiresAuth && response.status === 401) {
        // 認證端點返回401表示端點正常工作
        success = true
      } else if (response.ok) {
        success = true
      } else if (response.status >= 400 && response.status < 500) {
        // 4xx錯誤可能是正常的業務邏輯錯誤
        success = true
        if (response.status !== 401) {
          error = `HTTP ${response.status}`
        }
      } else {
        success = false
        error = `HTTP ${response.status}`
      }

      // 更新端點狀態
      this.updateEndpointStatus(id, {
        responseTime,
        success,
        error
      })

    } catch (err) {
      const responseTime = Date.now() - startTime
      success = false
      error = err instanceof Error ? err.message : '網絡錯誤'
      
      this.updateEndpointStatus(id, {
        responseTime,
        success,
        error
      })
    }

    return this.endpoints.get(id) || null
  }

  /**
   * 檢查所有API端點狀態
   */
  async checkAllEndpoints(): Promise<ApiEndpointStatus[]> {
    const results = await Promise.allSettled(
      Array.from(this.endpoints.keys()).map(id => this.checkEndpoint(id))
    )

    return results
      .filter((result): result is PromiseFulfilledResult<ApiEndpointStatus | null> => 
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value!)
  }

  /**
   * 更新端點狀態
   */
  private updateEndpointStatus(id: string, result: {
    responseTime: number
    success: boolean
    error?: string
  }): void {
    const endpoint = this.endpoints.get(id)
    if (!endpoint) {return}

    const now = new Date()
    
    // 更新基本統計
    endpoint.requestCount++
    endpoint.lastCheck = now
    endpoint.responseTime = result.responseTime
    
    // 計算移動平均響應時間
    if (endpoint.avgResponseTime === 0) {
      endpoint.avgResponseTime = result.responseTime
    } else {
      endpoint.avgResponseTime = Math.round(
        (endpoint.avgResponseTime * 0.7) + (result.responseTime * 0.3)
      )
    }

    // 更新成功/失敗統計
    if (result.success) {
      endpoint.successRate = Math.min(100, 
        Math.round((endpoint.successRate * 0.9) + 10)
      )
      endpoint.error = undefined
      endpoint.errorTime = undefined
    } else {
      endpoint.errorCount++
      endpoint.successRate = Math.max(0, 
        Math.round(endpoint.successRate * 0.9)
      )
      endpoint.error = result.error
      endpoint.errorTime = now
    }

    // 確定狀態
    if (!result.success) {
      endpoint.status = 'error'
    } else if (result.responseTime > 2000) {
      endpoint.status = 'error'
    } else if (result.responseTime > 1000 || endpoint.successRate < 95) {
      endpoint.status = 'warning'
    } else {
      endpoint.status = 'healthy'
    }

    // 添加到歷史記錄
    this.addToHistory(id, {
      time: now,
      responseTime: result.responseTime,
      success: result.success
    })
  }

  /**
   * 添加歷史記錄
   */
  private addToHistory(id: string, data: { time: Date, responseTime: number, success: boolean }): void {
    const history = this.historyData.get(id) || []
    history.push(data)
    
    // 限制歷史記錄長度
    if (history.length > this.maxHistoryLength) {
      history.shift()
    }
    
    this.historyData.set(id, history)
  }

  /**
   * 獲取所有端點狀態
   */
  getAllEndpoints(): ApiEndpointStatus[] {
    return Array.from(this.endpoints.values())
  }

  /**
   * 獲取特定端點狀態
   */
  getEndpoint(id: string): ApiEndpointStatus | null {
    return this.endpoints.get(id) || null
  }

  /**
   * 獲取端點歷史數據
   */
  getEndpointHistory(id: string): { time: Date, responseTime: number, success: boolean }[] {
    return this.historyData.get(id) || []
  }

  /**
   * 獲取監控統計
   */
  getStats(): ApiMonitorStats {
    const endpoints = Array.from(this.endpoints.values())
    const total = endpoints.length
    
    const healthyCount = endpoints.filter(e => e.status === 'healthy').length
    const warningCount = endpoints.filter(e => e.status === 'warning').length
    const errorCount = endpoints.filter(e => e.status === 'error').length
    
    const totalResponseTime = endpoints.reduce((sum, e) => sum + e.avgResponseTime, 0)
    const avgResponseTime = total > 0 ? Math.round(totalResponseTime / total) : 0
    
    const totalSuccessRate = endpoints.reduce((sum, e) => sum + e.successRate, 0)
    const overallSuccessRate = total > 0 ? Math.round(totalSuccessRate / total) : 100
    
    // 系統整體狀態
    let systemStatus: 'healthy' | 'degraded' | 'down' = 'healthy'
    if (errorCount > total * 0.5) {
      systemStatus = 'down'
    } else if (errorCount > 0 || warningCount > total * 0.3) {
      systemStatus = 'degraded'
    }
    
    return {
      totalEndpoints: total,
      healthyCount,
      warningCount,
      errorCount,
      avgResponseTime,
      overallSuccessRate,
      systemStatus
    }
  }

  /**
   * 重置統計數據
   */
  resetStats(): void {
    this.endpoints.forEach(endpoint => {
      endpoint.requestCount = 0
      endpoint.errorCount = 0
      endpoint.successRate = 100
      endpoint.avgResponseTime = 0
      endpoint.uptime = 0
      endpoint.downtime = 0
      endpoint.status = 'unknown'
    })
    
    this.historyData.forEach((_, key) => {
      this.historyData.set(key, [])
    })
  }

  /**
   * 獲取系統健康度評分 (0-100)
   */
  getHealthScore(): number {
    const stats = this.getStats()
    
    // 基於多個因素計算健康度評分
    const statusWeight = 0.4  // 狀態權重
    const responseTimeWeight = 0.3  // 響應時間權重
    const successRateWeight = 0.3  // 成功率權重
    
    // 狀態評分
    const statusScore = (
      (stats.healthyCount * 100) + 
      (stats.warningCount * 60) + 
      (stats.errorCount * 0)
    ) / stats.totalEndpoints
    
    // 響應時間評分
    let responseTimeScore = 100
    if (stats.avgResponseTime > 2000) {
      responseTimeScore = 0
    } else if (stats.avgResponseTime > 1000) {
      responseTimeScore = 50
    } else if (stats.avgResponseTime > 500) {
      responseTimeScore = 80
    }
    
    // 成功率評分
    const successRateScore = stats.overallSuccessRate
    
    return Math.round(
      (statusScore * statusWeight) +
      (responseTimeScore * responseTimeWeight) +
      (successRateScore * successRateWeight)
    )
  }
}

// 創建單例實例
export const apiMonitorService = new ApiMonitorService()

// 導出類型和服務
export { ApiMonitorService }
export default apiMonitorService