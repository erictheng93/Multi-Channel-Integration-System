<template>
  <div class="bg-white rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.04)] p-5">
    <h3 class="text-[17px] font-bold text-[#1C1C1E] mb-4">
      Infrastructure
    </h3>
    <div class="flex flex-col gap-[14px]">
      <div
        v-for="item in infrastructure"
        :key="item.id"
        class="flex items-center gap-3"
      >
        <div
          class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          :style="{ backgroundColor: getIconBg(item.name), color: getIconColor(item.name) }"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              v-for="(d, pi) in getIconPaths(item.name)"
              :key="pi"
              :d="d"
            />
          </svg>
        </div>
        <span class="text-[13px] text-[#1C1C1E] flex-1">{{ item.name }}</span>
        <span
          class="text-[13px] font-semibold tabular-nums"
          :class="latencyColorClass(item.latencyMs)"
        >
          {{ item.latencyMs }}ms
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { InfrastructureItem } from '@/types/api-monitor'

defineProps<{
  infrastructure: InfrastructureItem[]
}>()

const DB_PATHS: string[] = [
  'M12 2C6.48 2 2 3.79 2 6v12c0 2.21 4.48 4 10 4s10-1.79 10-4V6c0-2.21-4.48-4-10-4z',
  'M2 6c0 2.21 4.48 4 10 4s10-1.79 10-4',
  'M2 12c0 2.21 4.48 4 10 4s10-1.79 10-4',
]
const KEY_PATHS: string[] = [
  'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4',
]
const CLOUD_PATHS: string[] = [
  'M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z',
]
const ZAP_PATHS: string[] = [
  'M13 2L3 14h9l-1 10 10-12h-9l1-10z',
]

function getIconPaths(name: string): string[] {
  const lower = name.toLowerCase()
  if (lower.includes('d1') || lower.includes('database')) {return DB_PATHS}
  if (lower.includes('kv')) {return KEY_PATHS}
  if (lower.includes('r2') || lower.includes('storage')) {return CLOUD_PATHS}
  if (lower.includes('do') || lower.includes('durable')) {return ZAP_PATHS}
  return DB_PATHS
}

function getIconBg(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes('d1') || lower.includes('database')) {return '#E3F2FD'}
  if (lower.includes('kv')) {return '#FFF3E0'}
  if (lower.includes('r2') || lower.includes('storage')) {return '#E8F5E9'}
  if (lower.includes('do') || lower.includes('durable')) {return '#F3E5F5'}
  return '#E3F2FD'
}

function getIconColor(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes('d1') || lower.includes('database')) {return '#007AFF'}
  if (lower.includes('kv')) {return '#FF9500'}
  if (lower.includes('r2') || lower.includes('storage')) {return '#2E7D32'}
  if (lower.includes('do') || lower.includes('durable')) {return '#7B1FA2'}
  return '#007AFF'
}

function latencyColorClass(ms: number): string {
  if (ms < 50) {return 'text-[#34C759]'}
  if (ms < 200) {return 'text-[#FF9500]'}
  return 'text-[#FF3B30]'
}
</script>
