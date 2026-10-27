import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '@/types';
import { BroadcastServiceError } from '@/modules/broadcast/types';

const mocks = vi.hoisted(() => ({
  preview: vi.fn(),
  create: vi.fn(),
  findTitle: vi.fn(),
  send: vi.fn(),
  logActivity: vi.fn(async () => null),
  listRecipients: vi.fn(),
  getById: vi.fn(),
}));

vi.mock('@/middleware/auth', () => ({
  jwtAuth: vi.fn((c, next) => {
    c.set('user', {
      id: 'agent-1',
      displayName: 'Agent One',
      email: 'agent1@example.com',
      role: 'agent',
      teamRoles: {}, // a plain agent: broadcasting no longer needs a lead/supervisor role
    });
    return next();
  }),
}));

vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: vi.fn(() => ({})),
}));

vi.mock('@modules/broadcast/services/broadcast-service', () => ({
  BroadcastService: vi.fn(function () {
    return {
      preview: mocks.preview,
      create: mocks.create,
      findTitle: mocks.findTitle,
      listRecipients: mocks.listRecipients,
      getById: mocks.getById,
    };
  }),
}));

vi.mock('@modules/broadcast/services/broadcast-sender-service', () => ({
  BroadcastSenderService: vi.fn(function () {
    return { send: mocks.send };
  }),
}));

vi.mock('@modules/activities', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@modules/activities')>()),
  ActivityService: vi.fn(function () {
    return { logActivity: mocks.logActivity };
  }),
}));

import broadcastRouter from '@/modules/broadcast/handlers/broadcast-main';

describe('broadcast preview route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.preview.mockResolvedValue({
      total: 12,
      byPlatform: { line: 10, facebook: 2 },
      sendable: 10,
      skipped: [{ reason: 'platform_not_supported_phase1', count: 2 }],
    });
  });

  it('exposes attachment error codes in the response envelope', async () => {
    mocks.create.mockRejectedValueOnce(new BroadcastServiceError(
      'ATTACHMENT_NOT_OWNED', 'image was not uploaded by you', 422
    ));
    const response = await broadcastRouter.request('/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '通知', content: '', tagIds: [1],
        attachments: [{ attachmentId: 'original', previewAttachmentId: 'preview' }] }),
    }, { DB: {} } as Bindings);
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ success: false, code: 'ATTACHMENT_NOT_OWNED' });
  });

  it('accepts tagIds without title or content', async () => {
    const app = new Hono<{ Bindings: Bindings }>();
    app.use('*', async (c, next) => {
      c.env = { DB: {} } as Bindings;
      await next();
    });
    app.route('/api/broadcasts', broadcastRouter);

    const response = await app.request('/api/broadcasts/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagIds: [123] }),
    });

    expect(response.status).toBe(200);
    expect(mocks.preview).toHaveBeenCalledWith(123);
  });

  it('rejects multiple tags during Phase 1', async () => {
    const app = new Hono<{ Bindings: Bindings }>();
    app.use('*', async (c, next) => {
      c.env = { DB: {} } as Bindings;
      await next();
    });
    app.route('/api/broadcasts', broadcastRouter);

    const response = await app.request('/api/broadcasts/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagIds: [123, 456] }),
    });

    expect(response.status).toBe(422);
    expect(mocks.preview).not.toHaveBeenCalled();
  });
});

describe('broadcast recipient existence check', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses findTitle without loading or signing attachments on each page', async () => {
    mocks.findTitle.mockResolvedValue('通知');
    mocks.listRecipients.mockResolvedValue({ items: [], page: 2, total: 0 });
    const response = await broadcastRouter.request('/b-1/recipients?page=2&status=sent', {}, { DB: {} } as Bindings);
    expect(response.status).toBe(200);
    expect(mocks.findTitle).toHaveBeenCalledWith('b-1', 'agent-1');
    expect(mocks.listRecipients).toHaveBeenCalledWith('b-1', 2, 20, 'sent');
    expect(mocks.getById).not.toHaveBeenCalled();
  });

  it('returns 404 without listing recipients for missing or deleted broadcasts', async () => {
    mocks.findTitle.mockResolvedValue(null);
    const response = await broadcastRouter.request('/missing/recipients', {}, { DB: {} } as Bindings);
    expect(response.status).toBe(404);
    expect(mocks.listRecipients).not.toHaveBeenCalled();
  });
});

describe('broadcast ownership scope', () => {
  beforeEach(() => vi.clearAllMocks());

  it("hides another user's broadcast from a lead", async () => {
    mocks.getById.mockResolvedValue({ id: 'b-2', createdBy: 'agent-2' });
    const response = await broadcastRouter.request('/b-2', {}, { DB: {} } as Bindings);
    expect(response.status).toBe(404);
  });

  it("refuses to send another user's draft before the sender runs", async () => {
    const { BroadcastSenderService } = await import('@modules/broadcast/services/broadcast-sender-service');
    mocks.findTitle.mockResolvedValue(null);
    const response = await broadcastRouter.request('/b-2/send', { method: 'POST' }, { DB: {} } as Bindings);
    expect(response.status).toBe(404);
    expect(mocks.findTitle).toHaveBeenCalledWith('b-2', 'agent-1');
    expect(BroadcastSenderService).not.toHaveBeenCalled();
  });
});

describe('broadcast create route', () => {
  function buildApp() {
    const app = new Hono<{ Bindings: Bindings }>();
    app.use('*', async (c, next) => {
      c.env = { DB: {} } as Bindings;
      await next();
    });
    app.route('/api/broadcasts', broadcastRouter);
    return app;
  }

  function post(body: unknown) {
    return buildApp().request('/api/broadcasts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockResolvedValue({ id: 'b-1' });
  });

  it('accepts an image-only broadcast', async () => {
    const attachments = [{ attachmentId: 'img-1', previewAttachmentId: 'prev-1' }];
    const response = await post({ title: 'Promo', content: '', tagIds: [1], attachments });

    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(
      { title: 'Promo', content: '', tagIds: [1], attachments },
      'agent-1'
    );
  });

  it('defaults attachments to an empty list for text broadcasts', async () => {
    await post({ title: 'Promo', content: 'Hi', tagIds: [1] });
    expect(mocks.create).toHaveBeenCalledWith(
      { title: 'Promo', content: 'Hi', tagIds: [1], attachments: [] },
      'agent-1'
    );
  });

  it('rejects a broadcast with neither text nor images', async () => {
    const response = await post({ title: 'Promo', content: '  ', tagIds: [1] });
    expect(response.status).toBe(422);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('rejects malformed attachment entries', async () => {
    const response = await post({ title: 'Promo', content: 'Hi', tagIds: [1], attachments: [{ attachmentId: 'img-1' }] });
    expect(response.status).toBe(422);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('rejects more than four attachments before create is called', async () => {
    const attachments = [1, 2, 3, 4, 5].map((n) => ({ attachmentId: `img-${n}`, previewAttachmentId: `prev-${n}` }));
    const response = await post({ title: 'Promo', content: 'Hi', tagIds: [1], attachments });
    expect(response.status).toBe(422);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe('broadcast activity log', () => {
  beforeEach(() => vi.clearAllMocks());

  it('records who created a broadcast', async () => {
    mocks.create.mockResolvedValue({ id: 'b-1', title: '通知', tagIds: [1], totalRecipients: 3 });
    const response = await broadcastRouter.request('/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '通知', content: 'Hi', tagIds: [1] }),
    }, { DB: {} } as Bindings);
    expect(response.status).toBe(201);
    expect(mocks.logActivity).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'agent-1', userName: 'Agent One', userRole: 'agent',
      action: 'broadcast_create', resourceType: 'broadcast', resourceId: 'b-1',
      details: { title: '通知', tagIds: [1], totalRecipients: 3, imageCount: 0 },
    }));
  });

  it('records who sent a broadcast and the outcome', async () => {
    mocks.findTitle.mockResolvedValue('通知');
    mocks.send.mockResolvedValue({
      broadcastId: 'b-1', status: 'completed', totalRecipients: 3, sentCount: 2, failedCount: 1, skippedCount: 0,
    });
    const response = await broadcastRouter.request('/b-1/send', { method: 'POST' }, { DB: {} } as Bindings);
    expect(response.status).toBe(200);
    expect(mocks.logActivity).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'agent-1', action: 'broadcast_send', resourceId: 'b-1',
      details: { title: '通知', status: 'completed', totalRecipients: 3, sentCount: 2, failedCount: 1, skippedCount: 0 },
    }));
  });

  it('records a send attempt stopped by insufficient quota', async () => {
    mocks.findTitle.mockResolvedValue('通知');
    mocks.send.mockRejectedValue(new BroadcastServiceError('QUOTA_INSUFFICIENT', 'no quota', 409));
    const response = await broadcastRouter.request('/b-1/send', { method: 'POST' }, { DB: {} } as Bindings);
    expect(response.status).toBe(409);
    expect(mocks.logActivity).toHaveBeenCalledWith(expect.objectContaining({
      action: 'broadcast_send', details: { title: '通知', status: 'failed', errorCode: 'QUOTA_INSUFFICIENT' },
    }));
  });

  it('does not log when another error stops the send', async () => {
    mocks.findTitle.mockResolvedValue('通知');
    mocks.send.mockRejectedValue(new BroadcastServiceError('INVALID_BROADCAST_STATUS', 'not draft', 409));
    expect((await broadcastRouter.request('/b-1/send', { method: 'POST' }, { DB: {} } as Bindings)).status).toBe(409);
    expect(mocks.logActivity).not.toHaveBeenCalled();
  });
});
