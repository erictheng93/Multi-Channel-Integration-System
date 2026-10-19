import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '@/types';
import { BroadcastServiceError } from '@/modules/broadcast/types';

const mocks = vi.hoisted(() => ({
  preview: vi.fn(),
  create: vi.fn(),
  exists: vi.fn(),
  listRecipients: vi.fn(),
  getById: vi.fn(),
}));

vi.mock('@/middleware/auth', () => ({
  jwtAuth: vi.fn((c, next) => {
    c.set('user', {
      id: 'agent-1',
      role: 'agent',
      teamRoles: { 1: 'lead' },
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
      exists: mocks.exists,
      listRecipients: mocks.listRecipients,
      getById: mocks.getById,
    };
  }),
}));

vi.mock('@modules/broadcast/services/broadcast-sender-service', () => ({
  BroadcastSenderService: vi.fn(),
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

  it('uses exists without loading or signing attachments on each page', async () => {
    mocks.exists.mockResolvedValue(true);
    mocks.listRecipients.mockResolvedValue({ items: [], page: 2, total: 0 });
    const response = await broadcastRouter.request('/b-1/recipients?page=2&status=sent', {}, { DB: {} } as Bindings);
    expect(response.status).toBe(200);
    expect(mocks.exists).toHaveBeenCalledWith('b-1');
    expect(mocks.listRecipients).toHaveBeenCalledWith('b-1', 2, 20, 'sent');
    expect(mocks.getById).not.toHaveBeenCalled();
  });

  it('returns 404 without listing recipients for missing or deleted broadcasts', async () => {
    mocks.exists.mockResolvedValue(false);
    const response = await broadcastRouter.request('/missing/recipients', {}, { DB: {} } as Bindings);
    expect(response.status).toBe(404);
    expect(mocks.listRecipients).not.toHaveBeenCalled();
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
