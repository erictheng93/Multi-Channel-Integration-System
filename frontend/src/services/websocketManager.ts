// WebSocket Connection Manager for Multi-Conversation Management
// Project: Multi-Channel Support MVP
// Created by: WebSocket Migration Developer

import { ref, computed, type Ref } from 'vue'
import type { WebSocketClient} from './websocketClient';
import { createWebSocketClient, type WebSocketMessage, type WebSocketConnectionState } from './websocketClient'
import { useAuthStore } from '@/stores/auth'
import type { Conversation, Message } from '@/types'

// Connection types
export interface ConversationConnection {
  conversationId: string
  isActive: boolean
  lastActivity: number
  messageCount: number
  typingUsers: Set<string>
}

export interface UserPresence {
  userId: string
  isOnline: boolean
  lastSeen: number
  currentConversation?: string
}

// Event types
export interface ConversationEvent {
  type: 'message' | 'typing_start' | 'typing_stop' | 'status_change' | 'assignment_change'
  conversationId: string
  data: unknown
  timestamp: number
}

export interface GlobalEvent {
  type: 'user_presence' | 'notification' | 'system_update'
  data: unknown
  timestamp: number
}

// Team member event data structure
export interface TeamMemberEventData {
  teamId: number
  teamName: string
  agentId: string
  agentName?: string
  memberCount: number
  changedBy: string
}

// Team update event data structure
export interface TeamUpdateEventData {
  teamId: number
  teamName: string
  changes: {
    name?: string
    description?: string
    isActive?: boolean
    memberCount?: number
  }
  changedBy: string
}

// Event handlers
export interface WebSocketEventCallbacks {
  onConversationMessage?: (_conversationId: string, _message: Message) => void
  onConversationUpdate?: (_conversationId: string, _conversation: Conversation) => void
  onTypingStart?: (_conversationId: string, _userId: string) => void
  onTypingStop?: (_conversationId: string, _userId: string) => void
  onUserPresence?: (_userId: string, _presence: UserPresence) => void
  onNotification?: (_notification: unknown) => void
  // 🆕 Team event callbacks for real-time memberCount updates
  onTeamMemberAdded?: (_data: TeamMemberEventData) => void
  onTeamMemberRemoved?: (_data: TeamMemberEventData) => void
  onTeamUpdated?: (_data: TeamUpdateEventData) => void
  onConnectionStateChange?: (_state: WebSocketConnectionState) => void
  onError?: (_error: Error) => void
}

export class WebSocketManager {
  private client: WebSocketClient
  private conversations = new Map<string, ConversationConnection>()
  private userPresence = new Map<string, UserPresence>()
  private eventCallbacks: WebSocketEventCallbacks = {}

  // Reactive state
  public readonly connectionState: Ref<WebSocketConnectionState>
  public readonly isConnected: Ref<boolean>
  public readonly connectedConversations = ref<string[]>([])
  public readonly onlineUsers = ref<string[]>([])
  public readonly typingUsers = ref<Record<string, string[]>>({})
  public readonly lastError: Ref<Error | null>
  public readonly messageQueue = ref<number>(0)

  // Statistics
  public readonly totalMessagesReceived = ref(0)
  public readonly connectionUptime = ref(0)
  private connectionStartTime = 0
  private uptimeTimer: NodeJS.Timeout | null = null

  constructor() {
    this.client = createWebSocketClient({
      enableLogging: import.meta.env.DEV,
      autoConnect: false,
      heartbeatInterval: 30000,
      maxReconnectAttempts: 10
    })

    // Bind reactive refs to client state
    this.connectionState = this.client.connectionState
    this.isConnected = this.client.isConnected
    this.lastError = this.client.lastError
    this.messageQueue = this.client.queueSize

    this.setupEventHandlers()
  }

  // Public API
  public async connect(): Promise<void> {
    const authStore = useAuthStore()
    if (!authStore.token) {
      throw new Error('Authentication required for WebSocket connection')
    }

    try {
      await this.client.connect()
      this.connectionStartTime = Date.now()
      this.startUptimeTimer()
    } catch (error) {
      console.error('Failed to connect WebSocket:', error)
      throw error
    }
  }

  public disconnect(): void {
    this.client.disconnect()
    this.cleanup()
  }

  // Conversation management
  public joinConversation(conversationId: string): void {
    if (this.conversations.has(conversationId)) {
      console.log(`Already joined conversation: ${conversationId}`)
      return
    }

    const connection: ConversationConnection = {
      conversationId,
      isActive: true,
      lastActivity: Date.now(),
      messageCount: 0,
      typingUsers: new Set()
    }

    this.conversations.set(conversationId, connection)
    this.updateConnectedConversations()

    // Send join message to server
    this.client.send({
      type: 'join_conversation',
      conversationId,
      timestamp: Date.now()
    })

    console.log(`Joined conversation: ${conversationId}`)
  }

  public leaveConversation(conversationId: string): void {
    const connection = this.conversations.get(conversationId)
    if (!connection) {
      console.log(`Not joined to conversation: ${conversationId}`)
      return
    }

    this.conversations.delete(conversationId)
    this.updateConnectedConversations()

    // Send leave message to server
    this.client.send({
      type: 'leave_conversation',
      conversationId,
      timestamp: Date.now()
    })

    // Clean up typing users for this conversation
    delete this.typingUsers.value[conversationId]

    console.log(`Left conversation: ${conversationId}`)
  }

  public isJoinedToConversation(conversationId: string): boolean {
    return this.conversations.has(conversationId)
  }

  // Message sending
  public sendMessage(conversationId: string, content: string, messageType = 'text'): boolean {
    if (!this.isJoinedToConversation(conversationId)) {
      console.warn(`Cannot send message to conversation ${conversationId}: not joined`)
      return false
    }

    return this.client.send({
      type: 'send_message',
      conversationId,
      data: {
        content,
        messageType,
        timestamp: Date.now()
      }
    })
  }

  // Typing indicators
  public startTyping(conversationId: string): void {
    if (!this.isJoinedToConversation(conversationId)) {return}

    this.client.send({
      type: 'typing_start',
      conversationId,
      timestamp: Date.now()
    })
  }

  public stopTyping(conversationId: string): void {
    if (!this.isJoinedToConversation(conversationId)) {return}

    this.client.send({
      type: 'typing_stop',
      conversationId,
      timestamp: Date.now()
    })
  }

  // User presence
  public updatePresence(status: 'online' | 'away' | 'busy', conversationId?: string): void {
    this.client.send({
      type: 'presence_update',
      data: {
        status,
        conversationId,
        timestamp: Date.now()
      }
    })
  }

  // Event handling
  public setEventCallbacks(callbacks: WebSocketEventCallbacks): void {
    this.eventCallbacks = { ...this.eventCallbacks, ...callbacks }
  }

  public clearEventCallbacks(): void {
    this.eventCallbacks = {}
  }

  // Statistics and utilities
  public getConversationStats(conversationId: string): ConversationConnection | null {
    return this.conversations.get(conversationId) || null
  }

  public getUserPresence(userId: string): UserPresence | null {
    return this.userPresence.get(userId) || null
  }

  public getTypingUsers(conversationId: string): string[] {
    return this.typingUsers.value[conversationId] || []
  }

  public isUserTyping(conversationId: string, userId: string): boolean {
    const typingInConversation = this.typingUsers.value[conversationId]
    return typingInConversation ? typingInConversation.includes(userId) : false
  }

  // Private methods
  private setupEventHandlers(): void {
    this.client.setEventHandlers({
      onMessage: (message: WebSocketMessage) => this.handleMessage(message),
      onConnectionChange: (state: WebSocketConnectionState) => this.handleConnectionChange(state),
      onError: (error: Error) => this.handleError(error),
      onReconnect: (attempt: number) => this.handleReconnect(attempt)
    })
  }

  private handleMessage(message: WebSocketMessage): void {
    this.totalMessagesReceived.value++

    switch (message.type) {
      case 'new_message':
        this.handleNewMessage(message)
        break

      case 'conversation_update':
        this.handleConversationUpdate(message)
        break

      case 'typing_start':
        this.handleTypingStart(message)
        break

      case 'typing_stop':
        this.handleTypingStop(message)
        break

      case 'user_presence':
        this.handleUserPresence(message)
        break

      case 'notification':
        this.handleNotification(message)
        break

      case 'conversation_assignment':
        this.handleConversationAssignment(message)
        break

      case 'system_update':
        this.handleSystemUpdate(message)
        break

      // 🆕 Team event handlers for real-time memberCount updates
      case 'team_member_added':
        this.handleTeamMemberAdded(message)
        break

      case 'team_member_removed':
        this.handleTeamMemberRemoved(message)
        break

      case 'team_updated':
        this.handleTeamUpdated(message)
        break

      default:
        console.log(`Unhandled WebSocket message type: ${message.type}`)
    }
  }

  private handleNewMessage(message: WebSocketMessage): void {
    const { conversationId, data } = message
    if (!conversationId || !data) {return}

    // Update conversation activity
    const connection = this.conversations.get(conversationId)
    if (connection) {
      connection.lastActivity = Date.now()
      connection.messageCount++
    }

    // Notify callback
    this.eventCallbacks.onConversationMessage?.(conversationId, data as Message)
  }

  private handleConversationUpdate(message: WebSocketMessage): void {
    const { conversationId, data } = message
    if (!conversationId || !data) {return}

    this.eventCallbacks.onConversationUpdate?.(conversationId, data as Conversation)
  }

  private handleTypingStart(message: WebSocketMessage): void {
    const { conversationId, data } = message
    if (!conversationId || !data || typeof data !== 'object' || !('userId' in data)) {return}

    const userId = (data as { userId: string }).userId
    const typingInConversation = this.typingUsers.value[conversationId] || []

    if (!typingInConversation.includes(userId)) {
      this.typingUsers.value[conversationId] = [...typingInConversation, userId]
    }

    // Update conversation connection
    const connection = this.conversations.get(conversationId)
    if (connection) {
      connection.typingUsers.add(userId)
    }

    this.eventCallbacks.onTypingStart?.(conversationId, userId)
  }

  private handleTypingStop(message: WebSocketMessage): void {
    const { conversationId, data } = message
    if (!conversationId || !data || typeof data !== 'object' || !('userId' in data)) {return}

    const userId = (data as { userId: string }).userId
    const typingInConversation = this.typingUsers.value[conversationId] || []

    this.typingUsers.value[conversationId] = typingInConversation.filter(id => id !== userId)

    // Update conversation connection
    const connection = this.conversations.get(conversationId)
    if (connection) {
      connection.typingUsers.delete(userId)
    }

    this.eventCallbacks.onTypingStop?.(conversationId, userId)
  }

  private handleUserPresence(message: WebSocketMessage): void {
    const { data } = message
    if (!data || typeof data !== 'object' || !('userId' in data)) {return}

    const typedData = data as {
      userId: string;
      isOnline?: boolean;
      lastSeen?: number;
      currentConversation?: string;
    }

    const presence: UserPresence = {
      userId: typedData.userId,
      isOnline: typedData.isOnline ?? false,
      lastSeen: typedData.lastSeen ?? Date.now(),
      currentConversation: typedData.currentConversation
    }

    this.userPresence.set(typedData.userId, presence)
    this.updateOnlineUsers()

    this.eventCallbacks.onUserPresence?.(typedData.userId, presence)
  }

  private handleNotification(message: WebSocketMessage): void {
    this.eventCallbacks.onNotification?.(message.data)
  }

  private handleConversationAssignment(message: WebSocketMessage): void {
    const { conversationId, data } = message
    if (!conversationId || !data) {return}

    // This could trigger conversation updates in the UI
    this.eventCallbacks.onConversationUpdate?.(conversationId, data as Conversation)
  }

  private handleSystemUpdate(message: WebSocketMessage): void {
    // Handle system-wide updates that might affect all conversations
    console.log('System update received:', message.data)
  }

  // 🆕 Team member added event handler
  private handleTeamMemberAdded(message: WebSocketMessage): void {
    const { data } = message
    if (!data || typeof data !== 'object') {return}

    const eventData = data as TeamMemberEventData
    console.log('👥 [WebSocket] Team member added:', {
      teamId: eventData.teamId,
      teamName: eventData.teamName,
      agentName: eventData.agentName,
      memberCount: eventData.memberCount
    })

    this.eventCallbacks.onTeamMemberAdded?.(eventData)
  }

  // 🆕 Team member removed event handler
  private handleTeamMemberRemoved(message: WebSocketMessage): void {
    const { data } = message
    if (!data || typeof data !== 'object') {return}

    const eventData = data as TeamMemberEventData
    console.log('👥 [WebSocket] Team member removed:', {
      teamId: eventData.teamId,
      teamName: eventData.teamName,
      agentName: eventData.agentName,
      memberCount: eventData.memberCount
    })

    this.eventCallbacks.onTeamMemberRemoved?.(eventData)
  }

  // 🆕 Team updated event handler
  private handleTeamUpdated(message: WebSocketMessage): void {
    const { data } = message
    if (!data || typeof data !== 'object') {return}

    const eventData = data as TeamUpdateEventData
    console.log('🔄 [WebSocket] Team updated:', {
      teamId: eventData.teamId,
      changes: eventData.changes
    })

    this.eventCallbacks.onTeamUpdated?.(eventData)
  }

  private handleConnectionChange(state: WebSocketConnectionState): void {
    console.log(`WebSocket connection state changed to: ${state}`)

    if (state === 'connected') {
      // Rejoin all conversations on reconnection
      this.rejoinConversations()
    } else if (state === 'disconnected' || state === 'error') {
      // Clear typing indicators and presence on disconnect
      this.clearTemporaryState()
    }

    this.eventCallbacks.onConnectionStateChange?.(state)
  }

  private handleError(error: Error): void {
    console.error('WebSocket error:', error)
    this.eventCallbacks.onError?.(error)
  }

  private handleReconnect(attempt: number): void {
    console.log(`WebSocket reconnection attempt: ${attempt}`)
  }

  private rejoinConversations(): void {
    // Rejoin all previously joined conversations
    for (const conversationId of this.conversations.keys()) {
      this.client.send({
        type: 'join_conversation',
        conversationId,
        timestamp: Date.now()
      })
    }
  }

  private clearTemporaryState(): void {
    // 🔥 Use nextTick to break synchronous execution chain and prevent infinite recursion
    // This ensures Vue's reactivity system processes updates in separate microtasks
    import('vue').then(({ nextTick }) => {
      nextTick(() => {
        // Clear typing indicators
        this.typingUsers.value = {}

        // Clear typing users from conversation connections
        for (const connection of this.conversations.values()) {
          connection.typingUsers.clear()
        }

        // Mark all users as offline
        for (const presence of this.userPresence.values()) {
          presence.isOnline = false
          presence.lastSeen = Date.now()
        }
        this.updateOnlineUsers()
      })
    })
  }

  private updateConnectedConversations(): void {
    this.connectedConversations.value = Array.from(this.conversations.keys())
  }

  private updateOnlineUsers(): void {
    this.onlineUsers.value = Array.from(this.userPresence.values())
      .filter(presence => presence.isOnline)
      .map(presence => presence.userId)
  }

  private startUptimeTimer(): void {
    this.stopUptimeTimer()
    this.uptimeTimer = setInterval(() => {
      if (this.isConnected.value && this.connectionStartTime > 0) {
        this.connectionUptime.value = Date.now() - this.connectionStartTime
      }
    }, 1000)
  }

  private stopUptimeTimer(): void {
    if (this.uptimeTimer) {
      clearInterval(this.uptimeTimer)
      this.uptimeTimer = null
    }
  }

  private cleanup(): void {
    this.stopUptimeTimer()
    this.conversations.clear()
    this.userPresence.clear()
    this.updateConnectedConversations()
    this.updateOnlineUsers()
    this.typingUsers.value = {}
    this.connectionUptime.value = 0
    this.connectionStartTime = 0
  }

  // Computed properties
  public readonly stats = computed(() => ({
    connectedConversations: this.connectedConversations.value.length,
    onlineUsers: this.onlineUsers.value.length,
    totalMessages: this.totalMessagesReceived.value,
    uptime: this.connectionUptime.value,
    queueSize: this.messageQueue.value,
    connectionState: this.connectionState.value
  }))

  // Cleanup on destruction
  public destroy(): void {
    console.log('Destroying WebSocket manager')
    this.disconnect()
    this.client.destroy()
    this.clearEventCallbacks()
  }
}

// Singleton instance for global use
let globalWebSocketManager: WebSocketManager | null = null

export function getWebSocketManager(): WebSocketManager {
  if (!globalWebSocketManager) {
    globalWebSocketManager = new WebSocketManager()
  }
  return globalWebSocketManager
}

export function destroyWebSocketManager(): void {
  if (globalWebSocketManager) {
    globalWebSocketManager.destroy()
    globalWebSocketManager = null
  }
}