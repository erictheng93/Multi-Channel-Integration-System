// Messaging Services 導出
// 統一導出所有訊息服務類

export { MessageCrudService } from './message-crud';
export { DelayedMessageService } from './delayed-message-service';
export { MessageRecallService } from './message-recall-service';

// 服務工廠函數
import type { Bindings } from '@/types';
import type { D1Database } from '@cloudflare/workers-types';

export function createMessagingServices(_db: D1Database, _env: Bindings) {
  // Note: Services are exported above and can be instantiated directly
  // Using null as placeholders - instantiate services when module initialization is needed
  // Services available: MessageCrudService, DelayedMessageService, MessageRecallService
  return {
    crud: null as any, // Use: new MessageCrudService(db)
    delayed: null as any, // Use: new DelayedMessageService(db, env)
    recall: null as any // Use: new MessageRecallService(db, env)
  };
}

// 服務介面定義
export interface MessagingServices {
  crud: any; // MessageCrudService;
  delayed: any; // DelayedMessageService;
  recall: any; // MessageRecallService;
}

// 重新導出類型
export type {
  Message,
  MessageWithDetails,
  MessageListItem,
  MessageSearchQuery,
  MessageSearchResult,
  DelayedMessage,
  DelayedSendRequest,
  DelayedSendResponse,
  MessageRecall,
  RecallRequest,
  RecallResponse,
  MessageNotFoundError,
  RecallDeadlineExceededError,
  InvalidMessageDataError
} from '../types/message-types';