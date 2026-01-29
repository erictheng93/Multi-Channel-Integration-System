# WebSocket Technical Risk Analysis & Fallback Measures

**Document Purpose**: Professional Tech Lead analysis of production risks in Single WebSocket architecture

**Scope**: Phase B3-B5 WebSocket migration completion

**Date**: 2025-01-07

---

## Executive Summary

This document analyzes the **5 major technical risks** introduced by the Single WebSocket architecture migration and provides **production-ready fallback measures** and **comprehensive monitoring solutions** for rapid debugging.

**Risk Assessment**:
- 🔴 **Highest Risk (P0)**: Single Point of Failure
- 🟠 **High Risk (P0)**: Message Loss during disconnections
- 🟠 **High Risk (P1)**: Memory leaks from subscription management
- 🟡 **Medium Risk (P1)**: Concurrent subscription conflicts
- 🟡 **Medium Risk (P1)**: Error propagation across modules

---

## 🔴 Risk #1: Single Point of Failure (Highest Priority)

### **Problem**
One WebSocket connection serves the entire application. If it fails:
- **All real-time features break** (messages, notifications, presence, typing)
- **User experience degrades** to HTTP-only mode
- **No automatic recovery** without proper fallback

### **Impact**
- **Severity**: Critical
- **Likelihood**: Medium (network issues, backend failures, rate limiting)
- **User Impact**: Complete loss of real-time features

### **Solution 1: Circuit Breaker Pattern**

**Implementation**:
```typescript
// frontend/src/stores/websocket.ts

interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  failureCount: number
  lastFailureTime: number
  nextAttemptTime: number
}

class CircuitBreaker {
  private readonly FAILURE_THRESHOLD = 5
  private readonly TIMEOUT = 60000 // 60 seconds
  private readonly HALF_OPEN_TIMEOUT = 10000 // 10 seconds

  private state: CircuitBreakerState = {
    state: 'CLOSED',
    failureCount: 0,
    lastFailureTime: 0,
    nextAttemptTime: 0
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check circuit state
    if (this.state.state === 'OPEN') {
      if (Date.now() < this.state.nextAttemptTime) {
        throw new Error('Circuit breaker is OPEN - operation rejected')
      }
      // Try half-open state
      this.state.state = 'HALF_OPEN'
      console.log('🔄 Circuit Breaker: Entering HALF_OPEN state')
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    // Reset on success
    this.state = {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0
    }
    console.log('✅ Circuit Breaker: Reset to CLOSED state')
  }

  private onFailure(): void {
    this.state.failureCount++
    this.state.lastFailureTime = Date.now()

    if (this.state.failureCount >= this.FAILURE_THRESHOLD) {
      this.state.state = 'OPEN'
      this.state.nextAttemptTime = Date.now() + this.TIMEOUT
      console.error(`🔴 Circuit Breaker: OPEN - too many failures (${this.state.failureCount})`)
    }
  }

  getState(): CircuitBreakerState {
    return { ...this.state }
  }
}

// Integration with WebSocket Store
export const useWebSocketStore = defineStore('websocket', () => {
  const circuitBreaker = new CircuitBreaker()

  const connect = async () => {
    return circuitBreaker.execute(async () => {
      // Actual WebSocket connection logic
      const client = new WebSocketClient(...)
      await client.connect()
      return client
    })
  }

  return { connect, circuitBreaker }
})
```

**Benefits**:
- ✅ Prevents cascade failures with automatic trip
- ✅ Self-healing with half-open state
- ✅ Configurable thresholds for different environments

---

### **Solution 2: HTTP Polling Fallback**

**Implementation**:
```typescript
// frontend/src/services/httpPollingFallback.ts

export class HttpPollingFallback {
  private pollingInterval: number | null = null
  private readonly POLL_INTERVAL = 5000 // 5 seconds

  /**
   * Start HTTP polling when WebSocket is unavailable
   */
  start(conversationId: string): void {
    if (this.pollingInterval) return

    console.log('🔄 HTTP Polling Fallback: Starting for conversation', conversationId)

    this.pollingInterval = window.setInterval(async () => {
      try {
        // Poll for new messages
        const response = await fetch(`/api/conversations/${conversationId}/messages?since=${lastMessageId}`)
        const data = await response.json()

        if (data.messages?.length > 0) {
          // Update UI with polled messages
          const conversationStore = useConversationStore()
          conversationStore.addMessages(conversationId, data.messages)
        }
      } catch (error) {
        console.error('HTTP Polling error:', error)
      }
    }, this.POLL_INTERVAL)
  }

  stop(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
      console.log('✅ HTTP Polling Fallback: Stopped')
    }
  }
}

// Integration with WebSocket Store
export const useWebSocketStore = defineStore('websocket', () => {
  const httpFallback = new HttpPollingFallback()

  watch(isConnected, (connected) => {
    if (!connected) {
      // Start HTTP polling when WebSocket disconnects
      const conversationStore = useConversationStore()
      if (conversationStore.currentConversationId) {
        httpFallback.start(conversationStore.currentConversationId)
      }
    } else {
      // Stop HTTP polling when WebSocket reconnects
      httpFallback.stop()
    }
  })

  return { isConnected, httpFallback }
})
```

**Benefits**:
- ✅ Degraded but functional experience during WebSocket outages
- ✅ Automatic switch back to WebSocket when available
- ✅ Configurable polling interval for different use cases

---

## 🟠 Risk #2: Message Loss (High Priority)

### **Problem**
Messages sent during disconnection or network issues may be lost:
- User sends message while WebSocket is reconnecting
- Network packet loss during transmission
- Backend fails to process message before crash

### **Impact**
- **Severity**: High
- **Likelihood**: Medium
- **User Impact**: Critical messages not delivered, data loss

### **Solution 1: Message Queue + Retry Logic**

**Implementation**:
```typescript
// frontend/src/services/messageQueue.ts

interface QueuedMessage {
  id: string
  message: WebSocketMessage
  attempts: number
  timestamp: number
  status: 'pending' | 'sent' | 'failed'
}

export class MessageQueue {
  private queue: QueuedMessage[] = []
  private readonly MAX_ATTEMPTS = 3
  private readonly RETRY_DELAY = 2000 // 2 seconds

  /**
   * Add message to queue
   */
  enqueue(message: WebSocketMessage): string {
    const queuedMessage: QueuedMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message,
      attempts: 0,
      timestamp: Date.now(),
      status: 'pending'
    }

    this.queue.push(queuedMessage)
    console.log(`📥 Message Queue: Added message ${queuedMessage.id}`)

    return queuedMessage.id
  }

  /**
   * Process queue when WebSocket reconnects
   */
  async processQueue(sendFn: (msg: WebSocketMessage) => Promise<void>): Promise<void> {
    const pendingMessages = this.queue.filter(m => m.status === 'pending')

    console.log(`🔄 Message Queue: Processing ${pendingMessages.length} pending messages`)

    for (const queuedMsg of pendingMessages) {
      try {
        await sendFn(queuedMsg.message)
        queuedMsg.status = 'sent'
        console.log(`✅ Message Queue: Sent ${queuedMsg.id}`)
      } catch (error) {
        queuedMsg.attempts++

        if (queuedMsg.attempts >= this.MAX_ATTEMPTS) {
          queuedMsg.status = 'failed'
          console.error(`❌ Message Queue: Failed ${queuedMsg.id} after ${queuedMsg.attempts} attempts`)
        } else {
          console.warn(`⚠️ Message Queue: Retry ${queuedMsg.id} (attempt ${queuedMsg.attempts})`)
          // Retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * queuedMsg.attempts))
        }
      }
    }

    // Clean up sent messages
    this.queue = this.queue.filter(m => m.status !== 'sent')
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      total: this.queue.length,
      pending: this.queue.filter(m => m.status === 'pending').length,
      failed: this.queue.filter(m => m.status === 'failed').length,
      oldestTimestamp: this.queue[0]?.timestamp || 0
    }
  }
}

// Integration with WebSocket Store
export const useWebSocketStore = defineStore('websocket', () => {
  const messageQueue = new MessageQueue()

  const send = (message: WebSocketMessage) => {
    if (!isConnected.value) {
      // Queue message when disconnected
      const messageId = messageQueue.enqueue(message)
      console.log(`📥 Queued message ${messageId} - WebSocket disconnected`)
      return
    }

    // Send immediately when connected
    client.send(message)
  }

  watch(isConnected, async (connected) => {
    if (connected) {
      // Process queued messages on reconnection
      await messageQueue.processQueue(client.send.bind(client))
    }
  })

  return { send, messageQueue }
})
```

---

### **Solution 2: Message Acknowledgment (ACK)**

**Implementation**:
```typescript
// frontend/src/services/messageAck.ts

interface PendingAck {
  messageId: string
  message: WebSocketMessage
  timestamp: number
  timeoutId: number
}

export class MessageAckService {
  private pendingAcks = new Map<string, PendingAck>()
  private readonly ACK_TIMEOUT = 10000 // 10 seconds

  /**
   * Send message with ACK expectation
   */
  sendWithAck(
    message: WebSocketMessage,
    sendFn: (msg: WebSocketMessage) => void,
    onTimeout: (msg: WebSocketMessage) => void
  ): string {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Set ACK timeout
    const timeoutId = window.setTimeout(() => {
      console.error(`❌ ACK timeout for message ${messageId}`)
      this.pendingAcks.delete(messageId)
      onTimeout(message)
    }, this.ACK_TIMEOUT)

    // Track pending ACK
    this.pendingAcks.set(messageId, {
      messageId,
      message,
      timestamp: Date.now(),
      timeoutId
    })

    // Send message with ACK ID
    sendFn({
      ...message,
      ackId: messageId
    })

    return messageId
  }

  /**
   * Handle ACK from backend
   */
  handleAck(ackId: string): void {
    const pending = this.pendingAcks.get(ackId)
    if (!pending) {
      console.warn(`⚠️ Received ACK for unknown message: ${ackId}`)
      return
    }

    // Clear timeout
    clearTimeout(pending.timeoutId)
    this.pendingAcks.delete(ackId)

    const latency = Date.now() - pending.timestamp
    console.log(`✅ ACK received for ${ackId} (latency: ${latency}ms)`)
  }

  /**
   * Get pending ACK statistics
   */
  getStats() {
    return {
      pendingCount: this.pendingAcks.size,
      oldestPending: Math.min(...Array.from(this.pendingAcks.values()).map(p => p.timestamp))
    }
  }
}
```

**Benefits**:
- ✅ Guarantees message delivery with timeout detection
- ✅ Automatic retry on ACK timeout
- ✅ Latency tracking for performance monitoring

---

## 🟠 Risk #3: Memory Leaks (High Priority)

### **Problem**
Improper subscription management can cause memory leaks:
- Subscriptions not cleaned up when components unmount
- Event listeners accumulating over time
- Large message history retained in memory

### **Impact**
- **Severity**: High
- **Likelihood**: High (common in SPA applications)
- **User Impact**: Browser slowdown, tab crashes, degraded performance

### **Solution 1: Subscription Lifecycle Management**

**Implementation**:
```typescript
// frontend/src/stores/websocket.ts

interface Subscription {
  id: SubscriptionId
  channel: string
  callback: (message: WebSocketMessage) => void
  createdAt: number
  lastUsed: number
  componentName?: string // For debugging
}

export const useWebSocketStore = defineStore('websocket', () => {
  const subscriptions = new Map<SubscriptionId, Subscription>()

  const subscribe = (
    channel: string,
    callback: (message: WebSocketMessage) => void,
    componentName?: string
  ): SubscriptionId => {
    const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    subscriptions.set(id, {
      id,
      channel,
      callback,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      componentName
    })

    console.log(`➕ WebSocket: Subscribed to "${channel}" (${id}) from ${componentName || 'unknown'}`)
    console.log(`📊 WebSocket: Total subscriptions: ${subscriptions.size}`)

    return id
  }

  const unsubscribe = (id: SubscriptionId): void => {
    const subscription = subscriptions.get(id)
    if (!subscription) {
      console.warn(`⚠️ WebSocket: Attempted to unsubscribe unknown subscription: ${id}`)
      return
    }

    subscriptions.delete(id)
    console.log(`➖ WebSocket: Unsubscribed from "${subscription.channel}" (${id})`)
    console.log(`📊 WebSocket: Total subscriptions: ${subscriptions.size}`)
  }

  /**
   * Detect leaked subscriptions (older than 5 minutes without use)
   */
  const detectLeakedSubscriptions = (): Subscription[] => {
    const LEAK_THRESHOLD = 5 * 60 * 1000 // 5 minutes
    const now = Date.now()
    const leaked: Subscription[] = []

    subscriptions.forEach((sub) => {
      if (now - sub.lastUsed > LEAK_THRESHOLD) {
        leaked.push(sub)
      }
    })

    return leaked
  }

  /**
   * Cleanup leaked subscriptions
   */
  const cleanupLeakedSubscriptions = (): number => {
    const leaked = detectLeakedSubscriptions()

    leaked.forEach((sub) => {
      console.warn(`🧹 WebSocket: Cleaning up leaked subscription ${sub.id} from ${sub.componentName}`)
      subscriptions.delete(sub.id)
    })

    return leaked.length
  }

  // Auto cleanup every 5 minutes
  setInterval(cleanupLeakedSubscriptions, 5 * 60 * 1000)

  return {
    subscribe,
    unsubscribe,
    detectLeakedSubscriptions,
    cleanupLeakedSubscriptions
  }
})
```

---

### **Solution 2: Memory Leak Detection**

**Implementation**:
```typescript
// frontend/src/utils/memoryLeakDetector.ts

export class MemoryLeakDetector {
  private snapshots: PerformanceMemory[] = []
  private readonly MAX_SNAPSHOTS = 10

  /**
   * Take memory snapshot
   */
  takeSnapshot(): void {
    if (!performance.memory) {
      console.warn('⚠️ Performance.memory not available in this browser')
      return
    }

    const snapshot = {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      timestamp: Date.now()
    }

    this.snapshots.push(snapshot)

    // Keep only recent snapshots
    if (this.snapshots.length > this.MAX_SNAPSHOTS) {
      this.snapshots.shift()
    }
  }

  /**
   * Detect memory leak trend
   */
  detectLeak(): { hasLeak: boolean; trend: number } {
    if (this.snapshots.length < 3) {
      return { hasLeak: false, trend: 0 }
    }

    // Calculate memory growth trend
    const first = this.snapshots[0]
    const last = this.snapshots[this.snapshots.length - 1]

    const memoryGrowth = last.usedJSHeapSize - first.usedJSHeapSize
    const timeElapsed = last.timestamp - first.timestamp

    // MB per minute growth rate
    const growthRate = (memoryGrowth / (1024 * 1024)) / (timeElapsed / 60000)

    // Flag as leak if growing > 5MB per minute
    const hasLeak = growthRate > 5

    if (hasLeak) {
      console.error(`🚨 Memory Leak Detected: Growing at ${growthRate.toFixed(2)} MB/min`)
    }

    return { hasLeak, trend: growthRate }
  }

  /**
   * Get memory statistics
   */
  getStats() {
    if (!performance.memory) return null

    const current = performance.memory

    return {
      usedMB: (current.usedJSHeapSize / (1024 * 1024)).toFixed(2),
      totalMB: (current.totalJSHeapSize / (1024 * 1024)).toFixed(2),
      limitMB: (current.jsHeapSizeLimit / (1024 * 1024)).toFixed(2),
      usagePercent: ((current.usedJSHeapSize / current.jsHeapSizeLimit) * 100).toFixed(2)
    }
  }
}

// Auto-detect memory leaks every minute
const detector = new MemoryLeakDetector()
setInterval(() => {
  detector.takeSnapshot()
  const result = detector.detectLeak()

  if (result.hasLeak) {
    // Trigger cleanup
    const wsStore = useWebSocketStore()
    const cleaned = wsStore.cleanupLeakedSubscriptions()
    console.log(`🧹 Cleaned up ${cleaned} leaked subscriptions`)
  }
}, 60000)
```

**Benefits**:
- ✅ Automatic detection of memory leaks
- ✅ Proactive cleanup before browser crashes
- ✅ Debugging information with component names

---

## 🟡 Risk #4: Concurrent Subscription Conflicts (Medium Priority)

### **Problem**
Multiple components subscribing to the same channel can cause conflicts:
- Duplicate event handlers for same message
- Race conditions when unsubscribing
- Inconsistent state updates

### **Impact**
- **Severity**: Medium
- **Likelihood**: Medium
- **User Impact**: Duplicate notifications, unexpected behavior

### **Solution: Channel Naming Conventions + Deduplication**

**Implementation**:
```typescript
// frontend/src/stores/websocket.ts

export const useWebSocketStore = defineStore('websocket', () => {
  const channelSubscriptions = new Map<string, Set<SubscriptionId>>()

  const subscribe = (
    channel: string,
    callback: (message: WebSocketMessage) => void,
    options?: { deduplicate?: boolean }
  ): SubscriptionId => {
    const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Deduplication check
    if (options?.deduplicate && channelSubscriptions.has(channel)) {
      const existing = channelSubscriptions.get(channel)!
      if (existing.size > 0) {
        console.warn(`⚠️ WebSocket: Duplicate subscription to "${channel}" - using existing`)
        return Array.from(existing)[0]
      }
    }

    // Track channel subscriptions
    if (!channelSubscriptions.has(channel)) {
      channelSubscriptions.set(channel, new Set())
    }
    channelSubscriptions.get(channel)!.add(id)

    subscriptions.set(id, { id, channel, callback, createdAt: Date.now(), lastUsed: Date.now() })

    console.log(`➕ WebSocket: Subscribed to "${channel}" (${id})`)
    console.log(`📊 Channel "${channel}": ${channelSubscriptions.get(channel)!.size} subscribers`)

    return id
  }

  const unsubscribe = (id: SubscriptionId): void => {
    const subscription = subscriptions.get(id)
    if (!subscription) return

    // Remove from channel tracking
    const channelSubs = channelSubscriptions.get(subscription.channel)
    if (channelSubs) {
      channelSubs.delete(id)
      if (channelSubs.size === 0) {
        channelSubscriptions.delete(subscription.channel)
      }
    }

    subscriptions.delete(id)
  }

  /**
   * Get subscription count per channel
   */
  const getChannelStats = () => {
    const stats: Record<string, number> = {}
    channelSubscriptions.forEach((subs, channel) => {
      stats[channel] = subs.size
    })
    return stats
  }

  return { subscribe, unsubscribe, getChannelStats }
})
```

**Channel Naming Convention**:
```typescript
// Use consistent naming patterns
const CHANNEL_PATTERNS = {
  // Global channels
  ACTIVITY: 'activity',
  NOTIFICATIONS: 'notifications',
  SYSTEM: 'system',

  // Scoped channels
  CONVERSATION: (id: string) => `conversation:${id}`,
  USER_PRESENCE: (userId: string) => `presence:user:${userId}`,
  TEAM_UPDATES: (teamId: string) => `team:${teamId}:updates`,

  // Private channels
  AGENT_PRIVATE: (agentId: string) => `private:agent:${agentId}`,
}
```

---

## 🟡 Risk #5: Error Propagation (Medium Priority)

### **Problem**
Error in one subscription can crash entire WebSocket connection:
- Uncaught exception in callback function
- Error bubbles up to WebSocket client
- All subscriptions lose connection

### **Impact**
- **Severity**: Medium
- **Likelihood**: Medium
- **User Impact**: Complete WebSocket failure from single component error

### **Solution: Error Isolation**

**Implementation**:
```typescript
// frontend/src/stores/websocket.ts

export const useWebSocketStore = defineStore('websocket', () => {
  const errorCounts = new Map<string, number>()
  const MAX_ERRORS_PER_SUBSCRIPTION = 10

  const dispatch = (message: WebSocketMessage): void => {
    const targetChannel = message.channel || 'default'

    subscriptions.forEach((subscription) => {
      if (subscription.channel !== targetChannel) return

      try {
        // Isolated execution
        subscription.callback(message)
        subscription.lastUsed = Date.now()

        // Reset error count on success
        errorCounts.delete(subscription.id)

      } catch (error) {
        // Isolate error to this subscription only
        const count = (errorCounts.get(subscription.id) || 0) + 1
        errorCounts.set(subscription.id, count)

        console.error(
          `❌ WebSocket: Error in subscription ${subscription.id} (${subscription.channel})`,
          error,
          `[${count}/${MAX_ERRORS_PER_SUBSCRIPTION} errors]`
        )

        // Auto-unsubscribe if too many errors
        if (count >= MAX_ERRORS_PER_SUBSCRIPTION) {
          console.error(`🚨 WebSocket: Auto-unsubscribing ${subscription.id} due to repeated errors`)
          unsubscribe(subscription.id)
        }
      }
    })
  }

  return { dispatch }
})
```

**Global Error Handler**:
```typescript
// frontend/src/services/websocketErrorHandler.ts

export class WebSocketErrorHandler {
  private errorLog: Array<{ timestamp: number; error: Error; context: string }> = []
  private readonly MAX_LOG_SIZE = 100

  /**
   * Handle WebSocket errors globally
   */
  handleError(error: Error, context: string): void {
    // Log error
    this.errorLog.push({
      timestamp: Date.now(),
      error,
      context
    })

    // Trim log
    if (this.errorLog.length > this.MAX_LOG_SIZE) {
      this.errorLog.shift()
    }

    // Report critical errors
    if (this.isCriticalError(error)) {
      this.reportCriticalError(error, context)
    }
  }

  private isCriticalError(error: Error): boolean {
    // Define critical error patterns
    const criticalPatterns = [
      /connection.*failed/i,
      /authentication.*failed/i,
      /rate.*limit/i,
      /server.*error/i
    ]

    return criticalPatterns.some(pattern => pattern.test(error.message))
  }

  private reportCriticalError(error: Error, context: string): void {
    // Send to monitoring service
    console.error('🚨 CRITICAL WebSocket Error:', {
      error: error.message,
      context,
      timestamp: new Date().toISOString(),
      stack: error.stack
    })

    // Could integrate with Sentry, Datadog, etc.
    // Sentry.captureException(error, { tags: { context } })
  }

  /**
   * Get recent errors for debugging
   */
  getRecentErrors(count: number = 10) {
    return this.errorLog.slice(-count)
  }
}
```

---

## 📊 Monitoring & Observability

### **Metrics to Track**

**1. Connection Metrics**:
```typescript
interface ConnectionMetrics {
  totalConnections: number
  successfulConnections: number
  failedConnections: number
  avgConnectionTime: number
  reconnectCount: number
  uptime: number
}
```

**2. Message Metrics**:
```typescript
interface MessageMetrics {
  messagesSent: number
  messagesReceived: number
  messagesQueued: number
  messagesFailed: number
  avgLatency: number
  throughput: number // messages per second
}
```

**3. Subscription Metrics**:
```typescript
interface SubscriptionMetrics {
  activeSubscriptions: number
  subscriptionsByChannel: Record<string, number>
  leakedSubscriptions: number
  subscriptionErrors: number
}
```

---

### **Logging System**

**Implementation**:
```typescript
// frontend/src/services/websocketLogger.ts

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class WebSocketLogger {
  private level: LogLevel = LogLevel.INFO
  private logs: Array<{ level: LogLevel; message: string; timestamp: number; data?: unknown }> = []

  setLevel(level: LogLevel): void {
    this.level = level
  }

  debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, data)
  }

  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, data)
  }

  warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, data)
  }

  error(message: string, data?: unknown): void {
    this.log(LogLevel.ERROR, message, data)
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (level < this.level) return

    const logEntry = {
      level,
      message,
      timestamp: Date.now(),
      data
    }

    this.logs.push(logEntry)

    // Console output
    const prefix = this.getPrefix(level)
    const method = this.getConsoleMethod(level)
    console[method](`${prefix} ${message}`, data || '')
  }

  private getPrefix(level: LogLevel): string {
    const prefixes = {
      [LogLevel.DEBUG]: '🐛 [DEBUG]',
      [LogLevel.INFO]: 'ℹ️ [INFO]',
      [LogLevel.WARN]: '⚠️ [WARN]',
      [LogLevel.ERROR]: '❌ [ERROR]'
    }
    return prefixes[level]
  }

  private getConsoleMethod(level: LogLevel): 'log' | 'info' | 'warn' | 'error' {
    const methods = {
      [LogLevel.DEBUG]: 'log' as const,
      [LogLevel.INFO]: 'info' as const,
      [LogLevel.WARN]: 'warn' as const,
      [LogLevel.ERROR]: 'error' as const
    }
    return methods[level]
  }

  /**
   * Export logs for debugging
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2)
  }
}

// Global logger instance
export const wsLogger = new WebSocketLogger()
```

---

### **Performance Tracking**

**Implementation**:
```typescript
// frontend/src/services/websocketPerformance.ts

export class WebSocketPerformance {
  /**
   * Track WebSocket operation performance
   */
  measure(name: string, operation: () => void | Promise<void>): void {
    const startMark = `${name}-start`
    const endMark = `${name}-end`
    const measureName = `${name}-duration`

    performance.mark(startMark)

    const result = operation()

    if (result instanceof Promise) {
      result.then(() => {
        performance.mark(endMark)
        performance.measure(measureName, startMark, endMark)
        this.logMeasure(measureName)
      })
    } else {
      performance.mark(endMark)
      performance.measure(measureName, startMark, endMark)
      this.logMeasure(measureName)
    }
  }

  private logMeasure(name: string): void {
    const entries = performance.getEntriesByName(name)
    if (entries.length > 0) {
      const duration = entries[entries.length - 1].duration
      console.log(`⏱️ Performance: ${name} took ${duration.toFixed(2)}ms`)
    }
  }

  /**
   * Get performance statistics
   */
  getStats() {
    const entries = performance.getEntriesByType('measure')
    const wsEntries = entries.filter(e => e.name.startsWith('websocket-'))

    return {
      totalMeasures: wsEntries.length,
      avgDuration: wsEntries.reduce((sum, e) => sum + e.duration, 0) / wsEntries.length,
      slowestOperation: wsEntries.reduce((max, e) => e.duration > max.duration ? e : max, wsEntries[0])
    }
  }
}
```

---

## 🛠️ Debug Tools

### **1. WebSocket Debug Panel** (Visual Tool)

**Implementation**:
```typescript
// frontend/src/components/debug/WebSocketDebugPanel.vue

const createDebugPanel = () => {
  const wsStore = useWebSocketStore()

  const panel = document.createElement('div')
  panel.id = 'ws-debug-panel'
  panel.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 400px;
    max-height: 600px;
    background: rgba(0, 0, 0, 0.9);
    color: #fff;
    border-radius: 8px;
    padding: 16px;
    font-family: monospace;
    font-size: 12px;
    overflow-y: auto;
    z-index: 9999;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  `

  const title = document.createElement('h3')
  title.textContent = '🔌 WebSocket Debug Panel'
  title.style.cssText = 'margin: 0 0 12px 0; color: #4ade80;'
  panel.appendChild(title)

  const createStat = (label: string, value: string, color: string = '#fff') => {
    const stat = document.createElement('div')
    stat.style.cssText = 'margin: 8px 0; display: flex; justify-content: space-between;'

    const labelSpan = document.createElement('span')
    labelSpan.textContent = label
    labelSpan.style.color = '#9ca3af'

    const valueSpan = document.createElement('span')
    valueSpan.textContent = value
    valueSpan.style.cssText = `color: ${color}; font-weight: bold;`

    stat.appendChild(labelSpan)
    stat.appendChild(valueSpan)
    return stat
  }

  // Connection status
  panel.appendChild(createStat(
    'Status:',
    wsStore.isConnected ? '✅ Connected' : '❌ Disconnected',
    wsStore.isConnected ? '#4ade80' : '#ef4444'
  ))

  // Subscriptions
  panel.appendChild(createStat('Subscriptions:', String(wsStore.subscriptionCount), '#60a5fa'))

  // Channels
  panel.appendChild(createStat('Active Channels:', String(wsStore.channelCount), '#a78bfa'))

  // Memory usage
  const memStats = new MemoryLeakDetector().getStats()
  if (memStats) {
    panel.appendChild(createStat('Memory Usage:', `${memStats.usedMB} MB`, '#f59e0b'))
  }

  // Queue status
  const queueStats = wsStore.messageQueue?.getStats()
  if (queueStats) {
    panel.appendChild(createStat('Queued Messages:', String(queueStats.pending), '#ec4899'))
  }

  // Circuit breaker status
  const cbState = wsStore.circuitBreaker?.getState()
  if (cbState) {
    panel.appendChild(createStat(
      'Circuit Breaker:',
      cbState.state,
      cbState.state === 'CLOSED' ? '#4ade80' : '#ef4444'
    ))
  }

  document.body.appendChild(panel)

  // Auto-refresh every 2 seconds
  setInterval(() => {
    // Update panel content
    panel.remove()
    createDebugPanel()
  }, 2000)
}

// Enable in development
if (import.meta.env.DEV) {
  createDebugPanel()
}
```

---

### **2. Console Commands** (Runtime Debugging)

**Implementation**:
```typescript
// frontend/src/utils/debugCommands.ts

// Expose WebSocket debug commands to console
if (import.meta.env.DEV) {
  (window as any).wsDebug = {
    /**
     * Get WebSocket Store instance
     */
    getStore: () => {
      return useWebSocketStore()
    },

    /**
     * List all active subscriptions
     */
    listSubscriptions: () => {
      const wsStore = useWebSocketStore()
      console.table(Array.from(wsStore.subscriptions.values()))
    },

    /**
     * Get subscription count per channel
     */
    channelStats: () => {
      const wsStore = useWebSocketStore()
      console.table(wsStore.getChannelStats())
    },

    /**
     * Detect memory leaks
     */
    checkMemoryLeaks: () => {
      const wsStore = useWebSocketStore()
      const leaked = wsStore.detectLeakedSubscriptions()
      console.log(`Found ${leaked.length} leaked subscriptions:`)
      console.table(leaked)
    },

    /**
     * Force cleanup leaked subscriptions
     */
    cleanup: () => {
      const wsStore = useWebSocketStore()
      const count = wsStore.cleanupLeakedSubscriptions()
      console.log(`✅ Cleaned up ${count} leaked subscriptions`)
    },

    /**
     * Get message queue status
     */
    queueStatus: () => {
      const wsStore = useWebSocketStore()
      const stats = wsStore.messageQueue?.getStats()
      console.table(stats)
    },

    /**
     * Get circuit breaker state
     */
    circuitBreakerStatus: () => {
      const wsStore = useWebSocketStore()
      const state = wsStore.circuitBreaker?.getState()
      console.log('Circuit Breaker State:', state)
    },

    /**
     * Force reconnect
     */
    reconnect: async () => {
      const wsStore = useWebSocketStore()
      console.log('🔄 Forcing WebSocket reconnection...')
      await wsStore.reconnect()
      console.log('✅ Reconnection complete')
    },

    /**
     * Export logs
     */
    exportLogs: () => {
      const logs = wsLogger.exportLogs()
      console.log('📄 Exported logs:')
      console.log(logs)
      return logs
    },

    /**
     * Help command
     */
    help: () => {
      console.log(`
🔌 WebSocket Debug Commands:

wsDebug.getStore()             - Get WebSocket Store instance
wsDebug.listSubscriptions()    - List all active subscriptions
wsDebug.channelStats()         - Get subscription count per channel
wsDebug.checkMemoryLeaks()     - Detect leaked subscriptions
wsDebug.cleanup()              - Force cleanup leaked subscriptions
wsDebug.queueStatus()          - Get message queue status
wsDebug.circuitBreakerStatus() - Get circuit breaker state
wsDebug.reconnect()            - Force WebSocket reconnection
wsDebug.exportLogs()           - Export debug logs
wsDebug.help()                 - Show this help message
      `)
    }
  }

  console.log(`
🔌 WebSocket Debug Commands available!
Type wsDebug.help() for available commands.
  `)
}
```

---

## 🎯 Implementation Priority

### **P0 - Critical (Implement Immediately)**

1. **Message Queue + Retry Logic** - Prevents data loss
2. **Circuit Breaker Pattern** - Prevents cascade failures
3. **Logging System** - Essential for debugging production issues
4. **Subscription Lifecycle Management** - Prevents memory leaks

**Estimated Effort**: 2-3 days

---

### **P1 - Important (Implement Within 2 Weeks)**

1. **HTTP Polling Fallback** - Degraded mode for better UX
2. **Error Isolation** - Prevents single component errors from crashing WebSocket
3. **Metrics Collection** - Performance monitoring
4. **WebSocket Debug Panel** - Development productivity

**Estimated Effort**: 3-4 days

---

### **P2 - Nice-to-Have (Implement When Time Permits)**

1. **Message ACK System** - Guarantees delivery
2. **Memory Leak Detection** - Proactive monitoring
3. **Performance Tracking** - Advanced optimization
4. **Console Debug Commands** - Advanced debugging

**Estimated Effort**: 2-3 days

---

## 📋 Summary

### **Key Risks Identified**

| Risk | Severity | Likelihood | Solution | Priority |
|------|----------|------------|----------|----------|
| Single Point of Failure | 🔴 Critical | Medium | Circuit Breaker + HTTP Fallback | P0 |
| Message Loss | 🟠 High | Medium | Message Queue + ACK | P0 |
| Memory Leaks | 🟠 High | High | Lifecycle Mgmt + Auto Cleanup | P0 |
| Subscription Conflicts | 🟡 Medium | Medium | Deduplication + Naming | P1 |
| Error Propagation | 🟡 Medium | Medium | Error Isolation + Global Handler | P1 |

---

### **Recommended Next Steps**

1. **Week 1**: Implement P0 features (Message Queue, Circuit Breaker, Logging)
2. **Week 2**: Add monitoring and debug tools (Metrics, Debug Panel)
3. **Week 3**: Implement P1 features (HTTP Fallback, Error Isolation)
4. **Week 4**: Testing and refinement, add P2 features as needed

---

### **Success Criteria**

✅ **Zero message loss** during network disconnections
✅ **Automatic recovery** from WebSocket failures within 10 seconds
✅ **Memory usage stable** over 24-hour period
✅ **No subscription leaks** detected in production
✅ **Error isolation** - single component error doesn't crash WebSocket
✅ **Complete observability** - can debug production issues within 5 minutes

---

**Document Status**: ✅ Complete

**Last Updated**: 2025-01-07

**Author**: Tech Lead Analysis

**Review Status**: Ready for team review and implementation planning
