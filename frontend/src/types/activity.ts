/**
 * Activity Stream Types
 * 活动流类型定义 - 用于Dashboard实时活动展示
 */

export type ActivityType =
  | 'message'           // 新消息
  | 'assignment'        // 对话分配
  | 'resolved'          // 对话解决
  | 'urgent'            // 紧急事件
  | 'system-error'      // 系统错误
  | 'system-success'    // 系统成功
  | 'system-warning'    // 系统警告
  | 'system-info'       // 系统信息
  | 'user'              // 用户活动
  | 'settings'          // 设置变更
  | 'settings-critical' // 关键设置变更

export type ActivityPriority = 'low' | 'medium' | 'high'

export interface Activity {
  id: string
  type: ActivityType
  priority: ActivityPriority
  title: string
  description: string
  createdAt: Date
  userId?: string
  userName?: string
  conversationId?: string
  metadata?: Record<string, unknown>
}

export interface ActivityStreamEvent {
  type: 'activity' | 'bulk_activities'
  data: Activity | Activity[]
  timestamp: number
}
