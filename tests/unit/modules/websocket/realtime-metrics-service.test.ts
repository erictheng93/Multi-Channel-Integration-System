import { readFileSync } from 'node:fs'
import Sqlite from 'better-sqlite3'
import { drizzle, type RemoteCallback } from 'drizzle-orm/sqlite-proxy'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '@/db/schema'
import type { Database } from '@/db/drizzle-factory'

const holder: { db: Database | null } = { db: null }
vi.mock('@/db/drizzle-factory', () => ({
  createDbClient: () => {
    if (!holder.db) throw new Error('no db')
    return holder.db
  }
}))

import {
  WS_METRICS_RETENTION_MS,
  downsample,
  getWsMetricsHistory,
  recordWsMetricsSnapshot
} from '@modules/websocket/services/realtime-metrics-service'

const NOW = Date.UTC(2026, 9, 29, 12, 0, 0)
const HOUR = 60 * 60 * 1000

function makeDb() {
  const sqlite = new Sqlite(':memory:')
  sqlite.exec(readFileSync('migrations/0068_add_ws_metrics_snapshots.sql', 'utf8'))
  const execute: RemoteCallback = async (sql, params, method) => {
    const statement = sqlite.prepare(sql)
    if (method === 'run') { statement.run(...params); return { rows: [] } }
    const rows = statement.raw().all(...params)
    return { rows: method === 'get' ? rows[0] as unknown[] : rows }
  }
  const db = drizzle(execute, async (queries) => Promise.all(queries.map(q => execute(q.sql, q.params, q.method))), { schema })
  return { sqlite, db: db as unknown as Database }
}

function broadcasterEnv(handler: () => Response | Promise<Response>) {
  const fetch = vi.fn(async () => handler())
  const env = {
    DB: {} as D1Database,
    MESSAGE_BROADCASTER: {
      idFromName: (name: string) => name,
      get: () => ({ fetch })
    } as unknown as DurableObjectNamespace
  }
  return { env, fetch }
}

const metrics = {
  registeredConnections: 7,
  activeConnections: 7,
  onlineAgents: 4,
  eventsInPerSecond: 1.5,
  eventsOutPerSecond: 3,
  averageLatency: 12,
  errorRate: 0.02
}

describe('recordWsMetricsSnapshot', () => {
  let fixture: ReturnType<typeof makeDb>
  const count = () => (fixture.sqlite.prepare('SELECT COUNT(*) AS n FROM ws_metrics_snapshots').get() as { n: number }).n

  beforeEach(() => {
    fixture = makeDb()
    holder.db = fixture.db
  })

  it('writes one row from a single broadcaster request', async () => {
    const { env, fetch } = broadcasterEnv(() => Response.json(metrics))
    expect(await recordWsMetricsSnapshot(env, NOW)).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fixture.sqlite.prepare('SELECT * FROM ws_metrics_snapshots').get()).toMatchObject({
      ts: NOW, active_connections: 7, online_agents: 4, events_in_per_s: 1.5,
      events_out_per_s: 3, avg_processing_ms: 12, error_rate: 0.02
    })
  })

  it('stores unknown rates as NULL, not zero', async () => {
    const { env } = broadcasterEnv(() => Response.json({
      ...metrics, eventsInPerSecond: null, eventsOutPerSecond: null, errorRate: null
    }))
    await recordWsMetricsSnapshot(env, NOW)
    expect(fixture.sqlite.prepare('SELECT events_in_per_s, error_rate FROM ws_metrics_snapshots').get())
      .toEqual({ events_in_per_s: null, error_rate: null })
  })

  it('records nothing and does not throw when the broadcaster is unavailable', async () => {
    const failing = broadcasterEnv(() => { throw new Error('broadcaster down') })
    await expect(recordWsMetricsSnapshot(failing.env, NOW)).resolves.toBe(false)
    const unhealthy = broadcasterEnv(() => new Response('nope', { status: 500 }))
    await expect(recordWsMetricsSnapshot(unhealthy.env, NOW)).resolves.toBe(false)
    await expect(recordWsMetricsSnapshot({ DB: {} as D1Database }, NOW)).resolves.toBe(false)
    expect(count()).toBe(0)
  })

  it('does not throw when the database is unavailable', async () => {
    holder.db = null
    const { env } = broadcasterEnv(() => Response.json(metrics))
    await expect(recordWsMetricsSnapshot(env, NOW)).resolves.toBe(false)
  })

  it('prunes rows older than 7 days in the same run, even when the broadcaster is down', async () => {
    const insert = fixture.sqlite.prepare('INSERT INTO ws_metrics_snapshots (ts, active_connections, online_agents) VALUES (?, 1, 1)')
    insert.run(NOW - WS_METRICS_RETENTION_MS - 1)
    insert.run(NOW - WS_METRICS_RETENTION_MS + 1000)
    const down = broadcasterEnv(() => { throw new Error('down') })
    await recordWsMetricsSnapshot(down.env, NOW)
    expect(count()).toBe(1)

    const { env } = broadcasterEnv(() => Response.json(metrics))
    await recordWsMetricsSnapshot(env, NOW)
    expect(count()).toBe(2)
  })
})

describe('getWsMetricsHistory', () => {
  let fixture: ReturnType<typeof makeDb>
  beforeEach(() => { fixture = makeDb() })

  const seed = (rows: Array<[number, number]>) => {
    const insert = fixture.sqlite.prepare('INSERT INTO ws_metrics_snapshots (ts, active_connections, online_agents, events_in_per_s) VALUES (?, ?, 1, 2)')
    for (const [ts, connections] of rows) insert.run(ts, connections)
  }

  it('returns only rows inside the range, oldest first', async () => {
    seed([[NOW - 2 * HOUR, 1], [NOW - 30 * 60 * 1000, 2], [NOW - 10 * 60 * 1000, 3]])
    const points = await getWsMetricsHistory(fixture.db, '1h', NOW)
    expect(points.map(p => p.activeConnections)).toEqual([2, 3])
    expect((await getWsMetricsHistory(fixture.db, '6h', NOW)).length).toBe(3)
  })

  it('is empty with no data', async () => {
    expect(await getWsMetricsHistory(fixture.db, '7d', NOW)).toEqual([])
  })

  it('downsamples a full 7 day history (every 5 min) to at most 300 points', async () => {
    const rows: Array<[number, number]> = []
    for (let ts = NOW - WS_METRICS_RETENTION_MS + 1; ts <= NOW; ts += 5 * 60 * 1000) rows.push([ts, 10])
    seed(rows)
    expect(rows.length).toBeGreaterThan(2000)
    const points = await getWsMetricsHistory(fixture.db, '7d', NOW)
    expect(points.length).toBeLessThanOrEqual(300)
    expect(points.length).toBeGreaterThan(150)
    expect(points[0].activeConnections).toBe(10)
    expect(points.map(p => p.ts)).toEqual([...points.map(p => p.ts)].sort((a, b) => a - b))
  })
})

describe('downsample', () => {
  it('averages known values and keeps null when a bucket has none', () => {
    const rows = Array.from({ length: 4 }, (_, i) => ({
      id: i, ts: i, activeConnections: i * 2, onlineAgents: 1,
      eventsInPerS: i === 0 ? null : 3, eventsOutPerS: null, avgProcessingMs: null, errorRate: null
    }))
    const points = downsample(rows, 2)
    expect(points).toHaveLength(2)
    expect(points[0]).toMatchObject({ ts: 0, activeConnections: 1, eventsInPerS: 3, eventsOutPerS: null })
  })
})
