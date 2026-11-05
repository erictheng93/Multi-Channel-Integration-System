import { describe, expect, it } from 'vitest'
import { ChannelService } from '@modules/integrations/services/channel-service'
import type { Bindings } from '@/types'

// A D1 binding whose every query fails, as during a D1 outage.
const failingDb = {
  prepare: () => {
    throw new Error('D1_ERROR: database unavailable')
  },
  batch: () => Promise.reject(new Error('D1_ERROR: database unavailable')),
}

const service = () => new ChannelService({ DB: failingDb } as unknown as Bindings)

describe('ChannelService reads on a database error', () => {
  it('getChannelsByTeam rejects instead of reporting "no channels"', async () => {
    await expect(service().getChannelsByTeam()).rejects.toThrow('database unavailable')
  })

  it('getChannel rejects instead of reporting "not found"', async () => {
    await expect(service().getChannel(1)).rejects.toThrow('database unavailable')
  })
})
