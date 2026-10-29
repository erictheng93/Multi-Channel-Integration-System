import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

const service = vi.hoisted(() => ({
  getChannelsByTeam: vi.fn(),
  getChannel: vi.fn(),
  updateChannel: vi.fn(),
  createChannel: vi.fn(),
}))

vi.mock('@modules/integrations/services/channel-service', () => ({
  ChannelService: class {
    getChannelsByTeam = service.getChannelsByTeam
    getChannel = service.getChannel
    updateChannel = service.updateChannel
    createChannel = service.createChannel
  },
}))
vi.mock('@modules/activities', () => ({
  ActivityService: class { async logActivity() { return undefined } },
  ACTIVITY_ACTIONS: { INTEGRATION_CREATE: 'x', INTEGRATION_UPDATE: 'y', INTEGRATION_DELETE: 'z' },
  RESOURCE_TYPES: { INTEGRATION: 'integration' },
}))
vi.mock('@/modules/integrations/services/channel-overview-stats-service', () => ({
  getChannelOverviews: vi.fn(async () => ({
    line: {
      activity: { customerMessages24h: 3, agentMessages24h: 1, customerMessagesTotal: 30, agentMessagesTotal: 10, lastActivityAt: '2026-10-29T01:00:00.000Z' },
      webhookHealth: { processingFailures24h: 2, lastProcessingFailureAt: '2026-10-29T02:00:00.000Z', signatureFailureMinutes24h: 0, lastSignatureFailureAt: null },
    },
  })),
}))

import channelHandler from '../../../../src/modules/integrations/handlers/channel-handler'

const channelRow = {
  id: 1,
  teamId: 1,
  platform: 'line',
  credentials: '{"secret":"enc"}',
  isActive: true,
  isVerified: true,
  errorCount: 0,
  configMetadata: JSON.stringify({ description: 'main', extra: 1 }),
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function makeApp() {
  const app = new Hono()
  app.use('*', async (c, next) => {
    c.set('user' as never, { id: 'u1', role: 'admin', primaryTeamId: 1, displayName: 'A' } as never)
    await next()
  })
  app.route('/', channelHandler)
  return app
}
const env = { DB: {}, CACHE: {} } as never
const json = (method: string, body: unknown) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

beforeEach(() => {
  vi.clearAllMocks()
  service.getChannelsByTeam.mockResolvedValue([channelRow])
  service.getChannel.mockResolvedValue(channelRow)
  service.updateChannel.mockResolvedValue({ success: true, data: channelRow })
  service.createChannel.mockResolvedValue({ success: true, data: channelRow })
})

describe('GET /channels (CH1/CH2)', () => {
  it('attaches per-platform activity and webhook health, parses configMetadata, hides credentials', async () => {
    const res = await makeApp().request('/', {}, env)
    const body = await res.json() as { data: Array<Record<string, any>> }
    const ch = body.data[0]!
    expect(ch.activity.customerMessages24h).toBe(3)
    expect(ch.webhookHealth.processingFailures24h).toBe(2)
    expect(ch.configMetadata).toEqual({ description: 'main', extra: 1 })
    expect(ch).not.toHaveProperty('credentials')
  })
})

describe('channel display name (configMetadata.name)', () => {
  it('PUT stores a trimmed name and keeps other metadata keys', async () => {
    await makeApp().request('/1', json('PUT', { configMetadata: { name: '  Support LINE  ' } }), env)
    expect(service.updateChannel).toHaveBeenCalledWith(
      expect.objectContaining({ configMetadata: { description: 'main', extra: 1, name: 'Support LINE' } })
    )
  })

  it('PUT with an empty name removes it', async () => {
    service.getChannel.mockResolvedValue({ ...channelRow, configMetadata: JSON.stringify({ name: 'Old', description: 'main' }) })
    await makeApp().request('/1', json('PUT', { configMetadata: { name: '' } }), env)
    expect(service.updateChannel).toHaveBeenCalledWith(
      expect.objectContaining({ configMetadata: { description: 'main' } })
    )
  })

  it('PUT without configMetadata leaves metadata untouched', async () => {
    await makeApp().request('/1', json('PUT', { isActive: true }), env)
    expect(service.updateChannel).toHaveBeenCalledWith(expect.objectContaining({ configMetadata: undefined }))
  })

  it('rejects names over 60 characters and non-string names on create and update', async () => {
    const app = makeApp()
    const tooLong = { name: 'x'.repeat(61) }
    expect((await app.request('/1', json('PUT', { configMetadata: tooLong }), env)).status).toBe(400)
    expect((await app.request('/1', json('PUT', { configMetadata: { name: 5 } }), env)).status).toBe(400)
    const create = {
      platform: 'line',
      lineConfig: { channelId: '1', channelAccessToken: 't', channelSecret: 's' },
      configMetadata: tooLong,
    }
    expect((await app.request('/', json('POST', create), env)).status).toBe(400)
    expect(service.createChannel).not.toHaveBeenCalled()
    expect(service.updateChannel).not.toHaveBeenCalled()
  })

  it('POST passes a cleaned name to createChannel', async () => {
    const create = {
      platform: 'line',
      lineConfig: { channelId: '1', channelAccessToken: 't', channelSecret: 's' },
      configMetadata: { name: ' Main ' },
    }
    await makeApp().request('/', json('POST', create), env)
    expect(service.createChannel).toHaveBeenCalledWith(expect.objectContaining({ configMetadata: { name: 'Main' } }))
  })
})
