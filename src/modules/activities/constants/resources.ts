// Activities Module - Resource Type Constants
// 活動模組 - 資源類型常數定義

export const RESOURCE_TYPES = {
  CONVERSATION: 'conversation',
  MESSAGE: 'message',
  USER: 'user',
  TEAM: 'team',
  CUSTOMER: 'customer',
  SYSTEM: 'system',
  FILE: 'file',
  QR_CODE: 'qr_code',
  WEBHOOK: 'webhook',
  INTEGRATION: 'integration'
} as const

export type ResourceType = typeof RESOURCE_TYPES[keyof typeof RESOURCE_TYPES]