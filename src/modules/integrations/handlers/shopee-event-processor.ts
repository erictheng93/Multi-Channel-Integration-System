// src/modules/integrations/handlers/shopee-event-processor.ts
// Shopee Push consumer (spec §5). Runs in the LINE_MESSAGE_QUEUE consumer; a throw retries, then DLQ.
// Hard rule: nothing here may reach src/modules/auto-reply (Shopee forbids chatbot replies).

import type { Bindings } from '@/types';
import { createDbClient } from '@/db/drizzle-factory';
import { WebSocketBroadcastService } from '@/services/websocket-broadcast-service';
import { createContextLogger } from '@/utils/logger';
import { nowMs } from '@/utils/timestamp';
import { findOrCreateConversation, isDuplicateMessage, notifyNewConversation, saveMessage } from '../services/webhook-conversation-service';
import { findOrCreateCustomer } from '../services/webhook-customer-service';
import { findShopeeChannelByShopId, updateShopeeChannelConfig } from '../services/shopee/shopee-channel-repository';
import { SHOPEE_PUSH_CODE, shopeePlatformMessageId, shopeePlatformUserId } from '../services/shopee/shopee-types';

const log = createContextLogger('ShopeePush');

interface ShopeePush {
  shop_id?: unknown;
  code?: unknown;
  data?: unknown;
}

/** The webchat payload is not documented to us yet: only the fields read below are trusted, all optional. */
interface ShopeeWebchatMessage {
  message_id?: string | number;
  from_id?: string | number;
  from_shop_id?: string | number;
  from_user_name?: string;
  message_type?: string;
  content?: {
    text?: string;
    url?: string;
    image_url?: string;
    thumb_url?: string;
    video_url?: string;
    item_id?: string | number;
    item_name?: string;
    name?: string;
  };
}

export interface ParsedShopeeMessage {
  messageId: string;
  buyerId: string;
  buyerName?: string;
  content: string;
  /** Always 'text': Shopee media are external URLs with no file_attachments row to render. */
  messageType: 'text';
  metadata: Record<string, unknown>;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const idOf = (v: unknown): string | undefined =>
  ((typeof v === 'string' && v) || (typeof v === 'number' && Number.isFinite(v))) ? String(v) : undefined;

/**
 * Map a Code 10 `data` object to a stored message, or null when it is not a buyer message.
 * Unknown content types become a text summary so a message is never dropped.
 */
export function parseShopeeWebchat(shopId: number, data: unknown): ParsedShopeeMessage | null {
  if (!isObj(data) || data.type !== 'message') return null;
  // Observed shapes differ by doc version: the message sits in data.content or directly in data.
  const msg = (isObj(data.content) && 'message_id' in data.content ? data.content : data) as ShopeeWebchatMessage;
  if (idOf(msg.from_shop_id) === String(shopId)) return null; // seller-side echo
  const messageId = idOf(msg.message_id);
  const buyerId = idOf(msg.from_id);
  if (!messageId || !buyerId) {
    // Throw so the push lands in the DLQ for inspection instead of vanishing.
    throw new Error(`Shopee webchat message without message_id/from_id (keys: ${Object.keys(msg).join(',')})`);
  }

  const body = isObj(msg.content) ? msg.content : {};
  const type = typeof msg.message_type === 'string' ? msg.message_type : 'unknown';
  const metadata: Record<string, unknown> = { shopee: { messageType: type } };
  let content: string;
  switch (type) {
    case 'text':
      content = typeof body.text === 'string' && body.text ? body.text : '[空白訊息]';
      break;
    case 'image': {
      const url = body.url || body.image_url;
      content = '[圖片]';
      if (url) Object.assign(metadata, { url, thumbUrl: body.thumb_url, type: 'image' });
      break;
    }
    case 'video': {
      const url = body.video_url || body.url;
      content = '[影片]';
      if (url) Object.assign(metadata, { url, thumbUrl: body.thumb_url, type: 'video' });
      break;
    }
    case 'item': {
      const name = body.item_name || body.name || idOf(body.item_id) || '';
      content = `[商品] ${name}`.trim();
      metadata.shopee = { messageType: type, itemId: idOf(body.item_id) };
      break;
    }
    default:
      content = '[未支援的訊息類型]';
  }

  return {
    messageId,
    buyerId,
    buyerName: typeof msg.from_user_name === 'string' ? msg.from_user_name : undefined,
    content,
    messageType: 'text',
    metadata,
  };
}

/** Process one verified push body. Returns normally (ack) for anything not actionable. */
export async function processShopeePush(env: Bindings, rawBody: string): Promise<void> {
  let push: ShopeePush;
  try {
    push = JSON.parse(rawBody) as ShopeePush;
  } catch {
    log.warn('Shopee push: unparseable body', { bodyLength: rawBody.length });
    return;
  }
  const shopId = typeof push.shop_id === 'number' ? push.shop_id : Number(push.shop_id);
  const code = push.code;
  if (
    !Number.isFinite(shopId) ||
    (code !== SHOPEE_PUSH_CODE.WEBCHAT &&
      code !== SHOPEE_PUSH_CODE.SHOP_AUTHORIZATION_CANCELED &&
      code !== SHOPEE_PUSH_CODE.AUTHORIZATION_EXPIRY)
  ) {
    log.info('Shopee push ignored', { code });
    return;
  }

  const db = createDbClient(env.DB);
  const channel = await findShopeeChannelByShopId(db, shopId);
  if (!channel) {
    log.warn('Shopee push for unknown shop', { shopId, code });
    return;
  }

  if (code === SHOPEE_PUSH_CODE.SHOP_AUTHORIZATION_CANCELED) {
    await updateShopeeChannelConfig(db, channel, { authStatus: 'revoked', authStatusReason: 'push:2' });
    log.info('Shopee shop authorization canceled', { shopId, channelId: channel.id });
    return;
  }
  if (code === SHOPEE_PUSH_CODE.AUTHORIZATION_EXPIRY) {
    const s = channel.config.authStatus;
    if (s !== 'revoked' && s !== 'reauth_required') {
      await updateShopeeChannelConfig(db, channel, { authStatus: 'expiring', authStatusReason: 'push:12' });
    }
    log.info('Shopee shop authorization expiring', { shopId, channelId: channel.id });
    return;
  }

  if (!channel.isActive) {
    log.warn('Shopee webchat push for inactive channel', { shopId, channelId: channel.id });
    return;
  }

  const parsed = parseShopeeWebchat(shopId, push.data);
  if (!parsed) return;
  await saveShopeeMessage(env, shopId, parsed);
}

async function saveShopeeMessage(env: Bindings, shopId: number, msg: ParsedShopeeMessage): Promise<void> {
  const platformMessageId = shopeePlatformMessageId(shopId, msg.messageId);
  // EARLY DEDUPE (same contract as LINE/Facebook): a redelivery must not touch the conversation.
  if (await isDuplicateMessage(env, platformMessageId, 'shopee')) return;

  const customer = await findOrCreateCustomer(env, shopeePlatformUserId(shopId, msg.buyerId), 'shopee', {
    displayName: msg.buyerName,
  });
  if (!customer) throw new Error('Shopee push: failed to find or create customer');

  const preview = { messageContent: msg.content.substring(0, 100), customerDisplayName: customer.displayName || 'Shopee 買家' };
  const conversation = await findOrCreateConversation(env, customer.id, 'shopee', preview);
  if (!conversation) throw new Error('Shopee push: failed to find or create conversation');

  const saved: { duplicate?: boolean } = {};
  const messageId = await saveMessage(
    env, conversation.id, customer.id, msg.content, msg.messageType, platformMessageId,
    customer.displayName || null, msg.metadata, 'shopee', saved
  );
  // Lost the insert race to a concurrent redelivery: that request notifies and broadcasts.
  if (saved.duplicate) return;

  await notifyNewConversation(env, conversation, messageId, 'shopee', preview);
  try {
    await new WebSocketBroadcastService(env).broadcastNewMessage({
      conversationId: conversation.id,
      message: {
        id: messageId,
        content: msg.content,
        messageType: msg.messageType,
        senderType: 'customer',
        senderId: String(customer.id),
        platform: 'shopee',
        timestamp: nowMs(),
        deliveryStatus: 'delivered',
      },
      source: 'webhook',
      teamId: conversation.assignedTeamId ?? undefined,
    });
  } catch (err) {
    // The message is stored; a retry would only hit the dedup above, so do not throw.
    log.warn('Shopee push: broadcast failed', { error: err instanceof Error ? err.message : String(err) });
  }
  log.info('Shopee message stored', { shopId, conversationId: conversation.id, contentLength: msg.content.length });
}
