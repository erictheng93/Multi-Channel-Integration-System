import { describe, it, expect } from 'vitest';
import { isBackupKey } from '@modules/data/handlers/backup';

describe('isBackupKey (#273)', () => {
  it('accepts the keys the app and the backup workflow write', () => {
    expect(isBackupKey('manual/mcis-db-2026-11-20T15-17-00-000Z.sql')).toBe(true);
    expect(isBackupKey('daily/mcis-db-2026-11-23-123456789-1.sql.gz')).toBe(true);
    expect(isBackupKey('members/members-2026-11-23-123456789-1.sql.gz')).toBe(true);
  });

  it('rejects other prefixes, traversal, nesting and header metacharacters', () => {
    for (const key of [
      '',
      'mcis-db.sql',
      'secrets/config.json',
      '../daily/x.sql',
      'daily/../secrets/x',
      'daily/.hidden',
      'daily/a/b.sql',
      'daily/',
      'daily/x"y.sql',
      'daily/x\r\nX-Injected: 1.sql',
    ]) {
      expect(isBackupKey(key), key).toBe(false);
    }
  });
});
