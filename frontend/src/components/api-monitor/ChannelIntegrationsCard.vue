<template>
  <article class="ui-card">
    <div class="ui-card-head">
      <div>
        <h2 class="ui-card-title">
          頻道整合
        </h2>
        <div class="ui-card-sub">
          Webhook 與發送狀態
        </div>
      </div>
    </div>
    <div class="list">
      <div
        v-for="channel in channels"
        :key="channel.id"
        class="chn"
      >
        <span
          class="tile"
          :class="brand(channel.name)"
          aria-hidden="true"
        >
          <svg
            v-if="brand(channel.name) !== 'other'"
            viewBox="0 0 24 24"
          ><path d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.7 6.2L5 21l4.1-2.3c.9.2 1.9.3 2.9.3 5.5 0 10-3.6 10-8s-4.5-8-10-8Z" /></svg>
          <svg
            v-else
            class="stroke"
            viewBox="0 0 24 24"
          ><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
        </span>
        <div class="main">
          <b>
            {{ translateChannelName(channel.id, channel.name) }}
            <span
              class="ui-pill ui-pill-dot"
              :class="pillClass(shownStatus(channel))"
            >{{ statusLabel(shownStatus(channel)) }}</span>
          </b>
          <small :title="channel.details">{{ detailText(channel) }}</small>
        </div>
        <div
          v-if="channel.latencyMs > 0"
          class="lat"
        >
          <b>{{ channel.latencyMs }} ms</b>
        </div>
      </div>
      <div
        v-if="channels.length === 0"
        class="none"
      >
        尚無資料
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { ChannelItem, ChannelStatus } from '@/types/api-monitor'
import { translateChannelDetail, translateChannelName } from '@/utils/monitor-helpers'

const props = defineProps<{
  channels: ChannelItem[]
}>()

type ShownStatus = ChannelStatus | 'degraded'

/**
 * Webhook delivery is derived from the channels above it: it can only be "connected" when
 * every channel is. If some are not, the chip says so instead of contradicting its description.
 */
function shownStatus(channel: ChannelItem): ShownStatus {
  if (channel.id !== 'webhook-delivery' || channel.status !== 'connected') { return channel.status }
  const others = props.channels.filter(c => c.id !== channel.id)
  return others.some(c => c.status !== 'connected') ? 'degraded' : 'connected'
}

function brand(name: string): 'line' | 'facebook' | 'other' {
  const lower = name.toLowerCase()
  if (lower.includes('line')) { return 'line' }
  if (lower.includes('facebook') || lower.includes('messenger')) { return 'facebook' }
  return 'other'
}

function detailText(channel: ChannelItem): string {
  return shownStatus(channel) === 'degraded'
    ? translateChannelDetail('Some webhook channels unavailable', channel.status)
    : translateChannelDetail(channel.details, channel.status)
}

function statusLabel(status: ShownStatus): string {
  const map: Record<ShownStatus, string> = {
    connected: '已連線',
    disconnected: '未連線',
    error: '錯誤',
    degraded: '部分可用',
  }
  return map[status]
}

function pillClass(status: ShownStatus): string {
  if (status === 'connected') { return 'ui-pill-green' }
  if (status === 'degraded') { return 'ui-pill-orange' }
  return status === 'error' ? 'ui-pill-red' : ''
}
</script>

<style scoped>
.list {
  padding-bottom: 8px;
}

.chn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 22px;
}

.tile {
  display: grid;
  flex: none;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 11px;
  background: var(--ui-accent);
}

.tile.line {
  background: var(--ui-line);
}

.tile.facebook {
  background: var(--ui-messenger);
}

.tile.other {
  background: var(--ui-fill);
  color: var(--ui-muted);
}

.tile svg {
  width: 20px;
  height: 20px;
  fill: #fff;
}

.tile svg.stroke {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.main {
  flex: 1;
  min-width: 0;
}

.main b {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.main small {
  display: block;
  margin-top: 2px;
  font-size: 13px;
  color: var(--ui-muted);
}

.lat {
  flex: none;
  font-size: 13px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.lat b {
  font: 600 14px var(--ui-font-display);
  color: var(--ui-ink);
}

.none {
  padding: 12px 22px;
  font-size: 13px;
  color: var(--ui-muted);
}
</style>
