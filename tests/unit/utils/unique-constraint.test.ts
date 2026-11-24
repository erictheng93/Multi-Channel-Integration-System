// isUniqueConstraintError: D1/SQLite UNIQUE violations, including through Drizzle's error wrapping.
import { describe, it, expect } from 'vitest';
import Sqlite from 'better-sqlite3';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { conversations, customers } from '@/db/schema';
import { createDbClient } from '@/db/drizzle-factory';
import { isUniqueConstraintError } from '@/utils/unique-constraint';
import { d1Of, readMigration } from '../../helpers/sqlite-d1';

const D1_MESSAGE = 'D1_ERROR: UNIQUE constraint failed: conversations.customer_id: SQLITE_CONSTRAINT';

describe('isUniqueConstraintError', () => {
  it('matches the D1 message, with and without a target column', () => {
    const error = new Error(D1_MESSAGE);
    expect(isUniqueConstraintError(error)).toBe(true);
    expect(isUniqueConstraintError(error, 'conversations.customer_id')).toBe(true);
  });

  it('does not match a violation on another column when a target is given', () => {
    const pk = new Error('D1_ERROR: UNIQUE constraint failed: conversations.id: SQLITE_CONSTRAINT');
    expect(isUniqueConstraintError(pk)).toBe(true);
    expect(isUniqueConstraintError(pk, 'conversations.customer_id')).toBe(false);
    // No prefix match either: customer_id_x is not customer_id.
    expect(isUniqueConstraintError(new Error('UNIQUE constraint failed: conversations.customer_id_x'), 'conversations.customer_id')).toBe(false);
  });

  it('matches a multi-column violation that names the target', () => {
    const error = new Error('UNIQUE constraint failed: customers.platform, customers.platform_user_id');
    expect(isUniqueConstraintError(error, 'customers.platform_user_id')).toBe(true);
  });

  it('finds the violation in the cause chain (Drizzle wraps driver errors)', () => {
    const wrapped = new Error('Failed query: insert into "conversations" ...', { cause: new Error(D1_MESSAGE) });
    expect(isUniqueConstraintError(wrapped, 'conversations.customer_id')).toBe(true);
  });

  it('is false for other errors and non-errors', () => {
    expect(isUniqueConstraintError(new Error('NOT NULL constraint failed: conversations.customer_id'))).toBe(false);
    expect(isUniqueConstraintError(D1_MESSAGE)).toBe(false);
    expect(isUniqueConstraintError(undefined)).toBe(false);
  });

  it('recognises a real violation of migration 0079 raised through Drizzle over SQLite', async () => {
    const sqlite = new Sqlite(':memory:');
    const config = getTableConfig(conversations);
    sqlite.exec(`CREATE TABLE conversations (${config.columns.map(column =>
      `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}`).join(', ')})`);
    sqlite.exec(readMigration('0079_unique_conversation_per_customer.sql'));
    const db = createDbClient(d1Of(sqlite));

    await db.insert(conversations).values({ id: 'c-1', customerId: 1 });
    const error = await db.insert(conversations).values({ id: 'c-2', customerId: 1 }).then(() => null, (e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    // The top-level message is Drizzle's "Failed query: ...", so a plain message check misses it.
    expect((error as Error).message).not.toContain('UNIQUE constraint failed');
    expect(isUniqueConstraintError(error, 'conversations.customer_id')).toBe(true);
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM conversations').get()).toEqual({ n: 1 });
  });

  it('recognises a real violation of the two-column customers index raised through Drizzle over SQLite', async () => {
    const sqlite = new Sqlite(':memory:');
    const customerConfig = getTableConfig(customers);
    sqlite.exec(`CREATE TABLE customers (${customerConfig.columns.map(column =>
      `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}`).join(', ')})`);
    // As production has it (docs/architecture/SCHEMA.md).
    sqlite.exec('CREATE UNIQUE INDEX customers_platform_platform_user_id_unique ON customers(platform, platform_user_id)');
    const db = createDbClient(d1Of(sqlite));

    await db.insert(customers).values({ platform: 'line', platformUserId: 'U1' });
    const error = await db.insert(customers).values({ platform: 'line', platformUserId: 'U1' }).then(() => null, (e: unknown) => e);

    expect(((error as Error).cause as Error).message).toBe('UNIQUE constraint failed: customers.platform, customers.platform_user_id');
    expect(isUniqueConstraintError(error, 'customers.platform_user_id')).toBe(true);
    expect(isUniqueConstraintError(error, 'customers.platform')).toBe(true);
    expect(isUniqueConstraintError(error, 'customers.id')).toBe(false);
  });
});
