import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { TaskReminderService } from '@/services/task-reminder-service';
import type { Bindings } from '@/types';

const databases: Database.Database[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));

// A D1 adapter over real SQLite that returns results the way D1 does:
// the affected-row count lives in meta.changes, not at the top level.
function setup() {
  const sqlite = new Database(':memory:');
  databases.push(sqlite);
  sqlite.exec(`
    CREATE TABLE task_reminders (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL,
      content TEXT, remind_at TEXT NOT NULL, conversation_id TEXT, repeat_type TEXT DEFAULT 'none',
      repeat_interval INTEGER DEFAULT 0, is_completed INTEGER DEFAULT 0, is_sent INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, completed_at TEXT, sent_at TEXT);
    INSERT INTO task_reminders (id, user_id, title, remind_at)
      VALUES ('r1', 'agent-1', 'Call back', '2026-11-11T01:00:00.000Z');
  `);
  function prepare(query: string) {
    return {
      params: [] as unknown[],
      bind(...params: unknown[]) { this.params = params; return this; },
      async raw() { return sqlite.prepare(query).raw().all(...this.params); },
      async all() { return { results: sqlite.prepare(query).all(...this.params) }; },
      async run() {
        const prepared = sqlite.prepare(query);
        if (prepared.reader) return { results: prepared.all(...this.params), meta: { changes: 0 } };
        return { results: [], meta: { changes: prepared.run(...this.params).changes } };
      },
    };
  }
  const service = new TaskReminderService({ prepare } as unknown as D1Database, {} as Bindings);
  return { sqlite, service };
}

describe('TaskReminderService mutations report whether a row changed', () => {
  it('update returns true when it changed the reminder, false for another user', async () => {
    const { sqlite, service } = setup();
    expect(await service.update('r1', 'agent-1', { title: 'Call back today' })).toBe(true);
    expect(sqlite.prepare("SELECT title FROM task_reminders WHERE id = 'r1'").get()).toEqual({ title: 'Call back today' });
    expect(await service.update('r1', 'agent-2', { title: 'x' })).toBe(false);
  });

  it('markComplete returns true when it completed the reminder, false when missing', async () => {
    const { sqlite, service } = setup();
    expect(await service.markComplete('r1', 'agent-1')).toBe(true);
    expect(sqlite.prepare("SELECT is_completed FROM task_reminders WHERE id = 'r1'").get()).toEqual({ is_completed: 1 });
    expect(await service.markComplete('missing', 'agent-1')).toBe(false);
  });

  it('delete returns true when it removed the reminder, false for another user', async () => {
    const { sqlite, service } = setup();
    expect(await service.delete('r1', 'agent-2')).toBe(false);
    expect(await service.delete('r1', 'agent-1')).toBe(true);
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM task_reminders').get()).toEqual({ n: 0 });
  });
});
