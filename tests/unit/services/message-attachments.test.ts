import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { createDbClient } from '@/db/drizzle-factory';
import { insertMessageWithAttachments } from '@/services/message-attachments';

const databases: Database.Database[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));

function setup(beforeBatch?: (db: Database.Database) => void) {
  const sqlite = new Database(':memory:');
  databases.push(sqlite);
  sqlite.exec(`
    CREATE TABLE messages (id TEXT PRIMARY KEY, conversation_id TEXT, sender_type TEXT,
      agent_sender_id TEXT, content TEXT, is_sent INTEGER, customer_sender_id INTEGER,
      message_type TEXT, platform_message_id TEXT, is_recalled INTEGER, recall_deadline TEXT,
      recalled_at TEXT, sent_at TEXT, delivery_status TEXT, reply_to_message_id TEXT,
      thread_id TEXT, session_id TEXT, session_sequence INTEGER, metadata TEXT, sender_name TEXT,
      read_by TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT);
    CREATE TABLE file_attachments (id TEXT PRIMARY KEY, message_id TEXT, conversation_id TEXT,
      filename TEXT, mime_type TEXT, file_size INTEGER, file_url TEXT, r2_key TEXT,
      upload_status TEXT, uploaded_by TEXT, created_at TEXT, updated_at TEXT);
    INSERT INTO file_attachments (id, uploaded_by, conversation_id, message_id)
      VALUES ('free', 'agent-1', NULL, NULL), ('scoped', 'agent-1', 'conv-1', NULL),
        ('foreign', 'agent-2', NULL, NULL), ('linked', 'agent-1', 'conv-1', 'old-message'),
        ('other-conversation', 'agent-1', 'conv-2', NULL);
  `);
  function prepare(query: string) {
    const statement = {
      params: [] as unknown[],
      bind(...params: unknown[]) { this.params = params; return this; },
      async raw() { return sqlite.prepare(query).raw().all(...this.params); },
      async all() { return { results: sqlite.prepare(query).all(...this.params) }; },
      async run() { return { meta: { changes: sqlite.prepare(query).run(...this.params).changes } }; },
    };
    return statement;
  }
  const d1 = {
    prepare,
    async batch(statements: ReturnType<typeof prepare>[]) {
      beforeBatch?.(sqlite);
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
  } as unknown as D1Database;
  return { sqlite, d1, db: createDbClient(d1) };
}

const message = {
  id: 'new-message', conversationId: 'conv-1', senderType: 'agent',
  agentSenderId: 'agent-1', content: 'hello', isSent: false,
};

describe('message attachment ownership and atomic claims', () => {
  it('rejects more than ten uploads without creating a message', async () => {
    const { sqlite, d1, db } = setup();
    const ids = ['free', 'scoped'];
    for (let index = 0; index < 9; index++) {
      const id = `extra-${index}`;
      ids.push(id);
      sqlite.prepare('INSERT INTO file_attachments (id, uploaded_by) VALUES (?, ?)').run(id, 'agent-1');
    }
    await expect(insertMessageWithAttachments(d1, db, message, ids, 'agent-1')).rejects.toThrow('Invalid attachments');
    expect(sqlite.prepare('SELECT id FROM messages').all()).toEqual([]);
  });

  it.each([['foreign'], ['linked'], ['other-conversation'], ['missing'], ['free', 'foreign'],
    ['free', 'free'], [42], 'free'].map(ids => ({ ids })))('rejects invalid attachment set $ids without any writes', async ({ ids }) => {
    const { sqlite, d1, db } = setup();
    await expect(insertMessageWithAttachments(d1, db, message, ids, 'agent-1')).rejects.toThrow();
    expect(sqlite.prepare('SELECT id FROM messages').all()).toEqual([]);
    expect(sqlite.prepare("SELECT message_id FROM file_attachments WHERE id = 'free'").get())
      .toEqual({ message_id: null });
  });

  it('claims own unlinked uploads in null or target conversation with the new message', async () => {
    const { sqlite, d1, db } = setup();
    await insertMessageWithAttachments(d1, db, message, ['free', 'scoped'], 'agent-1');
    expect(sqlite.prepare('SELECT id, is_sent FROM messages').all())
      .toEqual([{ id: 'new-message', is_sent: 0 }]);
    expect(sqlite.prepare("SELECT id, message_id, conversation_id FROM file_attachments WHERE id IN ('free','scoped') ORDER BY id").all())
      .toEqual([
        { id: 'free', message_id: 'new-message', conversation_id: 'conv-1' },
        { id: 'scoped', message_id: 'new-message', conversation_id: 'conv-1' },
      ]);
  });

  it('creates neither an orphan message nor partial claims when an upload is claimed after validation', async () => {
    const { sqlite, d1, db } = setup(db => {
      db.prepare("UPDATE file_attachments SET message_id = 'winner' WHERE id = 'scoped'").run();
    });
    await expect(insertMessageWithAttachments(d1, db, message, ['free', 'scoped'], 'agent-1'))
      .rejects.toThrow('no longer available');
    expect(sqlite.prepare('SELECT id FROM messages').all()).toEqual([]);
    expect(sqlite.prepare("SELECT id, message_id FROM file_attachments WHERE id IN ('free','scoped') ORDER BY id").all())
      .toEqual([{ id: 'free', message_id: null }, { id: 'scoped', message_id: 'winner' }]);
  });

  it('preserves ordinary messages without attachments', async () => {
    const { sqlite, d1, db } = setup();
    await insertMessageWithAttachments(d1, db, message, [], 'agent-1');
    expect(sqlite.prepare('SELECT id FROM messages').all()).toEqual([{ id: 'new-message' }]);
  });
});
