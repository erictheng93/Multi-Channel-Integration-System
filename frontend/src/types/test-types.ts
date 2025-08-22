// 測試相關的類型定義

import type { ComponentPublicInstance } from 'vue'
import type { MockedFunction } from 'vitest'
import type { Message, Conversation } from '@/types'
import type { FileUploadItem, FileUploadResult } from '@/types/file-upload'

// Vue 組件實例的測試類型
export interface TestComponentInstance extends ComponentPublicInstance {
  // MessageBubble 組件測試類型
  formatFileSize?: (bytes: number) => string
  getFileExtension?: (filename: string) => string
  getFileTypeClass?: (filename: string) => string
  
  // MessageInput 組件測試類型
  messageContent?: string
  isLoading?: boolean
  
  // DelayedMessageSender 組件測試類型
  delaySeconds?: number
  customDelaySeconds?: number
  formatScheduledTime?: (date: Date) => string
  getCountdown?: (scheduledTime: string) => string
  countdownTimer?: NodeJS.Timeout | null
  recallingMessages?: Set<string>
  
  // FileUpload 組件測試類型
  uploadFile?: (fileItem: FileUploadItem) => Promise<void>
}

// 測試用的 FileItem 接口
export interface FileItem {
  file: File
  id: string
  progress?: number
  status?: 'pending' | 'uploading' | 'completed' | 'failed'
  error?: string
}

// 待發送訊息類型
export interface PendingMessage {
  id: string
  conversationId?: string | number
  content: string
  scheduledSendTime: string
  canRecall: boolean
  status: 'pending' | 'sent' | 'cancelled'
}

// Mock API 響應類型
export interface MockApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Mock Message API
export interface MockMessageApi {
  send: MockedFunction<(conversationId: string, data: Record<string, unknown>) => Promise<MockApiResponse<Message>>>
  list: MockedFunction<(conversationId: string, params?: Record<string, unknown>) => Promise<MockApiResponse<Message[]>>>
  listPaginated: MockedFunction<(conversationId: string, params?: Record<string, unknown>) => Promise<MockApiResponse<{ items: Message[], total: number }>>>
  search: MockedFunction<(conversationId: string, query: string, messageType?: string) => Promise<MockApiResponse<Message[]>>>
  delete: MockedFunction<(messageId: string) => Promise<MockApiResponse<void>>>
  recall: MockedFunction<(messageId: string) => Promise<MockApiResponse<void>>>
  sendDelayed: MockedFunction<(request: DelayedMessageRequest) => Promise<MockApiResponse<DelayedMessageResponse>>>
  getPendingMessages: MockedFunction<(page: number, pageSize: number) => Promise<MockApiResponse<{ items: PendingMessage[], total: number }>>>
  canRecallMessage: MockedFunction<(messageId: string, userId: string) => Promise<MockApiResponse<{ canRecall: boolean }>>>
  getMessageDetails: MockedFunction<(messageId: string) => Promise<MockApiResponse<PendingMessage>>>
}

// Mock File API
export interface MockFileApi {
  upload: MockedFunction<(file: File) => Promise<FileUploadResult>>
  getFiles: MockedFunction<(page: number, pageSize: number, platform?: string) => Promise<MockApiResponse<{ items: unknown[], total: number }>>>
  deleteFile: MockedFunction<(fileId: string) => Promise<MockApiResponse<boolean>>>
  deleteMultipleFiles: MockedFunction<(fileIds: string[]) => Promise<MockApiResponse<{ successful: string[], failed: string[] }>>>
  getDownloadUrl: MockedFunction<(fileId: string, expiresIn?: number) => Promise<MockApiResponse<{ url: string }>>>
  searchFiles: MockedFunction<(params: Record<string, unknown>) => Promise<MockApiResponse<{ items: unknown[], total: number }>>>
  getFileStats: MockedFunction<(period: string) => Promise<MockApiResponse<Record<string, unknown>>>>
}

// 測試用的 Mock Props 類型
export interface MockProps {
  message?: Partial<Message>
  conversation?: Partial<Conversation>
  conversations?: Partial<Conversation>[]
  [key: string]: unknown
}

// 測試用的 Event Emits 類型
export interface TestEmits {
  'message-sent'?: (result: unknown) => void
  'upload-complete'?: (result: FileUploadResult) => void
  'upload-error'?: (error: string) => void
  'create-delayed'?: () => void
  'view-pending'?: (messageId: string) => void
  [key: string]: ((...args: unknown[]) => void) | undefined
}

// 測試工具函數類型
export type CreateWrapperFunction = (props?: MockProps) => unknown
export type SetupTestFunction = () => void | Promise<void>
export type CleanupTestFunction = () => void | Promise<void>

// 測試用的全域配置類型
export interface TestGlobalConfig {
  plugins: unknown[]
  mocks?: Record<string, unknown>
  stubs?: Record<string, unknown>
  provide?: Record<string | symbol, unknown>
}

// 測試用的延遲訊息請求類型
export interface DelayedMessageRequest {
  conversationId: number | string
  content: string
  delaySeconds: number
  platform?: string
  messageType?: string
}

// 測試用的延遲訊息響應類型
export interface DelayedMessageResponse {
  messageId: string
  scheduledSendTime: string
  recallDeadline: string
  status: 'pending' | 'sent' | 'cancelled'
}