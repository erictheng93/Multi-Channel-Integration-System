// 專案名稱：Multi-Channel Support MVP
// 檔案路徑：/frontend/src/utils/mockData.ts
// Created by: Mock Data Developer

import type { Conversation, Customer, Agent, Message, Platform } from '@/types'

const platforms: Platform[] = ['line', 'facebook']
const statuses: ('open' | 'assigned' | 'closed')[] = ['open', 'assigned', 'closed']

const mockCustomers: Customer[] = [
  { id: '1', name: '王小明', platform: 'line', platformUserId: 'line_001', avatarUrl: '', createdAt: Date.now() },
  { id: '2', name: '李小華', platform: 'facebook', platformUserId: 'fb_001', avatarUrl: '', createdAt: Date.now() },
  { id: '3', name: '張小美', platform: 'line', platformUserId: 'line_001', avatarUrl: '', createdAt: Date.now() },
  { id: '4', name: '陳小強', platform: 'facebook', platformUserId: 'fb_001', avatarUrl: '', createdAt: Date.now() },
  { id: '5', name: '林小雅', platform: 'line', platformUserId: 'line_002', avatarUrl: '', createdAt: Date.now() }
]

const mockAgents: Agent[] = [
  { id: '1', name: '客服小王', email: 'wang@example.com', isOnline: true, platforms: ['line', 'facebook'], role: 'agent', isActive: true, createdAt: Date.now() },
  { id: '2', name: '客服小李', email: 'li@example.com', isOnline: true, platforms: ['line', 'facebook'], role: 'agent', isActive: true, createdAt: Date.now() },
  { id: '3', name: '主管小陳', email: 'chen@example.com', isOnline: false, platforms, role: 'admin', isActive: true, createdAt: Date.now() }
]

export function generateMockConversations(count: number = 20): Conversation[] {
  const conversations: Conversation[] = []
  
  for (let i = 1; i <= count; i++) {
    const customer = mockCustomers[Math.floor(Math.random() * mockCustomers.length)]
    const status = statuses[Math.floor(Math.random() * statuses.length)]
    const assignedAgent = status === 'assigned' ? mockAgents[Math.floor(Math.random() * mockAgents.length)] : undefined
    
    if (!customer) {continue} // Skip if no customer found
    
    const conversation: Conversation = {
      id: `conv_${i}`,
      userId: customer.id,
      customer,
      assignedTo: assignedAgent?.id,
      assignedAgent,
      platform: customer.platform,
      status: status as 'open' | 'assigned' | 'closed',
      unreadCount: Math.random() > 0.5 ? Math.floor(Math.random() * 5) + 1 : 0,
      lastMessageAt: Date.now() - Math.random() * 24 * 60 * 60 * 1000,
      createdAt: Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now() - Math.random() * 24 * 60 * 60 * 1000,
      lastMessage: {
        id: `msg_${i}`,
        conversationId: `conv_${i}`,
        senderId: Math.random() > 0.5 ? customer.id : (assignedAgent?.id || 'system'),
        senderType: Math.random() > 0.5 ? 'customer' : 'agent',
        content: `這是第 ${i} 個對話的最後一則訊息`,
        timestamp: Date.now() - Math.random() * 24 * 60 * 60 * 1000,
        createdAt: Date.now() - Math.random() * 24 * 60 * 60 * 1000,
        platform: customer.platform,
        messageType: 'text'
      }
    }
    
    conversations.push(conversation)
  }
  
  return conversations.sort((a, b) => {
    const aTime = typeof a.updatedAt === 'number' ? a.updatedAt : a.updatedAt.getTime()
    const bTime = typeof b.updatedAt === 'number' ? b.updatedAt : b.updatedAt.getTime()
    return bTime - aTime
  })
}

export function generateMockMessages(conversationId: string, count: number = 10): Message[] {
  const messages: Message[] = []
  
  for (let i = 1; i <= count; i++) {
    const isCustomer = Math.random() > 0.5
    
    const message: Message = {
      id: `msg_${conversationId}_${i}`,
      conversationId,
      senderId: isCustomer ? 'customer_1' : 'agent_1',
      senderType: isCustomer ? 'customer' : 'agent',
      content: `這是第 ${i} 則${isCustomer ? '客戶' : '客服'}訊息`,
      timestamp: Date.now() - (count - i) * 60 * 1000,
      createdAt: Date.now() - (count - i) * 60 * 1000,
      platform: 'line',
      messageType: 'text'
    }
    
    messages.push(message)
  }
  
  return messages
}