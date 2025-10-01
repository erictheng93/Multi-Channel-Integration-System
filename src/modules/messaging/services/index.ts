// Messaging Services 導出
// 統一導出所有訊息服務類

export { MessageCrudService } from './message-crud';
export { DelayedMessageService } from './delayed-message-service';
export { MessageRecallService } from './message-recall-service';

// 服務工廠函數
import type { Bindings } from '@/types';
import type { D1Database } from '@cloudflare/workers-types';

export function createMessagingServices(db: D1Database, env: Bindings) {
  // TODO: Implement messaging services
  return {
    crud: null as any, // new MessageCrudService(db),
    delayed: null as any, // new DelayedMessageService(db, env),
    recall: null as any // new MessageRecallService(db, env)
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