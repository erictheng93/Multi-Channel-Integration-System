// Simplified ConversationRoom Durable Object
// 專案名稱：Multi-Channel Support MVP - Reduced Complexity Implementation

import type { WebSocketConnection, WebSocketMessage, DurableObjectEvent } from '../types/websocket-types'
import { safeAsync, createErrorResponse, createSuccessResponse } from '../utils/simple-error-handler'

export class SimplifiedConversationRoom implements DurableObject {
  private state: DurableObjectState

  // Simplified state management
  private connections = new Map<string, WebSocketConnection>()
  private participants = new Set<string>()
  private conversationId: string
  private messageCounter = 0

  // Configuration (reduced complexity)
  private readonly MAX_CONNECTIONS = 100
  // private readonly MAX_MESSAGE_HISTORY = 50 // Reserved for future message history implementation

  constructor(state: DurableObjectState, env: any) {
    this.state = state
    this.conversationId = env.conversationId || 'unknown'
    this.initializeState()
  }

  // =================== Main Request Handler ===================

  async fetch(request: Request): Promise<Response> {
    const result = await safeAsync(async () => {
      const url = new URL(request.url)

      // Handle WebSocket upgrade
      if (request.headers.get('Upgrade') === 'websocket') {
        return this.handleWebSocketUpgrade(request)
      }

      // Handle API requests with simplified routing
      switch (url.pathname) {
        case '/broadcast':
          return this.handleBroadcast(request)
        case '/participants':
          return this.getParticipants()
        case '/metrics':
          return this.getMetrics()
        default:
          return createErrorResponse({ message: 'Not Found' }, 404)
      }
    }, 'ConversationRoom.fetch')

    return result.success
      ? result.data!
      : createErrorResponse(result.error!, 500)
  }

  // =================== WebSocket Handling (Simplified) ===================

  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    const token = url.searchParams.get('token')
    const role = url.searchParams.get('role') as 'admin' | 'agent'

    // Simplified validation
    if (!userId || !token || !role) {
      return createErrorResponse({ message: 'Missing required parameters' }, 400)
    }

    if (this.connections.size >= this.MAX_CONNECTIONS) {
      return createErrorResponse({ message: 'Connection limit reached' }, 429)
    }

    // Create WebSocket pair
    const [client, server] = Object.values(new WebSocketPair())

    const connection: WebSocketConnection = {
      websocket: server as WebSocket,
      userId,
      conversationId: this.conversationId,
      role,
      connectionId: this.generateId(),
      lastActivity: Date.now(),
      isActive: true
    }

    // Setup simplified event handlers
    this.setupWebSocketHandlers(connection)
    await this.addConnection(connection)

    server?.accept()
    return new Response(null, { status: 101, webSocket: client as WebSocket })
  }

  private setupWebSocketHandlers(connection: WebSocketConnection): void {
    const { websocket, connectionId } = connection

    websocket.addEventListener('message', async (event) => {
      const result = await safeAsync(async () => {
        const message: WebSocketMessage = JSON.parse(event.data as string)
        await this.handleMessage(connection, message)
      }, `WebSocket.message.${connectionId}`)

      if (!result.success) {
        this.sendError(connection, result.error!.message)
      }
    })

    websocket.addEventListener('close', () => {
      this.removeConnection(connectionId)
    })

    websocket.addEventListener('error', () => {
      this.removeConnection(connectionId)
    })

    // Send welcome message
    this.sendMessage(connection, {
      type: 'event',
      data: {
        eventType: 'connection_established',
        conversationId: this.conversationId,
        connectionId,
        participants: Array.from(this.participants)
      },
      timestamp: Date.now()
    })
  }

  // =================== Message Handling (Simplified) ===================

  private async handleMessage(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    connection.lastActivity = Date.now()

    switch (message.type) {
      case 'ping':
        this.sendMessage(connection, { type: 'pong', timestamp: Date.now() })
        break

      case 'message':
        // Check if this is a typing indicator message
        const messageData = message.data as any;
        const isTypingMessage = messageData && typeof messageData === 'object' &&
          (messageData.messageType === 'typing_start' || messageData.messageType === 'typing_stop');

        if (isTypingMessage) {
          await this.broadcastToOthers(connection, message)
        } else {
          await this.handleChatMessage(connection, message)
        }
        break

      default:
        this.sendError(connection, `Unknown message type: ${message.type}`)
    }
  }

  private async handleChatMessage(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    const messageOrder = this.getNextMessageOrder()

    // Type guard for message data to ensure proper spreading
    const messageData = message.data as any;
    const safeMessageData = messageData && typeof messageData === 'object' ? messageData : {};

    const event: DurableObjectEvent = {
      id: this.generateId(),
      type: 'message_sent',
      source: 'websocket',
      timestamp: Date.now(),
      userId: connection.userId,
      conversationId: this.conversationId,
      data: {
        ...safeMessageData,
        order: messageOrder
      },
      priority: 'normal'
    }

    // Broadcast to all connections
    await this.broadcastEvent(event)
  }

  // =================== Broadcasting (Simplified) ===================

  private async broadcastEvent(event: DurableObjectEvent): Promise<void> {
    const message: WebSocketMessage = {
      type: 'event',
      data: event,
      timestamp: event.timestamp
    }

    const broadcasts = Array.from(this.connections.values()).map(connection =>
      this.sendMessage(connection, message)
    )

    await Promise.allSettled(broadcasts)
  }

  private async broadcastToOthers(sender: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    const otherConnections = Array.from(this.connections.values())
      .filter(conn => conn.connectionId !== sender.connectionId)

    const broadcasts = otherConnections.map(conn => this.sendMessage(conn, message))
    await Promise.allSettled(broadcasts)
  }

  // =================== Connection Management (Simplified) ===================

  private async addConnection(connection: WebSocketConnection): Promise<void> {
    this.connections.set(connection.connectionId, connection)
    this.participants.add(connection.userId)

    // Persist to storage
    await this.state.storage.put(`connection:${connection.connectionId}`, {
      userId: connection.userId,
      connectedAt: Date.now()
    })

    console.log(`✅ [ConversationRoom] Connection added: ${connection.connectionId}`)
  }

  private async removeConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId)
    if (!connection) return

    this.connections.delete(connectionId)

    // Check if user has other connections
    const hasOtherConnections = Array.from(this.connections.values())
      .some(conn => conn.userId === connection.userId)

    if (!hasOtherConnections) {
      this.participants.delete(connection.userId)
    }

    // Clean up storage
    await this.state.storage.delete(`connection:${connectionId}`)

    console.log(`🔌 [ConversationRoom] Connection removed: ${connectionId}`)
  }

  // =================== Utility Methods (Simplified) ===================

  private sendMessage(connection: WebSocketConnection, message: WebSocketMessage): Promise<void> {
    return new Promise((resolve) => {
      try {
        if (connection.websocket.readyState === WebSocket.OPEN) {
          connection.websocket.send(JSON.stringify(message))
          connection.lastActivity = Date.now()
        }
      } catch (error) {
        console.error(`❌ [ConversationRoom] Send error: ${error}`)
      }
      resolve()
    })
  }

  private sendError(connection: WebSocketConnection, error: string): void {
    this.sendMessage(connection, {
      type: 'error',
      data: { error },
      timestamp: Date.now()
    })
  }

  private getNextMessageOrder(): number {
    return ++this.messageCounter
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  }

  private async initializeState(): Promise<void> {
    try {
      const participants = await this.state.storage.get('participants') as string[]
      if (participants) {
        this.participants = new Set(participants)
      }
    } catch (error) {
      console.error('❌ [ConversationRoom] State initialization error:', error)
    }
  }

  // =================== API Handlers (Simplified) ===================

  private async handleBroadcast(request: Request): Promise<Response> {
    const event = await request.json() as DurableObjectEvent
    await this.broadcastEvent(event)
    return createSuccessResponse({ broadcasted: true })
  }

  private getParticipants(): Response {
    return createSuccessResponse({
      participants: Array.from(this.participants),
      activeConnections: this.connections.size
    })
  }

  private getMetrics(): Response {
    return createSuccessResponse({
      conversationId: this.conversationId,
      activeConnections: this.connections.size,
      participants: this.participants.size,
      messageCounter: this.messageCounter
    })
  }
}