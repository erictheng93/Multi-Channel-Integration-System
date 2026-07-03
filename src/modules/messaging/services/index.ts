// Messaging Services 導出
// 統一導出所有訊息服務類

export { MessageCrudService } from './message-crud';
export { MessageRecallService } from './message-recall-service';

// 服務工廠函數
import type { Bindings } from '@/types';
import type { D1Database } from '@cloudflare/workers-types';
import { MessageCrudService } from './message-crud';
import { MessageRecallService } from './message-recall-service';

export function createMessagingServices(db: D1Database, env: Bindings): MessagingServices {
  return {
    crud: new MessageCrudService(db),
    recall: new MessageRecallService(db, env)
  };
}

// 服務介面定義
export interface MessagingServices {
  crud: MessageCrudService;
  recall: MessageRecallService;
}

// 重新導出類型
export type {
  Message,
  MessageWithDetails,
  MessageListItem,
  MessageSearchQuery,
  MessageSearchResult,
  MessageRecall,
  RecallRequest,
  RecallResponse,
  MessageNotFoundError,
  RecallDeadlineExceededError,
  InvalidMessageDataError
} from '../types/message-types';
