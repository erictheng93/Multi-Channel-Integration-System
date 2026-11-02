import { describe, it, expect } from 'vitest'
import { platformVolume24h } from '@/utils/channel-volume'
import type { ChannelIntegration } from '@/api/channels'

function channel(platform: string, customerMessages24h: number, agentMessages24h: number, isActive = true) {
  return {
    platform,
    isActive,
    activity: {
      customerMessages24h,
      agentMessages24h,
      customerMessagesTotal: 0,
      agentMessagesTotal: 0,
      lastActivityAt: null
    }
  } as unknown as ChannelIntegration
}

describe('platformVolume24h', () => {
  it('counts a platform once however many channels repeat its figure', () => {
    const channels = [channel('line', 10, 4), channel('line', 10, 4), channel('facebook', 3, 1)]
    expect(platformVolume24h(channels)).toEqual({ customer: 13, agent: 5 })
  })

  it('leaves out inactive channels and has no total when nothing reports', () => {
    expect(platformVolume24h([channel('line', 10, 4, false)])).toBeNull()
    expect(platformVolume24h([{ ...channel('line', 1, 1), activity: null } as ChannelIntegration])).toBeNull()
  })
})
