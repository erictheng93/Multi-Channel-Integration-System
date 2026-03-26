<template>
  <div class="bg-white rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.04)] p-5">
    <h3 class="text-[17px] font-bold text-[#1C1C1E] mb-4">
      Channel Integrations
    </h3>
    <div class="flex flex-col">
      <div
        v-for="(channel, index) in channels"
        :key="channel.id"
        class="flex items-center gap-3 px-3 py-3 rounded-xl"
        :class="index % 2 === 0 ? 'bg-[#FAFBFC]' : 'bg-white'"
      >
        <div
          class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          :style="{ backgroundColor: getBrandBg(channel.name) }"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            :style="{ color: getBrandColor(channel.name) }"
          >
            <path
              v-if="isLine(channel.name)"
              d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
            />
            <template v-else-if="isFacebook(channel.name)">
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
            </template>
            <template v-else>
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </template>
          </svg>
        </div>

        <div class="flex-1 min-w-0">
          <div class="text-[14px] font-semibold text-[#1C1C1E] truncate">
            {{ channel.name }}
          </div>
          <div
            class="text-[12px]"
            :class="channel.status === 'connected' ? 'text-[#34C759]' : 'text-[#FF3B30]'"
          >
            {{ statusLabel(channel.status) }}
          </div>
        </div>

        <div class="flex items-center gap-2 flex-shrink-0">
          <span class="text-[12px] text-[#8E8E93] tabular-nums">{{ channel.latencyMs }}ms</span>
          <span
            class="w-2 h-2 rounded-full"
            :class="statusDotClass(channel.status)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChannelItem, ChannelStatus } from '@/types/api-monitor'

defineProps<{
  channels: ChannelItem[]
}>()

function isLine(name: string): boolean {
  return name.toLowerCase().includes('line')
}

function isFacebook(name: string): boolean {
  return name.toLowerCase().includes('facebook') || name.toLowerCase().includes('messenger')
}

function getBrandColor(name: string): string {
  if (isLine(name)) {return '#06C755'}
  if (isFacebook(name)) {return '#1877F2'}
  return '#007AFF'
}

function getBrandBg(name: string): string {
  if (isLine(name)) {return 'rgba(6, 199, 85, 0.1)'}
  if (isFacebook(name)) {return 'rgba(24, 119, 242, 0.1)'}
  return 'rgba(0, 122, 255, 0.1)'
}

function statusLabel(status: ChannelStatus): string {
  const map: Record<ChannelStatus, string> = {
    connected: 'Connected',
    disconnected: 'Disconnected',
    error: 'Error',
  }
  return map[status]
}

function statusDotClass(status: ChannelStatus): string {
  if (status === 'connected') {return 'bg-[#34C759]'}
  if (status === 'error') {return 'bg-[#FF3B30]'}
  return 'bg-[#8E8E93]'
}
</script>
