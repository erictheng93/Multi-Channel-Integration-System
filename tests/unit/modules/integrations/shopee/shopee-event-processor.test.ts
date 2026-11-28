// Shopee push consumer: webchat save/dedup, auth status pushes, no auto-reply (spec §3, §5).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { conv, findOrCreateCustomer, repo, broadcastNewMessage, autoReply } = vi.hoisted(() => ({
  conv: {
    isDuplicateMessage: vi.fn(),
    findOrCreateConversation: vi.fn(),
    saveMessage: vi.fn(),
    notifyNewConversation: vi.fn(),
  },
  findOrCreateCustomer: vi.fn(),
  repo: { findShopeeChannelByShopId: vi.fn(), updateShopeeChannelConfig: vi.fn() },
  broadcastNewMessage: vi.fn().mockResolvedValue(undefined),
  autoReply: { evaluate: vi.fn(), evaluateWelcome: vi.fn(), retryAutoReplyForPlatformMessage: vi.fn() },
}));

vi.mock('@/modules/integrations/services/webhook-conversation-service', () => conv);
vi.mock('@/modules/integrations/services/webhook-customer-service', () => ({ findOrCreateCustomer }));
vi.mock('@/modules/integrations/services/shopee/shopee-channel-repository', () => repo);
vi.mock('@/services/websocket-broadcast-service', () => ({
  WebSocketBroadcastService: vi.fn().mockImplementation(function () { return { broadcastNewMessage }; }),
}));
vi.mock('@/db/drizzle-factory', () => ({ createDbClient: vi.fn().mockReturnValue({}) }));
vi.mock('@modules/auto-reply/services/auto-reply-engine', () => autoReply);

import { processShopeePush } from '@/modules/integrations/handlers/shopee-event-processor';

const SHOP = 228029969;
const channel = (over: Record<string, unknown> = {}) => ({
  id: 7, teamId: 1, isActive: true, credentials: null,
  config: { shopId: SHOP, env: 'sandbox', authStatus: 'active' }, ...over,
});
const webchat = (shopId: number, content: Record<string, unknown>) => JSON.stringify({
  shop_id: shopId, code: 10, timestamp: 1790000000,
  data: { type: 'message', content: { message_id: 'm-1', from_id: 555, from_user_name: 'buyer_a', ...content } },
});
const textPush = (shopId = SHOP) => webchat(shopId, { message_type: 'text', content: { text: 'hi' } });

describe('processShopeePush', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.findShopeeChannelByShopId.mockResolvedValue(channel());
    conv.isDuplicateMessage.mockResolvedValue(false);
    findOrCreateCustomer.mockImplementation(async (_env, puid: string) => ({ id: puid.length, displayName: 'buyer_a' }));
    conv.findOrCreateConversation.mockResolvedValue({ id: 'c-1', assignedTeamId: null, lastMessageAt: null });
    conv.saveMessage.mockResolvedValue('msg-uuid');
  });

  it('stores a buyer text message with namespaced ids and broadcasts once', async () => {
    await processShopeePush({} as never, textPush());
    expect(findOrCreateCustomer).toHaveBeenCalledWith(expect.anything(), `${SHOP}:555`, 'shopee', { displayName: 'buyer_a' });
    const args = conv.saveMessage.mock.calls[0];
    expect(args[3]).toBe('hi');
    expect(args[5]).toBe(`shopee:${SHOP}:m-1`);
    expect(args[8]).toBe('shopee');
    expect(conv.notifyNewConversation).toHaveBeenCalledTimes(1);
    expect(broadcastNewMessage).toHaveBeenCalledTimes(1);
  });

  it('writes nothing and does not broadcast for a redelivered message', async () => {
    conv.isDuplicateMessage.mockResolvedValue(true);
    await processShopeePush({} as never, textPush());
    expect(conv.isDuplicateMessage).toHaveBeenCalledWith(expect.anything(), `shopee:${SHOP}:m-1`, 'shopee');
    expect(findOrCreateCustomer).not.toHaveBeenCalled();
    expect(conv.saveMessage).not.toHaveBeenCalled();
    expect(broadcastNewMessage).not.toHaveBeenCalled();
  });

  it('treats a lost insert race as success without a second broadcast', async () => {
    conv.saveMessage.mockImplementation(async (...a: unknown[]) => {
      (a[9] as { duplicate?: boolean }).duplicate = true;
      return 'existing';
    });
    await expect(processShopeePush({} as never, textPush())).resolves.toBeUndefined();
    expect(broadcastNewMessage).not.toHaveBeenCalled();
    expect(conv.notifyNewConversation).not.toHaveBeenCalled();
  });

  it('acks an unknown shop without writing', async () => {
    repo.findShopeeChannelByShopId.mockResolvedValue(null);
    await expect(processShopeePush({} as never, textPush())).resolves.toBeUndefined();
    expect(conv.saveMessage).not.toHaveBeenCalled();
  });

  it('acks an inactive channel without writing', async () => {
    repo.findShopeeChannelByShopId.mockResolvedValue(channel({ isActive: false }));
    await processShopeePush({} as never, textPush());
    expect(conv.saveMessage).not.toHaveBeenCalled();
  });

  it('gives the same buyer a separate customer per shop', async () => {
    await processShopeePush({} as never, textPush(SHOP));
    await processShopeePush({} as never, textPush(999));
    const ids = findOrCreateCustomer.mock.calls.map((c) => c[1]);
    expect(ids).toEqual([`${SHOP}:555`, '999:555']);
  });

  it('stores an unknown content type as a summary', async () => {
    await processShopeePush({} as never, webchat(SHOP, { message_type: 'bundle_message', content: {} }));
    expect(conv.saveMessage.mock.calls[0][3]).toBe('[未支援的訊息類型]');
  });

  it('summarises a product card and keeps an image URL in metadata', async () => {
    await processShopeePush({} as never, webchat(SHOP, { message_type: 'item', content: { item_id: 42, item_name: '砂輪' } }));
    expect(conv.saveMessage.mock.calls[0][3]).toBe('[商品] 砂輪');
    await processShopeePush({} as never, webchat(SHOP, { message_type: 'image', content: { url: 'https://cf.shopee/img' } }));
    expect(conv.saveMessage.mock.calls[1][3]).toBe('[圖片]');
    expect(conv.saveMessage.mock.calls[1][7]).toMatchObject({ url: 'https://cf.shopee/img' });
  });

  it('ignores seller-side messages', async () => {
    await processShopeePush({} as never, webchat(SHOP, { from_shop_id: SHOP, message_type: 'text', content: { text: 'x' } }));
    expect(conv.saveMessage).not.toHaveBeenCalled();
  });

  it('throws (retry → DLQ) when a webchat message has no ids', async () => {
    const body = JSON.stringify({ shop_id: SHOP, code: 10, data: { type: 'message', content: { message_id: 'm' } } });
    await expect(processShopeePush({} as never, body)).rejects.toThrow();
  });

  it('code 2 marks the channel revoked', async () => {
    await processShopeePush({} as never, JSON.stringify({ shop_id: SHOP, code: 2, data: {} }));
    expect(repo.updateShopeeChannelConfig).toHaveBeenCalledWith(expect.anything(), expect.anything(), { authStatus: 'revoked', authStatusReason: 'push:2' });
  });

  it('code 12 marks the channel expiring, but keeps revoked', async () => {
    await processShopeePush({} as never, JSON.stringify({ shop_id: SHOP, code: 12, data: {} }));
    expect(repo.updateShopeeChannelConfig).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ authStatus: 'expiring' }));
    repo.updateShopeeChannelConfig.mockClear();
    repo.findShopeeChannelByShopId.mockResolvedValue(channel({ config: { shopId: SHOP, env: 'sandbox', authStatus: 'revoked' } }));
    await processShopeePush({} as never, JSON.stringify({ shop_id: SHOP, code: 12, data: {} }));
    expect(repo.updateShopeeChannelConfig).not.toHaveBeenCalled();
  });

  it('ignores code 1 and unknown codes', async () => {
    await processShopeePush({} as never, JSON.stringify({ shop_id: SHOP, code: 1, data: {} }));
    await processShopeePush({} as never, JSON.stringify({ shop_id: SHOP, code: 3, data: {} }));
    expect(repo.findShopeeChannelByShopId).not.toHaveBeenCalled();
  });

  // Real bodies captured from the Sandbox Console on 2026-11-27 (Verify and Save, then webchat_push Test Data).
  it('acks the Console verification body and the webchat notification sample without writing', async () => {
    await processShopeePush({} as never, '{"code":0,"data":{"verify_info":"This is a Verification message.Please respond in the certain format."}}');
    await processShopeePush({} as never, JSON.stringify({
      msg_id: 'jARSWzxxuJBQencLPyqiulqFsHHsUKEQ',
      data: { type: 'notification', region: 'ID', content: { user_id: 399936739, conversation_id: '1717715215029989064', type: 'mark_as_replied', content: { conversation_id: '1717715215029989064', conversation_filter_type: 'unreplied' }, timestamp: 1736351999, msg_id: 0, business_type: 0, from_id: 0 } },
      shop_id: SHOP, code: 10, timestamp: 1736351999,
    }));
    expect(conv.saveMessage).not.toHaveBeenCalled();
    expect(broadcastNewMessage).not.toHaveBeenCalled();
  });

  it('never invokes auto-reply (Shopee forbids chatbot replies)', async () => {
    await processShopeePush({} as never, textPush());
    for (const fn of Object.values(autoReply)) expect(fn).not.toHaveBeenCalled();
    const src = readFileSync(resolve(__dirname, '../../../../../src/modules/integrations/handlers/shopee-event-processor.ts'), 'utf8');
    expect(src).not.toMatch(/from ['"][^'"]*auto-reply/);
    expect(src).not.toMatch(/import\([^)]*auto-reply/);
  });
});
