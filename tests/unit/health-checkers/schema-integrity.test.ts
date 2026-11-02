import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import {
  REQUIRED_TRIGGERS,
  SCHEMA_TRIGGER_ALERT_KEY,
  SchemaIntegrityHealthChecker,
  checkSchemaTriggers,
  findMissingTriggers,
} from '@/health-checkers/schema-integrity';
import type { Bindings } from '@/types';

function dbWithTriggers(present: readonly string[]): D1Database {
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        all: vi.fn(async () => ({ results: present.map(name => ({ name })) })),
      })),
    })),
  } as unknown as D1Database;
}

function kvStub(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const cache = {
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    put: vi.fn(async (k: string, v: string) => { store.set(k, v); }),
    delete: vi.fn(async (k: string) => { store.delete(k); }),
  } as unknown as Bindings['CACHE'];
  return { cache, store };
}

describe('REQUIRED_TRIGGERS', () => {
  it('lists exactly the triggers the migrations create, so it cannot go stale', () => {
    const dir = join(__dirname, '../../../migrations');
    const created = readdirSync(dir)
      .filter(f => f.endsWith('.sql'))
      .flatMap(f => [...readFileSync(join(dir, f), 'utf8').matchAll(/CREATE\s+TRIGGER\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi)])
      .map(m => m[1])
      .filter(name => name.startsWith('trg_messages_awaiting_') || name.startsWith('trg_messages_marker_'));
    expect([...new Set(created)].sort()).toEqual([...REQUIRED_TRIGGERS].sort());
  });
});

describe('findMissingTriggers', () => {
  it('returns nothing when every trigger exists', async () => {
    expect(await findMissingTriggers(dbWithTriggers(REQUIRED_TRIGGERS))).toEqual([]);
  });

  it('names the triggers a rebuild dropped', async () => {
    const present = REQUIRED_TRIGGERS.filter(n => !n.includes('awaiting'));
    const missing = await findMissingTriggers(dbWithTriggers(present));
    expect(missing).toEqual(REQUIRED_TRIGGERS.filter(n => n.includes('awaiting')));
  });
});

describe('checkSchemaTriggers (nightly)', () => {
  it('raises the KV alert while triggers are missing', async () => {
    const { cache, store } = kvStub();
    const missing = await checkSchemaTriggers(dbWithTriggers([]), cache);
    expect(missing).toHaveLength(REQUIRED_TRIGGERS.length);
    expect(JSON.parse(store.get(SCHEMA_TRIGGER_ALERT_KEY) ?? '{}').missing).toHaveLength(REQUIRED_TRIGGERS.length);
  });

  it('clears the alert once the triggers are back, and writes nothing when healthy', async () => {
    const { cache, store } = kvStub({ [SCHEMA_TRIGGER_ALERT_KEY]: '{"missing":["x"]}' });
    expect(await checkSchemaTriggers(dbWithTriggers(REQUIRED_TRIGGERS), cache)).toEqual([]);
    expect(store.has(SCHEMA_TRIGGER_ALERT_KEY)).toBe(false);
    await checkSchemaTriggers(dbWithTriggers(REQUIRED_TRIGGERS), cache);
    expect(cache.put).not.toHaveBeenCalled();
  });
});

describe('SchemaIntegrityHealthChecker', () => {
  it('is critical and lists the missing triggers', async () => {
    const result = await new SchemaIntegrityHealthChecker(dbWithTriggers(REQUIRED_TRIGGERS.slice(1))).check();
    expect(result.status).toBe('critical');
    expect(result.details).toMatchObject({ missing: [REQUIRED_TRIGGERS[0]] });
  });

  it('is healthy when all triggers exist', async () => {
    const result = await new SchemaIntegrityHealthChecker(dbWithTriggers(REQUIRED_TRIGGERS)).check();
    expect(result.status).toBe('healthy');
  });
});
