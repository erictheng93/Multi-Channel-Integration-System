import Database from 'better-sqlite3';
import { afterEach, expect, it } from 'vitest';
import { broadcastWaitMarker, readAwaitingSince } from '@/services/wait-marker';
import type { Bindings } from '@/types';

let sqlite: Database.Database;
afterEach(() => sqlite?.close());

function setup() {
  sqlite = new Database(':memory:');
  sqlite.exec(`CREATE TABLE conversations (id TEXT PRIMARY KEY, awaiting_since TEXT, assigned_team_id INTEGER);
    INSERT INTO conversations VALUES ('team', NULL, 7), ('pool', '2026-11-10T00:00:00.000Z', NULL);`);
  const db = { prepare: (q: string) => ({ bind: (...p: unknown[]) => ({ first: async () => sqlite.prepare(q).get(...p) ?? null }) }) };
  const sent: Array<{ url: string; body: any }> = [];
  const env = {
    DB: db,
    MESSAGE_BROADCASTER: {
      idFromName: (n: string) => n,
      get: () => ({ fetch: async (r: Request) => { sent.push({ url: r.url, body: await r.json() }); return new Response('{}'); } }),
    },
  } as unknown as Bindings;
  return { env, sent };
}

it('reads the trigger-maintained marker, undefined for an unknown conversation', async () => {
  const { env } = setup();
  expect(await readAwaitingSince(env.DB, 'pool')).toBe('2026-11-10T00:00:00.000Z');
  expect(await readAwaitingSince(env.DB, 'team')).toBeNull();
  expect(await readAwaitingSince(env.DB, 'missing')).toBeUndefined();
});

it('sends the marker to the owning team plus admins, or globally for the shared pool', async () => {
  const { env, sent } = setup();
  await broadcastWaitMarker(env, 'team');
  await broadcastWaitMarker(env, 'pool');
  await broadcastWaitMarker(env, 'missing');
  expect(sent.map(s => [new URL(s.url).pathname, s.body.event.type, s.body.event.data.awaitingSince, s.body.teamIds])).toEqual([
    ['/broadcast-to-teams-and-admins', 'conversation_updated', null, [7]],
    ['/broadcast-global', 'conversation_updated', '2026-11-10T00:00:00.000Z', undefined],
  ]);
});
