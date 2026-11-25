// CustomerCrudService: the paths production uses.
// The only production caller is PATCH /api/customers/:id (customer-main.ts), which calls
// update() to set or clear the agent nickname (customName); update() reads back via findById().
// Real SQLite + real Drizzle (D1 driver), so WHERE scoping and column mapping are exercised.
import { describe, it, expect, beforeEach } from 'vitest';
import Sqlite from 'better-sqlite3';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { customers } from '@/db/schema';
import { CustomerCrudService } from '@modules/customer/services/customer-crud';
import { CustomerNotFoundError } from '@modules/customer/types/customer-types';
import { d1Of } from '../../../../helpers/sqlite-d1';

const OLD = '2024-06-15T10:00:00.000Z';

function createDb(): Sqlite.Database {
  const sqlite = new Sqlite(':memory:');
  const config = getTableConfig(customers);
  sqlite.exec(`CREATE TABLE "${config.name}" (${config.columns.map(column =>
    `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}`).join(', ')})`);
  const insert = sqlite.prepare(
    `INSERT INTO customers (id, platform, platform_user_id, display_name, custom_name, avatar_url, email, phone,
       source_team_id, metadata, created_at, updated_at)
     VALUES (?, 'line', ?, ?, ?, 'https://example.com/a.png', 'c@example.com', '+886912345678', 1, ?, ?, ?)`
  );
  insert.run(1, 'U1', 'Profile Name', null, '{"line":{"statusMessage":"hi"}}', OLD, OLD);
  insert.run(2, 'U2', 'Other Customer', 'Other Nick', null, OLD, OLD);
  return sqlite;
}

const row = (sqlite: Sqlite.Database, id: number) =>
  sqlite.prepare('SELECT * FROM customers WHERE id = ?').get(id) as Record<string, unknown>;

describe('CustomerCrudService (real SQLite)', () => {
  let sqlite: Sqlite.Database;
  let service: CustomerCrudService;

  beforeEach(() => {
    sqlite = createDb();
    service = new CustomerCrudService(d1Of(sqlite));
  });

  describe('findById', () => {
    it('maps every column of the requested row', async () => {
      expect(await service.findById(1)).toEqual({
        id: 1,
        platform: 'line',
        platformUserId: 'U1',
        displayName: 'Profile Name',
        customName: null,
        avatarUrl: 'https://example.com/a.png',
        email: 'c@example.com',
        phone: '+886912345678',
        sourceTeamId: 1,
        metadata: '{"line":{"statusMessage":"hi"}}',
        createdAt: OLD,
        updatedAt: OLD
      });
      expect((await service.findById(2))?.customName).toBe('Other Nick');
    });

    it('returns null for an unknown id', async () => {
      expect(await service.findById(999)).toBeNull();
    });
  });

  describe('update', () => {
    it('sets customName on that customer only and returns the fresh row', async () => {
      const updated = await service.update(1, { customName: 'VIP Wang' });

      expect(updated.customName).toBe('VIP Wang');
      expect(updated.displayName).toBe('Profile Name');
      expect(updated.updatedAt).not.toBe(OLD);
      expect(row(sqlite, 1).custom_name).toBe('VIP Wang');
      // The other customer is untouched (WHERE is scoped by id)
      expect(row(sqlite, 2)).toMatchObject({ custom_name: 'Other Nick', updated_at: OLD });
    });

    it('clears customName with null and leaves the other fields alone', async () => {
      await service.update(1, { customName: 'Nick' });
      const cleared = await service.update(1, { customName: null });

      expect(cleared.customName).toBeNull();
      expect(row(sqlite, 1)).toMatchObject({
        custom_name: null,
        display_name: 'Profile Name',
        email: 'c@example.com',
        phone: '+886912345678',
        source_team_id: 1,
        metadata: '{"line":{"statusMessage":"hi"}}'
      });
    });

    it('serializes metadata to JSON and stores null when cleared', async () => {
      await service.update(1, { metadata: { tier: 'gold' } });
      expect(row(sqlite, 1).metadata).toBe('{"tier":"gold"}');

      await service.update(1, { metadata: null });
      expect(row(sqlite, 1).metadata).toBeNull();
    });

    it('throws CustomerNotFoundError and writes nothing for an unknown id', async () => {
      await expect(service.update(999, { customName: 'x' })).rejects.toThrow(CustomerNotFoundError);
      expect(row(sqlite, 1).updated_at).toBe(OLD);
      expect(row(sqlite, 2).updated_at).toBe(OLD);
    });
  });
});
