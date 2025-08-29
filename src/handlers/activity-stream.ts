// SSE 活動流處理器
import { Context } from 'hono'
import type { Bindings } from '../types'
import { ActivityService } from '../services/activity-service'
import { errorResponse } from '../utils/api-response'
import { verifyJWT } from '../utils/auth'

export const activityStreamHandler = {
  // 建立 SSE 連接
  async connect(c: Context<{ Bindings: Bindings }>) {
    try {
      // 檢查 JWT payload (透過 middleware 設置)
      let payload = c.get('jwtPayload')
      
      // 如果沒有 payload，嘗試從查詢參數獲取 token (用於 EventSource)
      if (!payload) {
        const queryToken = c.req.query('token')
        if (queryToken) {
          try {
            // 手動驗證 JWT token
            payload = await verifyJWT(queryToken, c.env.JWT_SECRET)
          } catch (error) {
            console.error('Invalid query token:', error)
            return errorResponse(c, 'Invalid token', 401)
          }
        }
      }
      
      if (!payload) {
        return errorResponse(c, 'Unauthorized', 401)
      }

      console.log(`🔗 SSE connection requested by user: ${payload.userId} (${payload.role})`)

      // 設置 SSE headers
      c.header('Content-Type', 'text/event-stream')
      c.header('Cache-Control', 'no-cache')
      c.header('Connection', 'keep-alive')
      c.header('Access-Control-Allow-Origin', '*')
      c.header('Access-Control-Allow-Headers', 'Authorization, Content-Type')

      // 創建 ReadableStream 用於 SSE
      const stream = new ReadableStream({
        start(controller) {
          console.log(`📡 Starting SSE stream for user: ${payload.userId}`)
          
          // 發送連接確認
          const encoder = new TextEncoder()
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'connected',
            message: 'Activity stream connected',
            timestamp: new Date().toISOString(),
            userId: payload.userId
          })}\n\n`))

          // 立即發送當前活動
          const sendCurrentActivities = async () => {
            try {
              const activities = await getRecentActivities(c.env, payload.role, payload.userId)
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'activities_update',
                data: activities,
                timestamp: new Date().toISOString()
              })}\n\n`))
              console.log(`📊 Sent ${activities.length} activities to user: ${payload.userId}`)
            } catch (error) {
              console.error('Failed to send initial activities:', error)
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'error',
                message: 'Failed to load activities',
                timestamp: new Date().toISOString()
              })}\n\n`))
            }
          }

          // 立即發送一次活動
          sendCurrentActivities()

          // 定期發送活動更新 (每15秒)
          const activityInterval = setInterval(async () => {
            try {
              const activities = await getRecentActivities(c.env, payload.role, payload.userId)
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'activities_update',
                data: activities,
                timestamp: new Date().toISOString()
              })}\n\n`))
            } catch (error) {
              console.error('Failed to fetch activities:', error)
            }
          }, 15000) // 15秒間隔

          // 心跳信號 (每30秒)
          const heartbeatInterval = setInterval(() => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'heartbeat',
              timestamp: new Date().toISOString()
            })}\n\n`))
          }, 30000) // 30秒心跳

          // 清理函數
          const cleanup = () => {
            console.log(`🔌 Cleaning up SSE stream for user: ${payload.userId}`)
            clearInterval(activityInterval)
            clearInterval(heartbeatInterval)
          }

          // 當流被關閉時清理
          return cleanup
        },

        cancel() {
          console.log(`❌ SSE stream cancelled for user: ${payload.userId}`)
        }
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        }
      })

    } catch (error) {
      console.error('SSE connection error:', error)
      return errorResponse(c, 'Failed to establish SSE connection', 500)
    }
  }
}

// 獲取最近活動的輔助函數
async function getRecentActivities(env: Bindings, userRole: string, userId: string) {
  const activityService = new ActivityService(env.DB)
  
  try {
    // 根據用戶角色決定查看權限
    const filters = userRole === 'admin' 
      ? { pageSize: 10, page: 1 } // 管理員可以看所有活動
      : { pageSize: 10, page: 1, userId } // 普通用戶只能看自己的活動
    
    const result = await activityService.getActivities(filters)
    return result.items
  } catch (error) {
    console.error('Failed to get recent activities:', error)
    return []
  }
}

// 廣播新活動到所有連接的客戶端
export async function broadcastActivity(env: Bindings, activity: any) {
  console.log('📢 [SSE Broadcast] Broadcasting new activity:', {
    action: activity.action,
    resourceType: activity.resourceType,
    resourceId: activity.resourceId,
    timestamp: activity.createdAt
  })
  
  // 將活動存儲到 KV，供 SSE 端點讀取
  try {
    if (env.CACHE) {
      const timestamp = Date.now()
      const activityKey = `recent_activity_${timestamp}`
      
      await env.CACHE.put(
        activityKey, 
        JSON.stringify({
          ...activity,
          broadcastTimestamp: timestamp
        }),
        { expirationTtl: 300 } // 5分鐘過期
      )
      
      // 存儲一個"最新活動"指標，讓 SSE 知道有新活動
      await env.CACHE.put(
        'latest_activity_broadcast',
        JSON.stringify({
          timestamp,
          activityId: activity.id,
          action: activity.action
        }),
        { expirationTtl: 300 }
      )
      
      console.log('✅ [SSE Broadcast] Activity cached successfully:', activityKey)
    } else {
      console.warn('⚠️ [SSE Broadcast] CACHE not available, cannot broadcast')
    }
  } catch (error) {
    console.error('❌ [SSE Broadcast] Failed to cache activity for broadcast:', error)
  }
}