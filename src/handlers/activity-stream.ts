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

      // 設置 SSE headers (CORS headers handled by main middleware)
      c.header('Content-Type', 'text/event-stream')
      c.header('Cache-Control', 'no-cache')
      c.header('Connection', 'keep-alive')

      // Create SSE stream with simplified structure
      const stream = createActivityStream(c.env, payload)

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      })

    } catch (error) {
      console.error('SSE connection error:', error)
      return errorResponse(c, 'Failed to establish SSE connection', 500)
    }
  }
}

// Helper functions for SSE stream management
function createActivityStream(env: Bindings, payload: any) {
  return new ReadableStream({
    start(controller) {
      console.log(`📡 Starting SSE stream for user: ${payload.userId}`)

      const encoder = new TextEncoder()
      const sendMessage = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      // Send connection confirmation
      sendMessage({
        type: 'connected',
        message: 'Activity stream connected',
        timestamp: new Date().toISOString(),
        userId: payload.userId
      })

      // Setup intervals
      const intervals = setupStreamIntervals(env, payload, sendMessage)

      return () => {
        console.log(`🔌 Cleaning up SSE stream for user: ${payload.userId}`)
        intervals.forEach(clearInterval)
      }
    },
    cancel() {
      console.log(`❌ SSE stream cancelled for user: ${payload.userId}`)
    }
  })
}

function setupStreamIntervals(env: Bindings, payload: any, sendMessage: Function) {
  // Send initial activities
  sendActivitiesUpdate(env, payload, sendMessage)

  // Activity updates every 20 seconds
  const activityInterval = setInterval(() => {
    sendActivitiesUpdate(env, payload, sendMessage)
  }, 20000)

  // Heartbeat every 30 seconds
  const heartbeatInterval = setInterval(() => {
    sendMessage({
      type: 'heartbeat',
      timestamp: new Date().toISOString()
    })
  }, 30000)

  return [activityInterval, heartbeatInterval]
}

async function sendActivitiesUpdate(env: Bindings, payload: any, sendMessage: Function) {
  try {
    const activities = await getRecentActivities(env, payload.role, payload.userId)
    sendMessage({
      type: 'activities_update',
      data: activities,
      timestamp: new Date().toISOString()
    })
    console.log(`📊 Sent ${activities.length} activities to user: ${payload.userId}`)
  } catch (error) {
    console.error('Failed to send activities:', error)
    sendMessage({
      type: 'error',
      message: 'Failed to load activities',
      timestamp: new Date().toISOString()
    })
  }
}

async function getRecentActivities(env: Bindings, userRole: string, userId: string) {
  const activityService = new ActivityService(env.DB)

  try {
    const filters = userRole === 'admin'
      ? { pageSize: 10, page: 1 }
      : { pageSize: 10, page: 1, userId }

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