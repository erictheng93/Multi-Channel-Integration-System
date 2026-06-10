// 錯誤處理工具
export const ERROR_MESSAGES = {
  // 對話相關錯誤
  FETCH_CONVERSATIONS_FAILED: '網路錯誤，無法載入對話列表',
  FETCH_CONVERSATION_FAILED: '無法載入對話詳情',
  CLOSE_CONVERSATION_FAILED: '對話結束失敗',
  ASSIGN_CONVERSATION_FAILED: '對話指派失敗',
  
  // 訊息相關錯誤
  SEND_MESSAGE_FAILED: '訊息發送失敗',
  MARK_AS_READ_FAILED: '標記已讀失敗',
  CONTENT_REQUIRED: '內容或媒體檔案為必填項',
  
  // 認證相關錯誤
  LOGIN_FAILED: '登入失敗',
  UNAUTHORIZED: '未授權訪問',
  FORBIDDEN: '權限不足',
  
  // 通用錯誤
  NETWORK_ERROR: '網路錯誤',
  NOT_FOUND: '資源不存在',
  VALIDATION_ERROR: '資料驗證失敗',
  UNKNOWN_ERROR: '未知錯誤'
} as const

// 錯誤訊息映射 - 將英文錯誤映射到中文
export const ERROR_MESSAGE_MAP: Record<string, string> = {
  'Network error': ERROR_MESSAGES.FETCH_CONVERSATIONS_FAILED,
  'Failed to fetch conversations': ERROR_MESSAGES.FETCH_CONVERSATIONS_FAILED,
  'Conversation not found': ERROR_MESSAGES.FETCH_CONVERSATION_FAILED,
  'Failed to close conversation': ERROR_MESSAGES.CLOSE_CONVERSATION_FAILED,
  'Failed to assign conversation': ERROR_MESSAGES.ASSIGN_CONVERSATION_FAILED,
  'Failed to send message': ERROR_MESSAGES.SEND_MESSAGE_FAILED,
  'Failed to mark as read': ERROR_MESSAGES.MARK_AS_READ_FAILED,
  'Content or media file is required': ERROR_MESSAGES.CONTENT_REQUIRED,
  'Login failed': ERROR_MESSAGES.LOGIN_FAILED,
  'Unauthorized': ERROR_MESSAGES.UNAUTHORIZED,
  'Forbidden': ERROR_MESSAGES.FORBIDDEN,
  'Not found': ERROR_MESSAGES.NOT_FOUND,
  'Validation error': ERROR_MESSAGES.VALIDATION_ERROR
}

// 輔助函數：將英文錯誤訊息轉換為中文
export const translateError = (error: unknown, defaultMessage?: string): string => {
  let errorMessage: string

  if (typeof error === 'string') {
    errorMessage = error
  } else if ((error as Error)?.message) {
    errorMessage = (error as Error).message
  } else if ((error as { error?: string })?.error) {
    errorMessage = (error as { error?: string }).error || defaultMessage || ERROR_MESSAGES.UNKNOWN_ERROR
  } else {
    errorMessage = defaultMessage || ERROR_MESSAGES.UNKNOWN_ERROR
  }
  
  // 嘗試映射到中文錯誤訊息
  return ERROR_MESSAGE_MAP[errorMessage] || errorMessage
}
