// Messaging Services 導出
// 統一導出所有訊息服務類

export { MessageCrudService } from './message-crud';
export { DelayedMessageService } from './delayed-message-service';
export { MessageRecallService } from './message-recall-service';

// 服務工廠函數
import type { Bindings } from '@/types';
import type { D1Database } from '@cloudflare/workers-types';
import { MessageCrudService } from './message-crud';
import { DelayedMessageService } from './delayed-message-service';
import { MessageRecallService } from './message-recall-service';

export function createMessagingServices(db: D1Database, env: Bindings): MessagingServices {
  return {
    crud: new MessageCrudService(db),
    delayed: new DelayedMessageService(db, env),
    recall: new MessageRecallService(db, env)
  };
}

// 服務介面定義
export interface MessagingServices {
  crud: MessageCrudService;
  delayed: DelayedMessageService;
  recall: MessageRecallService;
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
