// Activities Module - Formatting Utilities
// 活動模組 - 格式化工具

import { ActivityLog } from '@modules/activities/types/interfaces'

export class ActivityFormatter {
  /**
   * 格式化活動詳情為可讀文字
   */
  static formatActivityDescription(activity: ActivityLog): string {
    const { action, resourceType, details, userName } = activity

    switch (action) {
      case 'team_create':
        return `${userName} 創建了團隊「${details?.teamName || '未命名'}」`

      case 'team_update':
        return `${userName} 更新了團隊「${details?.teamName || '未命名'}」`

      case 'team_delete':
        return `${userName} 刪除了團隊「${details?.teamName || '未命名'}」`

      case 'member_add':
        return `${userName} 將 ${details?.addedAgentName || '成員'} 加入團隊「${details?.teamName || '未命名'}」`

      case 'member_remove':
        return `${userName} 從團隊「${details?.teamName || '未命名'}」移除了 ${details?.removedAgentName || '成員'}`

      case 'conversation_assign':
        return `${userName} 指派了對話給 ${details?.assignedTo || '某人'}`

      case 'conversation_close':
        return `${userName} 關閉了對話 ${details?.conversationId || ''}`

      case 'message_send':
        return `${userName} 發送了一條訊息`

      case 'message_recall':
        return `${userName} 撤回了一條訊息`

      case 'user_login':
        return `${userName} 登入系統`

      case 'user_logout':
        return `${userName} 登出系統`

      case 'qr_code_generate':
        return `${userName} 為團隊「${details?.teamName || '未命名'}」生成了 QR 碼`

      default:
        return `${userName} 執行了 ${action} 操作`
    }
  }

  /**
   * 格式化時間為相對時間
   */
  static formatRelativeTime(dateString: string): string {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMinutes < 1) {
      return '剛剛'
    } else if (diffMinutes < 60) {
      return `${diffMinutes} 分鐘前`
    } else if (diffHours < 24) {
      return `${diffHours} 小時前`
    } else if (diffDays < 7) {
      return `${diffDays} 天前`
    } else {
      return date.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    }
  }

  /**
   * 格式化用戶角色
   */
  static formatUserRole(role: string): string {
    switch (role) {
      case 'admin':
        return '系統管理員'
      case 'team':
        return '團隊領導'
      case 'agent':
        return '客服代表'
      default:
        return role
    }
  }

  /**
   * 格式化資源類型
   */
  static formatResourceType(resourceType: string): string {
    switch (resourceType) {
      case 'conversation':
        return '對話'
      case 'message':
        return '訊息'
      case 'user':
        return '用戶'
      case 'team':
        return '團隊'
      case 'customer':
        return '客戶'
      case 'system':
        return '系統'
      case 'file':
        return '檔案'
      case 'qr_code':
        return 'QR 碼'
      default:
        return resourceType
    }
  }

  /**
   * 格式化活動為簡潔摘要
   */
  static formatActivitySummary(activity: ActivityLog): {
    title: string
    description: string
    time: string
    category: string
  } {
    return {
      title: this.formatActivityDescription(activity),
      description: JSON.stringify(activity.details || {}, null, 2),
      time: this.formatRelativeTime(activity.createdAt),
      category: this.formatResourceType(activity.resourceType)
    }
  }

  /**
   * 格式化統計數據
   */
  static formatActivityStats(stats: Record<string, number>): Array<{
    action: string
    count: number
    percentage: number
    label: string
  }> {
    const total = Object.values(stats).reduce((sum, count) => sum + count, 0)

    return Object.entries(stats).map(([action, count]) => ({
      action,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      label: this.formatActionLabel(action)
    })).sort((a, b) => b.count - a.count)
  }

  /**
   * 格式化動作標籤
   */
  private static formatActionLabel(action: string): string {
    const actionLabels: Record<string, string> = {
      'team_create': '創建團隊',
      'team_update': '更新團隊',
      'team_delete': '刪除團隊',
      'member_add': '加入成員',
      'member_remove': '移除成員',
      'conversation_assign': '指派對話',
      'conversation_close': '關閉對話',
      'message_send': '發送訊息',
      'message_recall': '撤回訊息',
      'user_login': '用戶登入',
      'user_logout': '用戶登出',
      'qr_code_generate': '生成 QR 碼'
    }

    return actionLabels[action] || action
  }
}