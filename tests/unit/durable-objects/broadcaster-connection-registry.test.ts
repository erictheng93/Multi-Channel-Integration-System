import { describe, expect, it, vi } from 'vitest'
import { BroadcasterConnectionRegistry } from '@/durable-objects/services/broadcaster-connection-registry'
import type { BroadcasterContext, BroadcasterHelpers } from '@/durable-objects/services/broadcaster-helpers'

function setup() {
  const get = vi.fn((name: string) => ({ name, n: get.mock.calls.length }))
  const ctx = {
    env: { USER_CONNECTION: { idFromName: (n: string) => n, get } },
    userConnections: new Map(),
    userRegistrationGen: new Map<string, number>(),
    conversationRooms: new Map(),
    stats: { activeConnections: 0 }
  } as unknown as BroadcasterContext
  const helpers = { persistConnectionIds: vi.fn().mockResolvedValue(undefined) } as unknown as BroadcasterHelpers
  const registry = new BroadcasterConnectionRegistry(ctx, helpers)
  const register = (id: string) => registry.handleRegisterConnection(
    new Request('https://x/register-connection', { method: 'POST', body: JSON.stringify({ type: 'user', id }) }))
  return { ctx, register, get }
}

describe('BroadcasterConnectionRegistry user registration', () => {
  it('keeps the same stub on re-registration and bumps the generation', async () => {
    const { ctx, register, get } = setup()
    await register('u1')
    const first = ctx.userConnections.get('u1')
    expect(ctx.userRegistrationGen.get('u1')).toBe(1)
    await register('u1')
    expect(ctx.userConnections.get('u1')).toBe(first)
    expect(get).toHaveBeenCalledTimes(1)
    expect(ctx.userRegistrationGen.get('u1')).toBe(2)
  })
})
