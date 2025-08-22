// 統一的錯誤訊息常數
// 確保前後端錯誤訊息一致性

export const ERROR_MESSAGES = {
  // 對話管理相關錯誤
  FETCH_CONVERSATIONS_FAILED: '獲取對話列表失敗',
  CONVERSATION_NOT_FOUND: '無法載入對話詳情',
  CLOSE_CONVERSATION_FAILED: '對話結束失敗',
  ASSIGN_CONVERSATION_FAILED: '對話指派失敗',
  
  // 訊息相關錯誤
  SEND_MESSAGE_FAILED: '訊息發送失敗',
  CONTENT_REQUIRED: '內容或媒體檔案為必填項',
  MESSAGE_TOO_LONG: '訊息內容過長',
  
  // 用戶操作相關錯誤
  MARK_READ_FAILED: '標記已讀失敗',
  LOAD_MESSAGES_FAILED: '載入訊息失敗',
  
  // 網路和系統錯誤
  NETWORK_ERROR: '網路錯誤，無法載入對話列表',
  UNAUTHORIZED: '未授權訪問',
  FORBIDDEN: '權限不足',
  NOT_FOUND: '資源不存在',
  VALIDATION_ERROR: '資料驗證失敗',
  INTERNAL_ERROR: '系統內部錯誤',
  
  // 認證相關錯誤
  LOGIN_FAILED: '登入失敗',
  TOKEN_EXPIRED: '登入已過期，請重新登入',
  INVALID_CREDENTIALS: '帳號或密碼錯誤',
  
  // 檔案上傳相關錯誤
  FILE_TOO_LARGE: '檔案大小超過限制',
  INVALID_FILE_TYPE: '不支援的檔案類型',
  UPLOAD_FAILED: '檔案上傳失敗',
  
  // 團隊管理相關錯誤
  TEAM_NOT_FOUND: '團隊不存在',
  TEAM_CREATE_FAILED: '建立團隊失敗',
  TEAM_UPDATE_FAILED: '更新團隊失敗',
  TEAM_DELETE_FAILED: '刪除團隊失敗',
  
  // 權限相關錯誤
  PERMISSION_DENIED: '權限不足',
  ROLE_INVALID: '無效的角色',
  ACCESS_DENIED: '拒絕訪問',
  
  // 新增的後端錯誤訊息
  FAILED_TO_GET_PROFILE: '獲取個人資料失敗',
  FAILED_TO_RECALL_MESSAGE: '撤回訊息失敗',
  FAILED_TO_GET_PENDING_MESSAGES: '獲取待處理訊息失敗',
  FAILED_TO_GET_RECALL_STATS: '獲取撤回統計失敗',
  FAILED_TO_GET_TEAMS: '獲取團隊列表失敗',
  FAILED_TO_CREATE_TEAM: '建立團隊失敗',
  FAILED_TO_GET_TEAM: '獲取團隊資料失敗',
  FAILED_TO_UPDATE_TEAM: '更新團隊失敗',
  FAILED_TO_DELETE_TEAM: '刪除團隊失敗',
  FAILED_TO_GET_TEAM_MEMBERS: '獲取團隊成員失敗',
  FAILED_TO_GET_TEAM_STATS: '獲取團隊統計失敗',
  FAILED_TO_GENERATE_QR_CODE: '生成 QR 碼失敗',
  FAILED_TO_GET_QR_CODES: '獲取 QR 碼列表失敗',
  FAILED_TO_DEACTIVATE_QR_CODE: '停用 QR 碼失敗',
  FAILED_TO_TRANSFER_CONVERSATION: '轉移對話失敗',
  FAILED_TO_GET_CONVERSATIONS: '獲取對話列表失敗',
  FAILED_TO_GET_TRANSFER_HISTORY: '獲取轉移歷史失敗'
} as const

// 錯誤訊息類型
export type ErrorMessageKey = keyof typeof ERROR_MESSAGES

// 獲取錯誤訊息的工具函數
export const getErrorMessage = (key: ErrorMessageKey): string => {
  return ERROR_MESSAGES[key]
}

// 用於測試的錯誤訊息驗證函數
export const expectErrorMessage = (actual: string, expected: ErrorMessageKey): void => {
  if (actual !== ERROR_MESSAGES[expected]) {
    throw new Error(`Expected error message "${ERROR_MESSAGES[expected]}", but got "${actual}"`)
  }
}

// 英文到中文錯誤訊息映射 (用於向後兼容)
export const ENGLISH_TO_CHINESE_ERROR_MAP: Record<string, string> = {
  'Failed to close conversation': ERROR_MESSAGES.CLOSE_CONVERSATION_FAILED,
  'Failed to assign conversation': ERROR_MESSAGES.ASSIGN_CONVERSATION_FAILED,
  'Failed to send message': ERROR_MESSAGES.SEND_MESSAGE_FAILED,
  'Failed to mark as read': ERROR_MESSAGES.MARK_READ_FAILED,
  'Failed to fetch conversations': ERROR_MESSAGES.FETCH_CONVERSATIONS_FAILED,
  'Content or media is required': ERROR_MESSAGES.CONTENT_REQUIRED,
  'Content, media, or attachments are required': ERROR_MESSAGES.CONTENT_REQUIRED,
  'Network error': ERROR_MESSAGES.NETWORK_ERROR,
  'Unauthorized': ERROR_MESSAGES.UNAUTHORIZED,
  'Forbidden': ERROR_MESSAGES.FORBIDDEN,
  'Not found': ERROR_MESSAGES.NOT_FOUND,
  'Validation error': ERROR_MESSAGES.VALIDATION_ERROR,
  'Internal error': ERROR_MESSAGES.INTERNAL_ERROR,
  
  // 新增的後端錯誤訊息映射
  'Failed to get profile': ERROR_MESSAGES.FAILED_TO_GET_PROFILE,
  'Failed to recall message': ERROR_MESSAGES.FAILED_TO_RECALL_MESSAGE,
  'Failed to get pending messages': ERROR_MESSAGES.FAILED_TO_GET_PENDING_MESSAGES,
  'Failed to get recall stats': ERROR_MESSAGES.FAILED_TO_GET_RECALL_STATS,
  'Failed to get teams': ERROR_MESSAGES.FAILED_TO_GET_TEAMS,
  'Failed to create team': ERROR_MESSAGES.FAILED_TO_CREATE_TEAM,
  'Failed to get team': ERROR_MESSAGES.FAILED_TO_GET_TEAM,
  'Failed to update team': ERROR_MESSAGES.FAILED_TO_UPDATE_TEAM,
  'Failed to delete team': ERROR_MESSAGES.FAILED_TO_DELETE_TEAM,
  'Failed to get team members': ERROR_MESSAGES.FAILED_TO_GET_TEAM_MEMBERS,
  'Failed to get team stats': ERROR_MESSAGES.FAILED_TO_GET_TEAM_STATS,
  'Failed to generate QR code': ERROR_MESSAGES.FAILED_TO_GENERATE_QR_CODE,
  'Failed to get QR codes': ERROR_MESSAGES.FAILED_TO_GET_QR_CODES,
  'Failed to deactivate QR code': ERROR_MESSAGES.FAILED_TO_DEACTIVATE_QR_CODE,
  'Failed to transfer conversation': ERROR_MESSAGES.FAILED_TO_TRANSFER_CONVERSATION,
  'Failed to get conversations': ERROR_MESSAGES.FAILED_TO_GET_CONVERSATIONS,
  'Failed to get transfer history': ERROR_MESSAGES.FAILED_TO_GET_TRANSFER_HISTORY
}

// 轉換英文錯誤訊息為中文的工具函數
export const translateErrorMessage = (englishMessage: string): string => {
  return ENGLISH_TO_CHINESE_ERROR_MAP[englishMessage] || englishMessage
}