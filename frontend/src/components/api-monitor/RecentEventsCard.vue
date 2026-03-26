<template>
  <div class="bg-white rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.04)] p-5">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-[17px] font-bold text-[#1C1C1E]">
        Recent Events
      </h3>
      <button
        class="text-[13px] text-[#007AFF] font-medium hover:underline bg-transparent border-none cursor-pointer"
        @click="$emit('view-all')"
      >
        View All
      </button>
    </div>
    <div class="flex flex-col">
      <div
        v-for="(event, index) in events"
        :key="event.id"
        class="flex items-start gap-3 py-3"
        :class="index < events.length - 1 ? 'border-b border-[#F2F2F7]' : ''"
      >
        <span
          class="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
          :class="eventDotClass(event.type)"
        />
        <div class="flex-1 min-w-0">
          <p class="text-[13px] text-[#1C1C1E] leading-snug m-0">
            {{ event.message }}
          </p>
          <span class="text-[11px] text-[#8E8E93] mt-0.5 block">{{ relativeTime(event.timestamp) }}</span>
        </div>
      </div>
      <div
        v-if="events.length === 0"
        class="text-[13px] text-[#8E8E93] text-center py-4"
      >
        No recent events
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MonitorEvent, EventType } from '@/types/api-monitor'

defineProps<{
  events: MonitorEvent[]
}>()

defineEmits<{
  (_e: 'view-all'): void
}>()

function eventDotClass(type: EventType): string {
  const map: Record<EventType, string> = {
    recovery: 'bg-[#34C759]',
    warning: 'bg-[#FF9500]',
    error: 'bg-[#FF3B30]',
    info: 'bg-[#007AFF]',
  }
  return map[type]
}

function relativeTime(timestamp: string): string {
  const now = Date.now()
  const then = new Date(timestamp).getTime()
  const diffSec = Math.floor((now - then) / 1000)

  if (diffSec < 60) {return `${diffSec}s ago`}
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) {return `${diffMin}m ago`}
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) {return `${diffHr}h ago`}
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}
</script>
