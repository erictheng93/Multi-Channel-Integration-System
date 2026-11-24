// One customer per (platform, platform_user_id): a create that loses the race to a concurrent creator
// continues with the existing customer instead of failing. Real SQLite with the production unique
// index, real Drizzle (D1 driver), so the UNIQUE error arrives wrapped exactly as in production.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Sqlite from 'better-sqlite3';
import { getTableConfig, type SQLiteTable } from 'drizzle-orm/sqlite-core';
import { conversations, customers, customerTeamAssignments, qrCodes, qrCodeScans } from '@/db/schema';
import { createDbClient } from '@/db/drizzle-factory';
import type { Bindings } from '@/types';
import { d1Of, readMigration } from '../../../../helpers/sqlite-d1';

vi.mock('@/services/distributed-lock-service', () => ({
  DistributedLockService: vi.fn(function () {
    return { withLock: async (_resource: string, fn: () => Promise<unknown>) => fn() };
  }),
}));

// Profile lookup returns nothing: the customer keeps the platform default name.
vi.mock('@/services/user-sync', () => ({
  createUserSyncService: () => ({
    syncLineUser: async () => null,
    syncFacebookUser: async () => null,
  }),
}));

import { findOrCreateCustomer } from '@modules/integrations/services/webhook-customer-service';
import { findOrCreateConversation } from '@modules/integrations/services/webhook-conversation-service';
import { QRCodeServiceImpl } from '@/services/qrcode-service-impl';
import { CustomerCrudService } from '@modules/customer/services/customer-crud';
import { CustomerAlreadyExistsError } from '@modules/customer/types/customer-types';
import { insertOrGetCustomer } from '@/services/customer-insert';
import { isUniqueConstraintError } from '@/utils/unique-constraint';

const NOW = '2026-11-24T00:00:00.000Z';

function createTable(sqlite: Sqlite.Database, table: SQLiteTable): void {
  const config = getTableConfig(table);
  sqlite.exec(`CREATE TABLE "${config.name}" (${config.columns.map(column =>
    `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}`).join(', ')})`);
}

function createDb(): Sqlite.Database {
  const sqlite = new Sqlite(':memory:');
  for (const table of [customers, conversations, customerTeamAssignments, qrCodes, qrCodeScans]) {
    createTable(sqlite, table);
  }
  // The index exactly as production has it (docs/architecture/SCHEMA.md).
  sqlite.exec('CREATE UNIQUE INDEX customers_platform_platform_user_id_unique ON customers(platform, platform_user_id)');
  sqlite.exec('CREATE INDEX idx_conversations_customer ON conversations(customer_id)');
  sqlite.exec(readMigration('0079_unique_conversation_per_customer.sql'));
  return sqlite;
}

const insertCustomerRow = (
  sqlite: Sqlite.Database,
  c: { id: number; platform: string; platformUserId: string; sourceTeamId?: number | null; deletedAt?: string | null }
): void => {
  sqlite.prepare("INSERT INTO customers (id, platform, platform_user_id, display_name, source_team_id, deleted_at, created_at, updated_at) VALUES (?, ?, ?, 'Winner', ?, ?, ?, ?)")
    .run(c.id, c.platform, c.platformUserId, c.sourceTeamId ?? null, c.deletedAt ?? null, NOW, NOW);
};

type Competitor = Parameters<typeof insertCustomerRow>[1];

/**
 * D1 whose first INSERT INTO customers is preceded by a competitor's insert for the same user:
 * every lookup before it saw no customer, then the competitor wins the write.
 */
function racingD1(sqlite: Sqlite.Database, competitor: Competitor): D1Database {
  const base = d1Of(sqlite);
  let raced = false;
  return {
    ...base,
    prepare: (query: string) => {
      if (!raced && /^insert into "customers"/i.test(query)) {
        raced = true;
        insertCustomerRow(sqlite, competitor);
      }
      return base.prepare(query);
    },
  } as D1Database;
}

const customerRows = (sqlite: Sqlite.Database) =>
  sqlite.prepare('SELECT id, platform, platform_user_id AS platformUserId, source_team_id AS sourceTeamId FROM customers ORDER BY id').all();
const conversationRows = (sqlite: Sqlite.Database) =>
  sqlite.prepare('SELECT customer_id AS customerId, assigned_team_id AS teamId FROM conversations ORDER BY id').all();

describe('findOrCreateCustomer (webhook) on a lost create race', () => {
  let sqlite: Sqlite.Database;

  beforeEach(() => {
    sqlite = createDb();
  });

  it('returns the customer the concurrent request created, and the flow continues', async () => {
    const env = { DB: racingD1(sqlite, { id: 7, platform: 'line', platformUserId: 'U1' }) } as unknown as Bindings;

    const customer = await findOrCreateCustomer(env, 'U1', 'line', { sourceTeamId: 3 });
    expect(customer).toMatchObject({ id: 7, platform: 'line', platformUserId: 'U1', displayName: 'Winner' });

    // The handler goes on to the conversation, which now exists exactly once for that customer.
    const conversation = await findOrCreateConversation(env, customer!.id, 'line', { assignedTeamId: 3 });
    expect(conversation).toMatchObject({ customerId: 7, assignedTeamId: 3 });
    expect(customerRows(sqlite)).toEqual([{ id: 7, platform: 'line', platformUserId: 'U1', sourceTeamId: null }]);
    expect(conversationRows(sqlite)).toEqual([{ customerId: 7, teamId: 3 }]);
  });

  it('still creates the customer when there is no race', async () => {
    const env = { DB: d1Of(sqlite) } as unknown as Bindings;

    const customer = await findOrCreateCustomer(env, 'F1', 'facebook', { sourceTeamId: 2 });

    expect(customer).toMatchObject({ platform: 'facebook', platformUserId: 'F1', displayName: 'Facebook User', sourceTeamId: 2 });
    expect(customerRows(sqlite)).toEqual([{ id: customer!.id, platform: 'facebook', platformUserId: 'F1', sourceTeamId: 2 }]);
  });
});

describe('QR-code follow on a lost create race', () => {
  it('continues with the existing customer: backfills its team and creates one conversation', async () => {
    const sqlite = createDb();
    sqlite.prepare("INSERT INTO qr_codes (id, team_id, token, line_url, qr_code_image_url, usage_count, is_active) VALUES ('qr-1', 4, 'tok', 'https://line.me/x', 'data:', 0, 1)").run();
    const db = createDbClient(racingD1(sqlite, { id: 9, platform: 'line', platformUserId: 'U9' }));

    const result = await QRCodeServiceImpl.handleQRCodeFollow(db, {
      type: 'follow',
      source: { type: 'user', userId: 'U9' },
      follow: { param: 'tok' },
    } as unknown as Parameters<typeof QRCodeServiceImpl.handleQRCodeFollow>[1]);

    expect(result).toEqual({ teamId: 4, autoAssigned: true });
    expect(customerRows(sqlite)).toEqual([{ id: 9, platform: 'line', platformUserId: 'U9', sourceTeamId: 4 }]);
    expect(conversationRows(sqlite)).toEqual([{ customerId: 9, teamId: 4 }]);
  });
});

describe('insertOrGetCustomer', () => {
  it('returns the inserted row, then the existing row on a (platform, platform_user_id) violation', async () => {
    const sqlite = createDb();
    const db = createDbClient(d1Of(sqlite));

    const first = await insertOrGetCustomer(db, { platform: 'line', platformUserId: 'U1', displayName: 'First' });
    const second = await insertOrGetCustomer(db, { platform: 'line', platformUserId: 'U1', displayName: 'Second' });

    expect(second).toMatchObject({ id: first.id, displayName: 'First' });
    expect(customerRows(sqlite)).toHaveLength(1);
  });

  it('rethrows a primary-key collision', async () => {
    const sqlite = createDb();
    const db = createDbClient(d1Of(sqlite));
    insertCustomerRow(sqlite, { id: 1, platform: 'line', platformUserId: 'U1' });

    await expect(insertOrGetCustomer(db, { id: 1, platform: 'line', platformUserId: 'U2' })).rejects.toThrow();
    expect(customerRows(sqlite)).toHaveLength(1);
  });

  it('rethrows when the row holding the key is soft-deleted', async () => {
    const sqlite = createDb();
    const db = createDbClient(d1Of(sqlite));
    insertCustomerRow(sqlite, { id: 1, platform: 'line', platformUserId: 'U1', deletedAt: NOW });

    const error = await insertOrGetCustomer(db, { platform: 'line', platformUserId: 'U1' }).then(() => null, (e: unknown) => e);
    expect(isUniqueConstraintError(error, 'customers.platform_user_id')).toBe(true);
  });
});

describe('CustomerCrudService on a lost create race', () => {
  it('create reports CustomerAlreadyExistsError instead of a database error', async () => {
    const sqlite = createDb();
    const service = new CustomerCrudService(racingD1(sqlite, { id: 5, platform: 'line', platformUserId: 'U5' }));

    await expect(service.create({ platform: 'line', platformUserId: 'U5' })).rejects.toBeInstanceOf(CustomerAlreadyExistsError);
    expect(customerRows(sqlite)).toHaveLength(1);
  });

  it('findOrCreate returns the existing customer', async () => {
    const sqlite = createDb();
    const service = new CustomerCrudService(racingD1(sqlite, { id: 5, platform: 'line', platformUserId: 'U5' }));

    await expect(service.findOrCreate('line', 'U5')).resolves.toMatchObject({ id: 5, platformUserId: 'U5' });
    expect(customerRows(sqlite)).toHaveLength(1);
  });
});
