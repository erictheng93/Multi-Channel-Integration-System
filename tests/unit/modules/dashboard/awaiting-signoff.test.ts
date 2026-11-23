import { readdirSync } from 'node:fs';
import type Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { healAwaitingSince } from '@/modules/dashboard/services/awaiting-service';
import {
  SIGN_OFF_PHRASES,
  awaitingExpression,
  signOffSql,
  startsWaitSql
} from '@/modules/dashboard/services/awaiting-rules';
import { isSignOffMessage } from '@shared/api-contracts';
import {
  MIGRATION_ACKS,
  MIGRATION_PRE_CLOSE,
  MIGRATION_HYGIENE,
  addConv,
  addCustomer,
  addMsg,
  awaitingOf,
  createDashboardDb,
  d1Of,
  readMigration
} from '../../../helpers/sqlite-d1';

const NOW = Date.parse('2026-10-29T10:00:00.000Z');
const T = (h: number, m = 0) => `2026-10-29T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`;
const AGENTS_DDL = 'CREATE TABLE IF NOT EXISTS agents (id TEXT PRIMARY KEY, email TEXT, password_hash TEXT, display_name TEXT, role TEXT, is_active INTEGER, created_at TEXT, updated_at TEXT)';

function freshDb(): Database.Database {
  const db = createDashboardDb({ awaiting: true, hygiene: true });
  addCustomer(db, 1);
  return db;
}

/** Customer asks, an agent answers, then the customer sends `content`. Returns the marker afterwards. */
function markerAfterReplyThen(content: string, type = 'text'): string | null {
  const db = freshDb();
  addConv(db, 'c');
  addMsg(db, 'c', 'customer', T(1), { content: '請問營業時間' });
  addMsg(db, 'c', 'agent', T(2), { content: '早上九點' });
  expect(awaitingOf(db, 'c')).toBeNull();
  addMsg(db, 'c', 'customer', T(3), { content, type });
  return awaitingOf(db, 'c');
}

describe('sign-offs after a human reply do not start a wait', () => {
  it.each(SIGN_OFF_PHRASES.map(p => [p]))('"%s" is a sign-off', phrase => {
    expect(markerAfterReplyThen(phrase)).toBeNull();
  });

  it.each(['謝謝！', '謝謝～', '感謝您。', 'Thanks!', ' THX ', 'Thank You!!', '謝謝你~~', '3Q.'])(
    '"%s" is a sign-off (case, spaces, trailing punctuation)',
    text => {
      expect(markerAfterReplyThen(text)).toBeNull();
    }
  );

  it('a sticker is a sign-off', () => {
    expect(markerAfterReplyThen('', 'sticker')).toBeNull();
  });

  it.each(['收到', '收到！', '了解', '知道了～', '明白。', '收到，謝謝', '收到謝謝您', '好的，謝謝', '好謝謝', 'OK thanks', 'ok, 謝謝!', '了解感謝'])(
    '"%s" is a sign-off (got it, or got it / ok + thanks; migration 0076)',
    text => {
      expect(markerAfterReplyThen(text)).toBeNull();
    }
  );

  it.each(['好', '好的', 'OK', 'ok', '收到，請問何時出貨', '收到\n那運費呢', '謝謝，請問還有庫存嗎', '謝謝 那運費呢', 'thanks but it is broken', '！！'])(
    '"%s" still starts a wait',
    text => {
      expect(markerAfterReplyThen(text)).toBe(T(3));
    }
  );

  it('an image after a reply still starts a wait', () => {
    expect(markerAfterReplyThen('', 'image')).toBe(T(3));
  });
});

describe('first contact always counts', () => {
  it('a sticker as the first message starts a wait', () => {
    const db = freshDb();
    addConv(db, 'c');
    addMsg(db, 'c', 'customer', T(1), { type: 'sticker', content: '' });
    expect(awaitingOf(db, 'c')).toBe(T(1));
  });

  it('thanks as the first message starts a wait', () => {
    const db = freshDb();
    addConv(db, 'c');
    addMsg(db, 'c', 'customer', T(1), { content: '謝謝' });
    expect(awaitingOf(db, 'c')).toBe(T(1));
  });

  it('auto-reply, broadcast and failed sends are not human replies, so thanks still counts', () => {
    const db = freshDb();
    addConv(db, 'c');
    addMsg(db, 'c', 'system', T(1));
    addMsg(db, 'c', 'agent', T(2), { metadata: '{"broadcastId":"b"}' });
    addMsg(db, 'c', 'agent', T(3), { sent: 0 });
    addMsg(db, 'c', 'customer', T(4), { content: '謝謝' });
    expect(awaitingOf(db, 'c')).toBe(T(4));
  });
});

describe('mixed sequences', () => {
  it('sign-off then a real question: the wait starts at the question', () => {
    const db = freshDb();
    addConv(db, 'c');
    addMsg(db, 'c', 'customer', T(1), { content: '問題' });
    addMsg(db, 'c', 'agent', T(2));
    addMsg(db, 'c', 'customer', T(3), { content: '謝謝' });
    addMsg(db, 'c', 'customer', T(4), { content: '對了還想問保固' });
    expect(awaitingOf(db, 'c')).toBe(T(4));
  });

  it('a real question then a sign-off keeps the wait at the question', () => {
    const db = freshDb();
    addConv(db, 'c');
    addMsg(db, 'c', 'customer', T(1), { content: '問題' });
    addMsg(db, 'c', 'agent', T(2));
    addMsg(db, 'c', 'customer', T(3), { content: '還有一題' });
    addMsg(db, 'c', 'customer', T(4), { content: '謝謝' });
    expect(awaitingOf(db, 'c')).toBe(T(3));
  });

  it('a reply after a question and a sign-off clears the wait', () => {
    const db = freshDb();
    addConv(db, 'c');
    addMsg(db, 'c', 'customer', T(1), { content: '問題' });
    addMsg(db, 'c', 'agent', T(2));
    addMsg(db, 'c', 'customer', T(3), { content: '再問一題' });
    addMsg(db, 'c', 'customer', T(4), { content: '謝謝' });
    addMsg(db, 'c', 'agent', T(5));
    expect(awaitingOf(db, 'c')).toBeNull();
  });

  it('a held reply delivered after a sign-off skips the sign-off', () => {
    const db = freshDb();
    addConv(db, 'c');
    addMsg(db, 'c', 'customer', T(1), { content: '問題' });
    addMsg(db, 'c', 'agent', T(2));
    addMsg(db, 'c', 'customer', T(3), { content: '再問一題' });
    const held = addMsg(db, 'c', 'agent', T(4), { sent: 0 });
    addMsg(db, 'c', 'customer', T(5), { content: '謝謝' });
    expect(awaitingOf(db, 'c')).toBe(T(3));
    db.prepare('UPDATE messages SET is_sent = 1 WHERE id = ?').run(held);
    expect(awaitingOf(db, 'c')).toBeNull();
  });

  it('recalling the only human reply makes the first message count again', () => {
    const db = freshDb();
    addConv(db, 'c');
    addMsg(db, 'c', 'customer', T(1), { content: '問題' });
    const reply = addMsg(db, 'c', 'agent', T(2));
    addMsg(db, 'c', 'customer', T(3), { content: '謝謝' });
    expect(awaitingOf(db, 'c')).toBeNull();
    db.prepare('UPDATE messages SET is_recalled = 1 WHERE id = ?').run(reply);
    expect(awaitingOf(db, 'c')).toBe(T(1));
  });
});

describe('customer message committed out of timestamp order', () => {
  it('does not start a wait when an accepted reply already answered it', async () => {
    const db = freshDb();
    addConv(db, 'c');
    addMsg(db, 'c', 'agent', T(2));
    addMsg(db, 'c', 'customer', T(1));
    expect(awaitingOf(db, 'c')).toBeNull();
    expect((await healAwaitingSince(d1Of(db), NOW)).corrected).toBe(0);
  });

  it('moves the wait back to the earliest unanswered message', async () => {
    const db = freshDb();
    addConv(db, 'c');
    addMsg(db, 'c', 'agent', T(1));
    addMsg(db, 'c', 'customer', T(3), { content: '問題' });
    addMsg(db, 'c', 'customer', T(2), { content: '先問這個' });
    expect(awaitingOf(db, 'c')).toBe(T(2));
    expect((await healAwaitingSince(d1Of(db), NOW)).corrected).toBe(0);
  });

  it('a late sign-off does not move the wait', () => {
    const db = freshDb();
    addConv(db, 'c');
    addMsg(db, 'c', 'agent', T(1));
    addMsg(db, 'c', 'customer', T(3), { content: '問題' });
    addMsg(db, 'c', 'customer', T(2), { content: '謝謝' });
    expect(awaitingOf(db, 'c')).toBe(T(3));
  });
});

describe('migration 0072', () => {
  it('re-creates the five awaiting triggers under their 0070 names (plus the 0073 edit trigger)', () => {
    const db = freshDb();
    const names = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'trg_messages_awaiting_%' ORDER BY name").all() as Array<{ name: string }>).map(r => r.name);
    expect(names).toEqual([
      'trg_messages_awaiting_customer',
      'trg_messages_awaiting_customer_edited',
      'trg_messages_awaiting_deleted',
      'trg_messages_awaiting_recalled',
      'trg_messages_awaiting_reply_insert',
      'trg_messages_awaiting_reply_sent'
    ]);
  });

  it('is the only 0072 migration', () => {
    expect(readdirSync('migrations').filter(f => f.startsWith('0072_'))).toEqual([MIGRATION_HYGIENE]);
  });

  it('backfill clears markers whose only unanswered messages are sign-offs and keeps real waits', () => {
    // Database as it was after 0070: sign-offs carry markers.
    const db = createDashboardDb({ awaiting: true, markers: true });
    addCustomer(db, 1);
    addConv(db, 'thanks-only');
    addMsg(db, 'thanks-only', 'customer', T(1), { content: '問題' });
    addMsg(db, 'thanks-only', 'agent', T(2));
    addMsg(db, 'thanks-only', 'customer', T(3), { content: '謝謝' });
    addConv(db, 'sticker-only');
    addMsg(db, 'sticker-only', 'customer', T(1), { content: '問題' });
    addMsg(db, 'sticker-only', 'agent', T(2));
    addMsg(db, 'sticker-only', 'customer', T(3), { type: 'sticker', content: '' });
    addConv(db, 'real');
    addMsg(db, 'real', 'customer', T(1), { content: '問題' });
    addMsg(db, 'real', 'agent', T(2));
    addMsg(db, 'real', 'customer', T(3), { content: '謝謝' });
    addMsg(db, 'real', 'customer', T(4), { content: '保固多久' });
    addConv(db, 'first-contact');
    addMsg(db, 'first-contact', 'customer', T(1), { content: '謝謝' });
    addConv(db, 'yes');
    addMsg(db, 'yes', 'customer', T(1), { content: '問題' });
    addMsg(db, 'yes', 'agent', T(2));
    addMsg(db, 'yes', 'customer', T(3), { content: '好的' });
    expect(awaitingOf(db, 'thanks-only')).toBe(T(3));

    db.exec(AGENTS_DDL);
    db.exec(readMigration(MIGRATION_HYGIENE));

    expect(awaitingOf(db, 'thanks-only')).toBeNull();
    expect(awaitingOf(db, 'sticker-only')).toBeNull();
    expect(awaitingOf(db, 'real')).toBe(T(4));
    expect(awaitingOf(db, 'first-contact')).toBe(T(1));
    expect(awaitingOf(db, 'yes')).toBe(T(3));
  });

  it('creates the system actor as an inactive, non-admin agent with an unusable password', () => {
    const db = freshDb();
    expect(db.prepare("SELECT role, is_active, password_hash FROM agents WHERE id = 'system'").get())
      .toEqual({ role: 'agent', is_active: 0, password_hash: 'SYSTEM_NO_LOGIN' });
  });

  it('adds the system agent once and is safe to apply twice', () => {
    const db = freshDb();
    db.exec(readMigration(MIGRATION_HYGIENE));
    expect((db.prepare("SELECT COUNT(*) AS n FROM agents WHERE id = 'system'").get() as { n: number }).n).toBe(1);
  });
});

describe('migration 0073: editing a customer message re-derives the marker', () => {
  it('thanks edited into a question starts the wait; edited back clears it', () => {
    const db = freshDb();
    addConv(db, 'c');
    addMsg(db, 'c', 'customer', T(1), { content: '問題' });
    addMsg(db, 'c', 'agent', T(2));
    const thanks = addMsg(db, 'c', 'customer', T(3), { content: '謝謝' });
    expect(awaitingOf(db, 'c')).toBeNull();
    db.prepare('UPDATE messages SET content = ? WHERE id = ?').run('請問保固多久', thanks);
    expect(awaitingOf(db, 'c')).toBe(T(3));
    db.prepare('UPDATE messages SET content = ? WHERE id = ?').run('謝謝', thanks);
    expect(awaitingOf(db, 'c')).toBeNull();
  });

  it('a type change from sticker re-derives too', () => {
    const db = freshDb();
    addConv(db, 'c');
    addMsg(db, 'c', 'customer', T(1), { content: '問題' });
    addMsg(db, 'c', 'agent', T(2));
    const sticker = addMsg(db, 'c', 'customer', T(3), { type: 'sticker', content: '' });
    expect(awaitingOf(db, 'c')).toBeNull();
    db.prepare("UPDATE messages SET message_type = 'image' WHERE id = ?").run(sticker);
    expect(awaitingOf(db, 'c')).toBe(T(3));
  });
});

describe('healAwaitingSince uses the same rule', () => {
  it('converges to the trigger result on a mixed dataset and clears sign-off-only markers', async () => {
    const db = freshDb();
    addConv(db, 'a');
    addMsg(db, 'a', 'customer', T(1), { content: '問題' });
    addMsg(db, 'a', 'agent', T(2));
    addMsg(db, 'a', 'customer', T(3), { content: '謝謝' });
    addConv(db, 'b');
    addMsg(db, 'b', 'customer', T(1), { content: '問題' });
    addMsg(db, 'b', 'agent', T(2));
    addMsg(db, 'b', 'customer', T(3), { content: '謝謝' });
    addMsg(db, 'b', 'customer', T(4), { content: '請問退貨' });
    addConv(db, 'c');
    addMsg(db, 'c', 'customer', T(5), { type: 'sticker', content: '' });
    const before = ['a', 'b', 'c'].map(id => awaitingOf(db, id));
    expect(before).toEqual([null, T(4), T(5)]);

    // simulate a pre-0072 marker
    db.prepare("UPDATE conversations SET awaiting_since = ? WHERE id = 'a'").run(T(3));
    const result = await healAwaitingSince(d1Of(db), NOW);
    expect(result.corrected).toBe(1);
    expect(['a', 'b', 'c'].map(id => awaitingOf(db, id))).toEqual(before);
    expect((await healAwaitingSince(d1Of(db), NOW)).corrected).toBe(0);
  });
});

describe('migration 0076: acknowledgements are sign-offs; it carries the current rule', () => {
  const AWAITING_TRIGGERS = [
    'trg_messages_awaiting_customer',
    'trg_messages_awaiting_customer_edited',
    'trg_messages_awaiting_deleted',
    'trg_messages_awaiting_recalled',
    'trg_messages_awaiting_reply_insert',
    'trg_messages_awaiting_reply_sent'
  ];
  const sql = (): string => readMigration(MIGRATION_ACKS).replace(/\r\n/g, '\n');

  it('is the only 0076 migration and re-creates all six awaiting triggers', () => {
    expect(readdirSync('migrations').filter(f => f.startsWith('0076_'))).toEqual([MIGRATION_ACKS]);
    for (const name of AWAITING_TRIGGERS) {
      expect(sql()).toContain(`DROP TRIGGER IF EXISTS ${name};`);
      expect(sql()).toContain(`CREATE TRIGGER IF NOT EXISTS ${name}\n`);
    }
  });

  it('embeds the 0076 sign-off rule in all six triggers and the backfill', () => {
    expect(sql()).toContain(startsWaitSql('cm'));
    expect(sql().split(signOffSql('cm')).length - 1).toBe(AWAITING_TRIGGERS.length + 1); // six triggers + backfill
  });

  it('backfill clears acknowledgement-only markers and keeps real waits', () => {
    const db = freshDb();
    for (const [id, content] of [['ack', '收到'], ['ack-thanks', '好的，謝謝'], ['yes', '好的']] as const) {
      addConv(db, id);
      addMsg(db, id, 'customer', T(1), { content: '問題' });
      addMsg(db, id, 'agent', T(2));
      addMsg(db, id, 'customer', T(3), { content });
    }
    addMsg(db, 'ack', 'customer', T(4), { content: '想採購 15 罐' });
    // Markers as the 0075 rule left them: every acknowledgement started a wait
    db.prepare("UPDATE conversations SET awaiting_since = ? WHERE id IN ('ack', 'ack-thanks', 'yes')").run(T(3));

    db.exec(readMigration(MIGRATION_ACKS));

    expect(awaitingOf(db, 'ack')).toBe(T(4)); // the 收到 no longer anchors the later request
    expect(awaitingOf(db, 'ack-thanks')).toBeNull();
    expect(awaitingOf(db, 'yes')).toBe(T(3));
  });
});

describe('migration 0077: messages before the last close never count toward a wait', () => {
  const sql = (): string => readMigration(MIGRATION_PRE_CLOSE).replace(/\r\n/g, '\n');
  const AWAITING_TRIGGERS = [
    'trg_messages_awaiting_customer',
    'trg_messages_awaiting_customer_edited',
    'trg_messages_awaiting_deleted',
    'trg_messages_awaiting_recalled',
    'trg_messages_awaiting_reply_insert',
    'trg_messages_awaiting_reply_sent'
  ];

  it('is the only 0077 migration and re-creates all six awaiting triggers', () => {
    expect(readdirSync('migrations').filter(f => f.startsWith('0077_'))).toEqual([MIGRATION_PRE_CLOSE]);
    for (const name of AWAITING_TRIGGERS) {
      expect(sql()).toContain(`DROP TRIGGER IF EXISTS ${name};`);
      expect(sql()).toContain(`CREATE TRIGGER IF NOT EXISTS ${name}\n`);
    }
  });

  // The NEWEST migration that defines the triggers must embed the current rule. Older migrations keep the
  // rule of their day, so changing awaiting-rules.ts needs a new migration (this test fails until it exists).
  it('embeds exactly the shared SQL fragments (no drift from awaiting-rules.ts)', () => {
    expect(sql()).toContain(startsWaitSql('cm'));
    expect(sql()).toContain(signOffSql('cm'));
    expect(sql().split(awaitingExpression('NEW.conversation_id')).length - 1).toBe(AWAITING_TRIGGERS.length);
    expect(sql()).toContain(awaitingExpression('conversations.id'));
  });

  it('a conversation closed while waiting reopens with a wait from the reopening message', () => {
    const db = freshDb();
    addConv(db, 'c');
    addMsg(db, 'c', 'customer', T(1), { content: '還沒人回的問題' });
    expect(awaitingOf(db, 'c')).toBe(T(1));
    // setConversationsClosed: floor at the close, marker cleared
    db.prepare("UPDATE conversations SET status = 'closed', unread_floor_at = ?, awaiting_since = NULL WHERE id = 'c'").run(T(2));
    addMsg(db, 'c', 'customer', T(3), { content: '請問還有貨嗎' });
    expect(awaitingOf(db, 'c')).toBe(T(3));
  });

  it('backfill clears a marker that only pre-close messages hold, and the heal agrees', async () => {
    const db = freshDb();
    addConv(db, 'pre');
    addMsg(db, 'pre', 'customer', T(1), { content: '問題' });
    addConv(db, 'post');
    addMsg(db, 'post', 'customer', T(1), { content: '問題' });
    addMsg(db, 'post', 'customer', T(4), { content: '新問題' });
    // Rows as left before 0077: closed (floor T2) and reopened, marker still at T1
    db.prepare("UPDATE conversations SET unread_floor_at = ?, awaiting_since = ? WHERE id IN ('pre', 'post')").run(T(2), T(1));

    db.exec(readMigration(MIGRATION_PRE_CLOSE));

    expect(awaitingOf(db, 'pre')).toBeNull();
    expect(awaitingOf(db, 'post')).toBe(T(4));
    expect((await healAwaitingSince(d1Of(db), NOW)).corrected).toBe(0);
  });
});

describe('isSignOffMessage matches signOffSql (realtime list vs backend marker)', () => {
  it.each([
    ['sticker', ''], ['text', '謝謝'], ['text', '  謝謝！！ '], ['text', 'Thank You.'], ['text', 'THX~'], ['text', '3Q'],
    ['text', '謝謝\n'], ['text', '\n謝謝'], ['text', '謝謝\u3000'], ['text', '謝謝 !'], ['text', '謝謝! !'], ['text', '謝謝你喔'],
    ['text', '好的'], ['text', 'OK'], ['text', ''], ['image', '謝謝'],
    ['text', '收到'], ['text', '收到，謝謝'], ['text', 'Ok Thanks!'], ['text', '收到\n謝謝'], ['text', '收到、了解'], ['text', '好']
  ])('%s %j', (type, content) => {
    const db = freshDb();
    const row = db.prepare(`SELECT ${signOffSql('m')} AS s FROM (SELECT ? AS message_type, ? AS content) m`).get(type, content) as { s: number };
    expect(isSignOffMessage(type, content)).toBe(row.s === 1);
  });
});

describe('migration 0075: a reply older than the marker still re-derives it (#223)', () => {
  it('a held reply delivered after a first-contact thanks turns the thanks into a sign-off', () => {
    const db = freshDb();
    addConv(db, 'c');
    const held = addMsg(db, 'c', 'agent', T(1), { sent: 0 });
    addMsg(db, 'c', 'customer', T(2), { content: '謝謝' });
    expect(awaitingOf(db, 'c')).toBe(T(2));
    db.prepare('UPDATE messages SET is_sent = 1 WHERE id = ?').run(held);
    expect(awaitingOf(db, 'c')).toBeNull();
  });

  it('a reply committed after a later first-contact sticker clears it on insert', () => {
    const db = freshDb();
    addConv(db, 'c');
    addMsg(db, 'c', 'customer', T(2), { type: 'sticker', content: '' });
    expect(awaitingOf(db, 'c')).toBe(T(2));
    addMsg(db, 'c', 'agent', T(1));
    expect(awaitingOf(db, 'c')).toBeNull();
  });

  it('an older reply leaves a real question waiting', () => {
    const db = freshDb();
    addConv(db, 'c');
    addMsg(db, 'c', 'customer', T(2), { content: '請問保固多久' });
    addMsg(db, 'c', 'agent', T(1));
    expect(awaitingOf(db, 'c')).toBe(T(2));
  });
});
