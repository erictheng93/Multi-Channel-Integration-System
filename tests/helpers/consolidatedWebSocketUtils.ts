// Consolidated WebSocket Test Utilities
// Simplified replacement for complex WebSocket test infrastructure
// Reduces 600+ lines per file to focused, essential functionality

import type {
  WebSocketMessage,
  DurableObjectEvent,
  WebSocketConnection
} from '../../src/types/websocket-types'

// =================== Simple Test Client ===================

/**
 * Simplified WebSocket test client - focuses on essential testing needs
 */
export class SimpleWebSocketTestClient {
  public id: string
  public userId: string
  public conversationId: string
  public role: 'admin' | 'team' | 'agent'
  public isConnected = false
  public receivedMessages: WebSocketMessage[] = []
  public sentMessages: WebSocketMessage[] = []
  private eventCallbacks = new Map<string, Function[]>()

  constructor(params: {
    userId: string
    conversationId: string
    role: 'admin' | 'team' | 'agent'
  }) {
    this.id = `test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    this.userId = params.userId
    this.conversationId = params.conversationId
    this.role = params.role
  }

  // Connection
  async connect(): Promise<void> {
    this.isConnected = true
    this.emit('connect')
  }

  async disconnect(): Promise<void> {
    this.isConnected = false
    this.emit('disconnect')
    this.eventCallbacks.clear()
  }

  // Messaging
  async sendMessage(message: Partial<WebSocketMessage>): Promise<void> {
    if (!this.isConnected) throw new Error('Not connected')

    const fullMessage: WebSocketMessage = {
      id: message.id || `msg_${Date.now()}`,
      type: message.type || 'message',
      timestamp: message.timestamp || Date.now(),
      data: message.data
    }

    this.sentMessages.push(fullMessage)
    this.emit('message_sent', fullMessage)
  }

  receiveMessage(message: WebSocketMessage): void {
    if (!this.isConnected) return
    this.receivedMessages.push(message)
    this.emit('message', message)

    if (message.type === 'event') {
      this.emit('event', message.data)
    }
  }

  // Events
  on(event: string, callback: Function): void {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, [])
    }
    this.eventCallbacks.get(event)!.push(callback)
  }

  private emit(event: string, ...args: any[]): void {
    const callbacks = this.eventCallbacks.get(event)
    if (callbacks) {
      callbacks.forEach(callback => callback(...args))
    }
  }

  // Test helpers
  async waitForEvent(eventType: string, timeout = 5000): Promise<DurableObjectEvent> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${eventType}`))
      }, timeout)

      const handler = (event: DurableObjectEvent) => {
        if (event.type === eventType) {
          clearTimeout(timeoutId)
          resolve(event)
        }
      }

      this.on('event', handler)
    })
  }

  getEventsByType(eventType: string): DurableObjectEvent[] {
    return this.receivedMessages
      .filter(msg => msg.type === 'event')
      .map(msg => msg.data as DurableObjectEvent)
      .filter(event => event.type === eventType)
  }

  clearHistory(): void {
    this.receivedMessages = []
    this.sentMessages = []
  }
}

// =================== Room Controller ===================

/**
 * Simple room controller for multi-client testing
 */
export class SimpleRoomController {
  private clients = new Map<string, SimpleWebSocketTestClient>()

  constructor(public conversationId: string) {}

  addClient(client: SimpleWebSocketTestClient): void {
    this.clients.set(client.id, client)
  }

  getClients(): SimpleWebSocketTestClient[] {
    return Array.from(this.clients.values())
  }

  async connectAll(): Promise<void> {
    const promises = this.getClients().map(client => client.connect())
    await Promise.all(promises)
  }

  async disconnectAll(): Promise<void> {
    const promises = this.getClients().map(client => client.disconnect())
    await Promise.all(promises)
  }

  broadcastToAll(message: WebSocketMessage, excludeClientId?: string): void {
    this.getClients()
      .filter(client => client.isConnected && client.id !== excludeClientId)
      .forEach(client => client.receiveMessage(message))
  }
}

// =================== Test Data Factory ===================

/**
 * Simple test data factory - creates only what's needed
 */
export const WebSocketTestData = {
  createMessage: (overrides: Partial<WebSocketMessage> = {}): WebSocketMessage => ({
    id: `msg_${Date.now()}`,
    type: 'message',
    timestamp: Date.now(),
    data: { content: 'Test message' },
    ...overrides
  }),

  createEvent: (overrides: Partial<DurableObjectEvent> = {}): DurableObjectEvent => ({
    id: `event_${Date.now()}`,
    type: 'message_sent',
    source: 'api',
    timestamp: Date.now(),
    userId: 'test_user',
    conversationId: 'test_conversation',
    data: {},
    priority: 'normal',
    ...overrides
  }),

  createConnection: (overrides: Partial<WebSocketConnection> = {}): WebSocketConnection => ({
    websocket: null as any,
    userId: 'test_user',
    conversationId: 'test_conversation',
    role: 'agent',
    connectionId: `conn_${Date.now()}`,
    lastActivity: Date.now(),
    isActive: true,
    metadata: {},
    ...overrides
  }),

  createTypingEvent: (userId: string, conversationId: string, isTyping: boolean): DurableObjectEvent =>
    WebSocketTestData.createEvent({
      type: isTyping ? 'typing_start' : 'typing_stop',
      userId,
      conversationId,
      data: { userName: `User ${userId}` },
      priority: 'low'
    })
}

// =================== Test Assertions ===================

/**
 * Simple test assertions - no over-engineering
 */
export const WebSocketAssertions = {
  assertConnected: (client: SimpleWebSocketTestClient) => {
    if (!client.isConnected) {
      throw new Error(`Client ${client.id} is not connected`)
    }
  },

  assertEventReceived: async (
    client: SimpleWebSocketTestClient,
    eventType: string,
    timeout = 1000
  ): Promise<DurableObjectEvent> => {
    return client.waitForEvent(eventType, timeout)
  },

  assertEventCount: (
    client: SimpleWebSocketTestClient,
    eventType: string,
    expectedCount: number
  ) => {
    const events = client.getEventsByType(eventType)
    if (events.length !== expectedCount) {
      throw new Error(`Expected ${expectedCount} events of type ${eventType}, got ${events.length}`)
    }
  }
}

// =================== Test Scenarios ===================

/**
 * Common test scenarios - simplified
 */
export const WebSocketScenarios = {
  basicMessageFlow: async (sender: SimpleWebSocketTestClient, receiver: SimpleWebSocketTestClient) => {
    await sender.connect()
    await receiver.connect()

    await sender.sendMessage({
      type: 'message',
      data: { content: 'Hello' }
    })

    // Simulate server broadcast
    const event = WebSocketTestData.createEvent({
      type: 'message_sent',
      userId: sender.userId,
      conversationId: sender.conversationId,
      data: { content: 'Hello' }
    })

    receiver.receiveMessage({
      type: 'event',
      data: event,
      timestamp: Date.now()
    })

    await WebSocketAssertions.assertEventReceived(receiver, 'message_sent')
  },

  typingIndicator: async (typer: SimpleWebSocketTestClient, observer: SimpleWebSocketTestClient) => {
    await typer.connect()
    await observer.connect()

    // Start typing
    const startEvent = WebSocketTestData.createTypingEvent(typer.userId, typer.conversationId, true)
    observer.receiveMessage({ type: 'event', data: startEvent, timestamp: Date.now() })

    // Stop typing
    const stopEvent = WebSocketTestData.createTypingEvent(typer.userId, typer.conversationId, false)
    observer.receiveMessage({ type: 'event', data: stopEvent, timestamp: Date.now() })

    await WebSocketAssertions.assertEventReceived(observer, 'typing_start')
    await WebSocketAssertions.assertEventReceived(observer, 'typing_stop')
  }
}

// =================== Simple Factory ===================

/**
 * Simple client factory
 */
export const ClientFactory = {
  createClient: (params: {
    conversationId: string
    role: 'admin' | 'team' | 'agent'
    userId?: string
  }): SimpleWebSocketTestClient => {
    return new SimpleWebSocketTestClient({
      userId: params.userId || `user_${Date.now()}`,
      conversationId: params.conversationId,
      role: params.role
    })
  },

  createRoom: (conversationId: string) => {
    const controller = new SimpleRoomController(conversationId)
    const admin = ClientFactory.createClient({ conversationId, role: 'admin' })
    const team = ClientFactory.createClient({ conversationId, role: 'team' })
    const agent = ClientFactory.createClient({ conversationId, role: 'agent' })

    controller.addClient(admin)
    controller.addClient(team)
    controller.addClient(agent)

    return { controller, admin, team, agent }
  }
}