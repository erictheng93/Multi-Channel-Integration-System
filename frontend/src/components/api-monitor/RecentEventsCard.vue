<template>
  <article class="ui-card">
    <div class="ui-card-head">
      <div>
        <h2 class="ui-card-title">
          近期事件
        </h2>
      </div>
    </div>
    <ul
      v-if="events.length > 0"
      class="ev"
    >
      <li
        v-for="event in events"
        :key="event.id"
      >
        <span
          class="ic"
          :class="event.type"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              v-if="event.type === 'recovery'"
              d="m5 12 5 5L20 7"
            />
            <path
              v-else-if="event.type === 'info'"
              d="M12 8h.01M11 12h1v5h1"
            />
            <path
              v-else
              d="M12 7v6M12 17h.01"
            />
          </svg>
        </span>
        <span class="msg">{{ event.message }}</span>
        <time :datetime="event.timestamp">{{ relativeTime(event.timestamp) }}</time>
      </li>
    </ul>
    <div
      v-else
      class="none"
    >
      近 1 小時沒有事件
    </div>
  </article>
</template>

<script setup lang="ts">
import type { MonitorEvent } from '@/types/api-monitor'
import { formatRelativeTime } from '@/utils/monitor-helpers'

defineProps<{
  events: MonitorEvent[]
}>()

function relativeTime(timestamp: string): string {
  return formatRelativeTime(timestamp)
}
</script>

<style scoped>
.ev {
  margin: 0;
  padding: 0 0 8px;
  list-style: none;
}

.ev li {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 22px;
  font-size: 13.5px;
}

.ev li + li::before {
  content: '';
  position: absolute;
  top: 0;
  right: 22px;
  left: 62px;
  height: 0.5px;
  background: var(--ui-sep);
}

.ic {
  display: grid;
  flex: none;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
}

.ic svg {
  width: 14px;
  height: 14px;
}

.ic.error {
  background: var(--ui-red-soft);
  color: var(--ui-red-ink);
}

.ic.warning {
  background: var(--ui-orange-soft);
  color: var(--ui-orange-ink);
}

.ic.recovery {
  background: var(--ui-green-soft);
  color: var(--ui-green-ink);
}

.ic.info {
  background: var(--ui-accent-soft);
  color: var(--ui-accent);
}

.msg {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

time {
  flex: none;
  font-size: 13px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.none {
  padding: 8px 22px 24px;
  font-size: 13px;
  color: var(--ui-muted);
}

@media (max-width: 768px) {
  .ev li {
    padding: 11px 16px;
  }

  .ev li + li::before {
    right: 16px;
    left: 56px;
  }
}
</style>
