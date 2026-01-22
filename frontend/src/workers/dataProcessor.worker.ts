// 數據處理 Web Worker
// 在背景執行重CPU任務，保持主線程流暢

import type { Conversation } from '@/types'

// Worker 消息類型
interface WorkerMessage {
  id: string
  type: 'PROCESS_CONVERSATIONS' | 'FILTER_CONVERSATIONS' | 'SORT_CONVERSATIONS' | 'SEARCH_CONVERSATIONS' | 'AGGREGATE_STATS'
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

// 性能監控
function measurePerformance<T>(fn: () => T): { result: T; processingTime: number } {
  const startTime = performance.now()
  const result = fn()
  const processingTime = performance.now() - startTime
  return { result, processingTime }
}

// 處理對話列表數據
// Note: Individual assignment (assignedTo, assignedAgent) removed - only team assignment is supported now
function processConversations(conversations: unknown[]): Conversation[] {
  return conversations.map((conv: unknown) => {
    const conversation = conv as Record<string, unknown>
    // 數據標準化和清理
    return {
      id: conversation.id || '',
      userId: conversation.userId || conversation.customerId || conversation.customer_id || '',
      user: conversation.user || {
        id: conversation.customerId || conversation.customer_id || '',
        name: conversation.customerName || conversation.customer_name || 'Unknown Customer',
        platform: conversation.platform || 'line',
        platformUserId: conversation.customerId || conversation.customer_id || '',
        createdAt: Date.now()
      },
      assignedTeamId: conversation.assignedTeamId || conversation.assigned_team_id,
      assignedTeam: conversation.assignedTeam,
      status: conversation.status || 'open',
      platform: conversation.platform || 'line',
      lastMessageAt: conversation.lastMessageAt ? new Date(conversation.lastMessageAt as string).getTime() : Date.now(),
      lastMessage: conversation.lastMessage,
      unreadCount: parseInt(String(conversation.unreadCount || conversation.unread_count || '0')),
      createdAt: conversation.createdAt ? new Date(conversation.createdAt as string) : new Date(),
      updatedAt: conversation.updatedAt ? new Date(conversation.updatedAt as string) : new Date()
    } as Conversation
  })
}

// 過濾對話
// Note: Individual assignment filter (assignedTo) removed - only team-based filtering is supported now
function filterConversations(
  conversations: Conversation[],
  filters: {
    status?: string
    platform?: string
    teamId?: number
    search?: string
    dateRange?: { start: Date; end: Date }
    tags?: string[]
    priority?: string
  }
): Conversation[] {
  return conversations.filter(conv => {
    // 狀態過濾
    if (filters.status && conv.status !== filters.status) {
      return false
    }

    // 平台過濾
    if (filters.platform && conv.platform !== filters.platform) {
      return false
    }

    // 團隊過濾 (replacing individual assignment filter)
    if (filters.teamId !== undefined) {
      if (filters.teamId === 0 && conv.assignedTeamId) {
        // teamId=0 means unassigned
        return false
      }
      if (filters.teamId !== 0 && conv.assignedTeamId !== filters.teamId) {
        return false
      }
    }
    
    // 搜索過濾
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const searchText = [
        conv.user?.name || '',
        typeof conv.lastMessage === 'string' ? conv.lastMessage : conv.lastMessage?.content || '',
        conv.platform || ''
      ].join(' ').toLowerCase()
      
      if (!searchText.includes(searchLower)) {
        return false
      }
    }
    
    // 日期範圍過濾
    if (filters.dateRange) {
      const messageDate = new Date(conv.lastMessageAt)
      if (messageDate < filters.dateRange.start || messageDate > filters.dateRange.end) {
        return false
      }
    }
    
    // 標籤過濾 (暫時跳過，因為基本的 Conversation 類型沒有 tags)
    if (filters.tags && filters.tags.length > 0) {
      // 可以在擴展的對話類型中添加 tags 支持
      // const hasMatchingTag = filters.tags.some(tag => conv.tags?.includes(tag))
      // if (!hasMatchingTag) {
      //   return false
      // }
    }
    
    // 優先級過濾 (暫時跳過，因為基本的 Conversation 類型沒有 priority)
    // if (filters.priority && conv.priority !== filters.priority) {
    //   return false
    // }
    
    return true
  })
}

// 排序對話
function sortConversations(
  conversations: Conversation[], 
  sortBy: 'lastMessageAt' | 'createdAt' | 'customerName' | 'unreadCount' | 'priority',
  order: 'asc' | 'desc' = 'desc'
): Conversation[] {
  return [...conversations].sort((a, b) => {
    let comparison = 0
    
    switch (sortBy) {
      case 'lastMessageAt':
        comparison = new Date(a.lastMessageAt).getTime() - new Date(b.lastMessageAt).getTime()
        break
      case 'createdAt':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        break
      case 'customerName': {
        const nameA = a.user?.name || ''
        const nameB = b.user?.name || ''
        comparison = nameA.localeCompare(nameB)
        break
      }
      case 'unreadCount':
        comparison = a.unreadCount - b.unreadCount
        break
      case 'priority':
        // 暫時跳過優先級排序，因為基本的 Conversation 類型沒有 priority
        comparison = 0
        break
    }
    
    return order === 'desc' ? -comparison : comparison
  })
}

// 搜索對話（模糊搜索）
function searchConversations(conversations: Conversation[], query: string): Conversation[] {
  if (!query.trim()) {return conversations}
  
  const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0)
  
  return conversations
    .map(conv => {
      // 計算相關性分數
      let score = 0
      
      searchTerms.forEach(term => {
        // 客戶名稱匹配（高權重）
        const customerName = conv.user?.name || ''
        if (customerName.toLowerCase().includes(term)) {
          score += 10
        }
        
        // 最後訊息匹配
        const lastMessageText = typeof conv.lastMessage === 'string' 
          ? conv.lastMessage 
          : conv.lastMessage?.content || ''
        if (lastMessageText.toLowerCase().includes(term)) {
          score += 5
        }
        
        // 平台匹配
        if (conv.platform && conv.platform.toLowerCase().includes(term)) {
          score += 3
        }
        
        // 標籤匹配 (暫時跳過)
        // if (conv.tags?.some(tag => tag.toLowerCase().includes(term))) {
        //   score += 7
        // }
        
        // 全文匹配（低權重）
        const searchText = [customerName, lastMessageText, conv.platform || ''].join(' ').toLowerCase()
        if (searchText.includes(term)) {
          score += 1
        }
      })
      
      return { conversation: conv, score }
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.conversation)
}

// 聚合統計數據
function aggregateStats(conversations: Conversation[]) {
  const stats = {
    total: conversations.length,
    unread: 0,
    byStatus: {} as Record<string, number>,
    byPlatform: {} as Record<string, number>,
    byAssignee: {} as Record<string, number>,
    overdue: 0,
    avgResponseTime: 0,
    topTags: {} as Record<string, number>
  }
  
  let totalResponseTime = 0
  
  conversations.forEach(conv => {
    // 未讀統計
    if (conv.unreadCount > 0) {
      stats.unread++
    }
    
    // 狀態統計
    stats.byStatus[conv.status] = (stats.byStatus[conv.status] || 0) + 1
    
    // 平台統計
    if (conv.platform) {
      stats.byPlatform[conv.platform] = (stats.byPlatform[conv.platform] || 0) + 1
    }
    
    // 團隊統計 (replacing individual assignment)
    const teamName = conv.assignedTeam?.name || 'Unassigned'
    stats.byAssignee[teamName] = (stats.byAssignee[teamName] || 0) + 1
    
    // 逾期統計 (計算超過24小時的對話)
    const lastMessageTime = new Date(conv.lastMessageAt).getTime()
    const now = Date.now()
    const hoursDiff = (now - lastMessageTime) / (1000 * 60 * 60)
    if (hoursDiff > 24) {
      stats.overdue++
    }
    
    // 回應時間統計 (暫時設為0，需要額外計算)
    totalResponseTime += 0
    
    // 標籤統計 (暫時跳過)
    // conv.tags?.forEach(tag => {
    //   stats.topTags[tag] = (stats.topTags[tag] || 0) + 1
    // })
  })
  
  // 計算平均回應時間
  if (conversations.length > 0) {
    stats.avgResponseTime = totalResponseTime / conversations.length
  }
  
  return stats
}

// 消息處理器
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { id, type, payload } = event.data
  
  try {
    let result: unknown
    let processingTime: number
    
    switch (type) {
      case 'PROCESS_CONVERSATIONS':
        ({ result, processingTime } = measurePerformance(() => 
          processConversations(payload as unknown[])
        ))
        break
        
      case 'FILTER_CONVERSATIONS': {
        const { conversations, filters } = payload as { 
          conversations: Conversation[]
          filters: Parameters<typeof filterConversations>[1] 
        }
        ({ result, processingTime } = measurePerformance(() => 
          filterConversations(conversations, filters)
        ))
        break
      }
        
      case 'SORT_CONVERSATIONS': {
        const { conversations: sortConvs, sortBy, order } = payload as {
          conversations: Conversation[]
          sortBy: Parameters<typeof sortConversations>[1]
          order: Parameters<typeof sortConversations>[2]
        }
        ({ result, processingTime } = measurePerformance(() => 
          sortConversations(sortConvs, sortBy, order)
        ))
        break
      }
        
      case 'SEARCH_CONVERSATIONS': {
        const { conversations: searchConvs, query } = payload as {
          conversations: Conversation[]
          query: string
        }
        ({ result, processingTime } = measurePerformance(() => 
          searchConversations(searchConvs, query)
        ))
        break
      }
        
      case 'AGGREGATE_STATS':
        ({ result, processingTime } = measurePerformance(() => 
          aggregateStats(payload as Conversation[])
        ))
        break
        
      default:
        throw new Error(`Unknown message type: ${type}`)
    }
    
    const response: WorkerResponse = {
      id,
      type,
      result,
      performance: {
        processingTime,
        memoryUsage: (self as unknown as { performance?: { memory?: { usedJSHeapSize?: number } } }).performance?.memory?.usedJSHeapSize || 0
      }
    }
    
    self.postMessage(response)
    
  } catch (error) {
    const response: WorkerResponse = {
      id,
      type,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
    
    self.postMessage(response)
  }
}

// Worker 就緒通知
self.postMessage({
  id: 'worker-ready',
  type: 'WORKER_READY',
  result: true
})