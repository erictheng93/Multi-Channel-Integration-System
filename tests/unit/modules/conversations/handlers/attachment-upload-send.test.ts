import Database from 'better-sqlite3';
import { Hono } from 'hono';
import { sign, verify } from 'hono/jwt';
import { afterEach, expect, it, vi } from 'vitest';
import type { Bindings } from '@/types';

// Node cannot load the Workers runtime; retain the real DO routes and database code.
vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    constructor(protected ctx: DurableObjectState, protected env: Bindings) {}
  },
}));
vi.mock('@/middleware/auth', () => ({
  jwtAuth: async (c: any, next: () => Promise<void>) => {
    c.set('jwtPayload', await verify(c.req.header('Authorization').slice(7), c.env.JWT_SECRET, 'HS256'));
    await next();
  },
}));

import conversationMessagesHandler from '@/modules/conversations/handlers/conversation-messages';
import { CustomerMessageDO } from '@/durable-objects/CustomerMessageDO';

let sqlite: Database.Database;
afterEach(() => sqlite?.close());

it('lets the authenticated uploader send their upload, while rejecting foreign and legacy ownerless uploads', async () => {
  sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE conversations (id TEXT PRIMARY KEY, assigned_team_id INTEGER,
      customer_id INTEGER, last_message_at TEXT, updated_at TEXT);
    CREATE TABLE customers (id INTEGER PRIMARY KEY, platform TEXT, platform_user_id TEXT);
    CREATE TABLE messages (id TEXT PRIMARY KEY, conversation_id TEXT, sender_type TEXT,
      agent_sender_id TEXT, content TEXT, is_sent INTEGER, customer_sender_id INTEGER,
      message_type TEXT, platform_message_id TEXT, is_recalled INTEGER, recall_deadline TEXT,
      recalled_at TEXT, sent_at TEXT, delivery_status TEXT, reply_to_message_id TEXT,
      thread_id TEXT, session_id TEXT, session_sequence INTEGER, metadata TEXT, sender_name TEXT,
      read_by TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT);
    CREATE TABLE file_attachments (id TEXT PRIMARY KEY, message_id TEXT, conversation_id TEXT,
      filename TEXT, mime_type TEXT, file_size INTEGER, file_url TEXT, r2_key TEXT,
      upload_status TEXT, uploaded_by TEXT, created_at TEXT, updated_at TEXT);
    INSERT INTO customers VALUES (1, 'facebook', 'fb-customer');
    INSERT INTO conversations (id, customer_id) VALUES ('conv-1', 1);
    INSERT INTO file_attachments (id, conversation_id, uploaded_by)
      VALUES ('legacy-ownerless', 'conv-1', NULL);
  `);
  // A D1 adapter backed by real SQLite, including D1's atomic batch semantics.
  function prepare(query: string) {
    return {
      params: [] as unknown[],
      bind(...params: unknown[]) { this.params = params; return this; },
      async raw() { return sqlite.prepare(query).raw().all(...this.params); },
      async all() { return { results: sqlite.prepare(query).all(...this.params) }; },
      async run() { return { meta: { changes: sqlite.prepare(query).run(...this.params).changes } }; },
    };
  }
  const d1 = {
    prepare,
    async batch(statements: ReturnType<typeof prepare>[]) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  const objects = new Map<string, ArrayBuffer>();
  const env = {
    DB: d1,
    JWT_SECRET: 'test-only-upload-secret',
    BACKEND_URL: 'https://backend.example.com',
    R2_BUCKET: { put: async (key: string, data: ArrayBuffer) => { objects.set(key, data); } },
    CACHE: { get: async () => '0' },
    CUSTOMER_CONVERSATION_DO: {
      idFromName: (name: string) => name,
      get: () => ({ fetch: async () => Response.json({ success: true }) }),
    },
  } as unknown as Bindings;
  const app = new Hono<{ Bindings: Bindings }>();
  app.route('/api/conversations', conversationMessagesHandler);
  const token = await sign({ userId: 7, role: 'agent', allowedTeamIds: [], exp: Math.floor(Date.now() / 1000) + 60 }, env.JWT_SECRET, 'HS256');
  const form = new FormData();
  form.append('file', new File(['customer attachment'], 'note.txt', { type: 'text/plain' }));
  const upload = await app.request('/api/conversations/conv-1/attachments', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form,
  }, env);
  expect(upload.status).toBe(200);
  const { data: { attachmentId } } = await upload.json() as { data: { attachmentId: string } };
  const uploaded = sqlite.prepare('SELECT r2_key FROM file_attachments WHERE id = ?').get(attachmentId) as { r2_key: string };
  expect(new TextDecoder().decode(objects.get(uploaded.r2_key))).toBe('customer attachment');

  const durableObject = new CustomerMessageDO({} as DurableObjectState, env);
  const send = (userId: string, id: string) => durableObject.fetch(new Request('https://customer-message-do/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', 'X-Conversation-Id': 'conv-1',
      'X-Session-Id': 'session-7', 'X-Authenticated-User-Id': userId,
    },
    body: JSON.stringify({ content: '', attachmentIds: [id], platform: 'facebook' }),
  }));
  expect((await send('8', attachmentId)).status).toBe(400);
  expect((await send('7', 'legacy-ownerless')).status).toBe(400);
  expect(sqlite.prepare('SELECT id FROM messages').all()).toEqual([]);
  expect(sqlite.prepare('SELECT message_id FROM file_attachments').all())
    .toEqual([{ message_id: null }, { message_id: null }]);

  const response = await send('7', attachmentId);
  expect(response.status).toBe(200);
  const { message } = await response.json() as { message: { id: string } };
  expect(sqlite.prepare('SELECT uploaded_by, message_id, conversation_id FROM file_attachments WHERE id = ?').get(attachmentId))
    .toEqual({ uploaded_by: '7', message_id: message.id, conversation_id: 'conv-1' });
  expect(sqlite.prepare('SELECT id, agent_sender_id FROM messages').all())
    .toEqual([{ id: message.id, agent_sender_id: '7' }]);
  expect(sqlite.prepare("SELECT uploaded_by, message_id FROM file_attachments WHERE id = 'legacy-ownerless'").get())
    .toEqual({ uploaded_by: null, message_id: null });
});
