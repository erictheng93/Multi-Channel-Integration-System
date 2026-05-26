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

export interface ExecuteActionsOptions {
  // Per-rule opt-in: when true, Reply API failures fall back to Push API
  // (consumes monthly Push quota but guarantees delivery for business-critical
  // rules). Default false to preserve quota for normal rules.
  allowPushFallback?: boolean;
}

/**
 * Execute auto-reply actions: build LINE messages and send them.
 * Uses Reply API when a replyToken exists. Push API is used only when:
 *   (a) there is no replyToken, or
 *   (b) Reply API failed AND options.allowPushFallback is true (per-rule opt-in).
 * Reply API failures without the opt-in flag are surfaced as errors to preserve quota.
 */
export async function executeActions(
  actions: AutoReplyActionData[],
  replyToken: string | null,
  platformUserId: string,
  env: Bindings,
  options: ExecuteActionsOptions = {}
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
  const allowPushFallback = options.allowPushFallback === true;

  if (replyToken) {
    log.info('Attempting Reply API', { replyToken: replyToken.slice(0, 10) + '...', messageCount: messageBatch.length, messageTypes: messageBatch.map(m => m.type), allowPushFallback });
    const replySuccess = await sendLineReply(accessToken, replyToken, messageBatch);
    if (replySuccess) {
      log.info('Auto-reply sent via Reply API', { messageCount: messageBatch.length });
      return { success: true, replyMethod: 'reply_api', messageCount: messageBatch.length };
    }

    if (!allowPushFallback) {
      log.error('Reply API failed; Push API fallback is disabled for this rule', { messageCount: messageBatch.length });
      return {
        success: false,
        replyMethod: 'reply_api',
        messageCount: 0,
        error: 'Reply API failed',
      };
    }

    log.warn('Reply API failed; falling back to Push API (rule opt-in)', { messageCount: messageBatch.length });
    const fallbackSuccess = await pushLineMessage(accessToken, platformUserId, messageBatch);
    if (fallbackSuccess) {
      log.info('Auto-reply sent via Push API (Reply API fallback)', { messageCount: messageBatch.length });
      return { success: true, replyMethod: 'push_api', messageCount: messageBatch.length };
    }

    log.error('Both Reply API and Push API fallback failed', { messageCount: messageBatch.length });
    return {
      success: false,
      replyMethod: 'push_api',
      messageCount: 0,
      error: 'Reply API failed; Push API fallback also failed',
    };
  }

  const replyMethod: ReplyMethod = 'push_api';
  log.info('No replyToken, using Push API directly');
  log.info('Attempting Push API', { platformUserId: platformUserId.slice(0, 10) + '...', messageCount: messageBatch.length });
  const pushSuccess = await pushLineMessage(accessToken, platformUserId, messageBatch);

  if (pushSuccess) {
    log.info('Auto-reply sent via Push API', { messageCount: messageBatch.length });
    return { success: true, replyMethod, messageCount: messageBatch.length };
  }

  log.error('Push API failed', { messageCount: messageBatch.length });
  return {
    success: false,
    replyMethod,
    messageCount: 0,
    error: 'Push API failed',
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
