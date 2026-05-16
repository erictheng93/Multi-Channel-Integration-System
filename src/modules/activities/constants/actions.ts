// Activities Module - Action Constants
// 活動模組 - 動作常數定義

export const ACTIVITY_ACTIONS = {
  // 對話相關 (Conversation)
  CONVERSATION_ASSIGN: 'conversation_assign',
  CONVERSATION_TRANSFER: 'conversation_transfer',
  CONVERSATION_CLOSE: 'conversation_close',
  CONVERSATION_REOPEN: 'conversation_reopen',

  // 訊息相關 (Message)
  MESSAGE_SEND: 'message_send',
  MESSAGE_RECALL: 'message_recall',

  // 用戶管理 (User Management)
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  USER_CREATE: 'user_create',
  USER_UPDATE: 'user_update',
  USER_DELETE: 'user_delete',
  USER_BULK_DELETE: 'user_bulk_delete', // 批量刪除成員
  USER_BULK_UPDATE: 'user_bulk_update', // 批量更新成員
  USER_RESTORE: 'user_restore', // 恢復已刪除成員

  // 系統設定 (System Settings)
  SETTINGS_UPDATE: 'settings_update',
  INTEGRATION_CREATE: 'integration_create',

  // 團隊管理 (Team Management)
  TEAM_CREATE: 'team_create',
  TEAM_UPDATE: 'team_update',
  TEAM_DELETE: 'team_delete',
  TEAM_INVITE: 'team_invite',
  TEAM_MEMBER_UPDATE: 'team_member_update',
  TEAM_MEMBER_REMOVE: 'team_member_remove',

  // 團隊成員操作 (Team Member Operations)
  MEMBER_ADD: 'member_add',
  MEMBER_REMOVE: 'member_remove',

  // QR碼相關 (QR Code)
  QR_CODE_GENERATE: 'qr_code_generate',

  // 客戶管理 (Customer Management)
  CUSTOMER_CREATE: 'customer_create',
  CUSTOMER_UPDATE: 'customer_update',
  CUSTOMER_DELETE: 'customer_delete',

  // 客戶互動 (Customer Interactions - Webhook)
  CUSTOMER_FOLLOWED: 'customer_followed',
  CUSTOMER_UNFOLLOWED: 'customer_unfollowed',
  MESSAGE_RECEIVED: 'message_received',

  // 標籤管理 (Tag Management)
  TAG_CREATE: 'tag_create',
  TAG_UPDATE: 'tag_update',
  TAG_DELETE: 'tag_delete',
  TAG_ASSIGN: 'tag_assign',
  TAG_UNASSIGN: 'tag_unassign',
  TAG_BULK_UPDATE: 'tag_bulk_update',

  // 延遲訊息 (Delayed Message)
  DELAYED_MESSAGE_SCHEDULE: 'delayed_message_schedule',
  DELAYED_MESSAGE_CANCEL: 'delayed_message_cancel',

  // 對話額外操作 (Conversation Additional)
  CONVERSATION_UNASSIGN: 'conversation_unassign',
  CONVERSATION_BULK_ASSIGN: 'conversation_bulk_assign',

  // 訊息額外操作 (Message Additional)
  MESSAGE_FORWARD: 'message_forward',

  // 檔案管理 (File Management)
  FILE_UPLOAD: 'file_upload',
  FILE_DELETE: 'file_delete',

  // 系統監控 (System Monitoring)
  SYSTEM_HEALTH_CHECK: 'system_health_check',
  SYSTEM_BACKUP: 'system_backup',
  SYSTEM_RESTORE: 'system_restore'
} as const

export type ActivityAction = typeof ACTIVITY_ACTIONS[keyof typeof ACTIVITY_ACTIONS]
