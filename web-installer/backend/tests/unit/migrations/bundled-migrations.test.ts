import { describe, it, expect } from 'vitest';
import { BUNDLED_MIGRATIONS } from '@/migrations/bundled-migrations';

const sqlOf = (version: string) => BUNDLED_MIGRATIONS.find(m => m.version === version)?.sql ?? '';
const allSql = BUNDLED_MIGRATIONS.map(m => m.sql).join('\n');

describe('BUNDLED_MIGRATIONS', () => {
  it('has contiguous, unique versions matching their filenames', () => {
    BUNDLED_MIGRATIONS.forEach((m, i) => {
      expect(m.version).toBe(String(i + 1).padStart(4, '0'));
      expect(m.filename.startsWith(`${m.version}_`)).toBe(true);
    });
  });

  it('never indexes a table before a migration creates it', () => {
    const created = new Set<string>();
    for (const m of BUNDLED_MIGRATIONS) {
      for (const t of m.sql.matchAll(/CREATE TABLE IF NOT EXISTS\s+(\w+)/gi)) created.add(t[1]);
      for (const i of m.sql.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+IF NOT EXISTS\s+\w+\s+ON\s+(\w+)/gi)) {
        expect(created, `${m.version} indexes ${i[1]} before it exists`).toContain(i[1]);
      }
    }
  });

  it('carries the objects the current worker reads', () => {
    expect(allSql).toMatch(/ALTER TABLE customers ADD COLUMN custom_name/);
    expect(allSql).toMatch(/CREATE TABLE IF NOT EXISTS broadcast_attachments/);
    expect(allSql).toMatch(/ALTER TABLE conversations ADD COLUMN unread_floor_at/);
    expect(allSql).toMatch(/CREATE TABLE IF NOT EXISTS conversation_read_states/);
    expect(allSql).toMatch(/CREATE TABLE IF NOT EXISTS auto_reply_rules/);
    expect(sqlOf("0018")).not.toMatch(/ON customer_team_assignments/);
  });

  it('has no semicolons inside the generated catch-up statements (the runner splits on them)', () => {
    for (const m of BUNDLED_MIGRATIONS.filter(x => Number(x.version) >= 19)) {
      expect(m.sql.replace(/;\s*(\n|$)/g, '\n')).not.toContain(';');
    }
  });
});
