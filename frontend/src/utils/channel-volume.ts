import type { ChannelIntegration } from '@/api/channels'

/**
 * 24 h message totals over the active channels that report activity; null when none does.
 *
 * `channel.activity` is a platform-wide figure repeated on every channel of that platform (see
 * channel-overview-stats-service.ts), so each platform counts once however many channels it has.
 */
export function platformVolume24h(
  channels: readonly ChannelIntegration[]
): { customer: number; agent: number } | null {
  const byPlatform = new Map<string, NonNullable<ChannelIntegration['activity']>>()
  for (const channel of channels) {
    if (channel.isActive && channel.activity) {
      byPlatform.set(channel.platform, channel.activity)
    }
  }
  if (byPlatform.size === 0) { return null }

  const activities = [...byPlatform.values()]
  return {
    customer: activities.reduce((sum, a) => sum + a.customerMessages24h, 0),
    agent: activities.reduce((sum, a) => sum + a.agentMessages24h, 0)
  }
}
