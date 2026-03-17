// src/modules/auto-reply/services/action-executor.ts
// Executes auto-reply actions by building LINE messages and sending via Reply or Push API

import type { Bindings } from '@/types';
import type { LineReplyMessage } from '@/types';
import type { AutoReplyActionData, ReplyMethod, TextActionContent, ImageActionContent } from '../types';
import { sendLineReply, pushLineMessage, createTextMessage, createImageMessage } from '@/utils/line';
import { createContextLogger } from '@/utils/logger';

const log = createContextLogger('ActionExecutor');

export interface ActionExecuteResult {
  success: boolean;
  replyMethod: ReplyMethod;
  messageCount: number;
  error?: string;
}

/**
 * Execute auto-reply actions: build LINE messages and send them.
 * Tries Reply API first (free), falls back to Push API on failure.
 */
export async function executeActions(
  actions: AutoReplyActionData[],
  replyToken: string | null,
  platformUserId: string,
  env: Bindings
): Promise<ActionExecuteResult> {
  if (actions.length === 0) {
    return { success: false, replyMethod: 'reply_api', messageCount: 0, error: 'No actions to execute' };
  }

  // Sort by sortOrder
  const sorted = [...actions].sort((a, b) => a.sortOrder - b.sortOrder);

  // Build LINE message objects
  const messages = sorted
    .map((action) => buildLineMessage(action))
    .filter((msg): msg is LineReplyMessage => msg !== null);

  if (messages.length === 0) {
    return { success: false, replyMethod: 'reply_api', messageCount: 0, error: 'No valid messages built' };
  }

  // LINE API allows max 5 messages per reply/push
  const messageBatch = messages.slice(0, 5);

  const accessToken = env.LINE_CHANNEL_ACCESS_TOKEN;
  let replyMethod: ReplyMethod = 'reply_api';

  // Try Reply API first (free)
  if (replyToken) {
    log.info('Attempting Reply API', { replyToken: replyToken.slice(0, 10) + '...', messageCount: messageBatch.length, messageTypes: messageBatch.map(m => m.type) });
    const replySuccess = await sendLineReply(accessToken, replyToken, messageBatch);
    if (replySuccess) {
      log.info('Auto-reply sent via Reply API', { messageCount: messageBatch.length });
      return { success: true, replyMethod: 'reply_api', messageCount: messageBatch.length };
    }
    log.warn('Reply API failed, falling back to Push API');
  } else {
    log.info('No replyToken, using Push API directly');
  }

  // Fallback to Push API (costs quota)
  replyMethod = 'push_api';
  log.info('Attempting Push API', { platformUserId: platformUserId.slice(0, 10) + '...', messageCount: messageBatch.length });
  const pushSuccess = await pushLineMessage(accessToken, platformUserId, messageBatch);

  if (pushSuccess) {
    log.info('Auto-reply sent via Push API (fallback)', { messageCount: messageBatch.length });
    return { success: true, replyMethod, messageCount: messageBatch.length };
  }

  log.error('Both Reply API and Push API failed', { messageCount: messageBatch.length });
  return {
    success: false,
    replyMethod,
    messageCount: 0,
    error: 'Both Reply API and Push API failed',
  };
}

/**
 * Build a LINE message object from an action definition.
 */
function buildLineMessage(action: AutoReplyActionData): LineReplyMessage | null {
  try {
    switch (action.actionType) {
      case 'reply_text': {
        const parsed = JSON.parse(action.content) as TextActionContent;
        return createTextMessage(parsed.text);
      }

      case 'reply_image': {
        const parsed = JSON.parse(action.content) as ImageActionContent;
        return createImageMessage(parsed.url, parsed.previewUrl || parsed.url);
      }

      case 'reply_flex': {
        // Raw Flex Message JSON — pass through directly
        const flexContent = JSON.parse(action.content) as Record<string, unknown>;
        return {
          type: 'flex',
          altText: (flexContent.altText as string) || 'Auto-reply',
          contents: flexContent.contents || flexContent,
        } as LineReplyMessage;
      }

      default:
        log.warn('Unknown action type', { actionType: action.actionType });
        return null;
    }
  } catch (error) {
    log.error('Error building LINE message from action', {
      actionType: action.actionType,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
