import { describe, expect, it } from 'vitest';
import { authenticateUser as authenticateUtil } from '@/utils/auth';
import { authenticateUser as authenticateService, hashPassword } from '@/modules/auth/services/auth';
import { SYSTEM_AGENT_ID, isSystemAgentId, notSystemAgentSql } from '@/constants/system-agent';

// A D1 stub that returns one agents row for the login lookup, whatever the email is.
function dbReturning(row: Record<string, unknown>): D1Database {
  return {
    prepare: () => ({ bind: () => ({ first: async () => row }) })
  } as unknown as D1Database;
}

describe('system agent helpers', () => {
  it('has one id and one predicate', () => {
    expect(SYSTEM_AGENT_ID).toBe('system');
    expect(isSystemAgentId('system')).toBe(true);
    expect(isSystemAgentId('admin-001')).toBe(false);
    expect(notSystemAgentSql('a.id')).toBe("a.id <> 'system'");
  });
});

describe.each([
  ['utils/auth', authenticateUtil],
  ['services/auth', authenticateService]
])('%s authenticateUser never signs the system actor in', (_name, authenticate) => {
  it('rejects it even when it is active and the password matches its hash', async () => {
    const hash = await hashPassword('Secret#123');
    const db = dbReturning({
      id: 'system', email: 'system@internal', password_hash: hash, display_name: 'System', role: 'agent',
      is_active: 1, password_policy: 'changeable', created_at: 'x', updated_at: 'x'
    });
    const result = await authenticate(db, 'system@internal', 'Secret#123');
    expect(result.user).toBeNull();
    expect(result.accountStatus).toBe('not_found');
  });
});
