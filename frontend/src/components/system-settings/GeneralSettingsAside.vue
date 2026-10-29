<!--
  GeneralSettingsAside.vue
  Context beside the general form: a live preview of the system name as the product mark shows it,
  and the current clock in the selected time zone. Both read the form's own (unsaved) values.
-->
<template>
  <article class="ui-card aside-card preview">
    <div
      class="preview-mark"
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24"><path d="M12 3C6.5 3 2 6.6 2 11c0 2.5 1.4 4.7 3.7 6.2L5 21l4.1-2.3c.9.2 1.9.3 2.9.3 5.5 0 10-3.6 10-8s-4.5-8-10-8Z" /></svg>
    </div>
    <div class="preview-text">
      <div class="aside-eyebrow">
        系統名稱預覽
      </div>
      <div class="preview-name">
        {{ systemName || '尚未命名' }}
      </div>
    </div>
  </article>
  <article class="ui-card aside-card clock">
    <div
      class="clock-art"
      aria-hidden="true"
    >
      <DiscRing
        class="clock-disc"
        variant="hero"
        :size="300"
        fade="soft"
      />
    </div>
    <div class="aside-eyebrow">
      目前時間 · {{ timezone || 'Asia/Taipei' }}
    </div>
    <div class="clock-time">
      {{ time }}
    </div>
    <div class="clock-date">
      {{ date }}
    </div>
  </article>
  <p class="aside-note">
    修改後按「儲存變更」才會生效；想放棄未儲存的修改，按「還原」。
  </p>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DiscRing from '@/components/ui/DiscRing.vue'

const props = defineProps<{
  systemName: string
  timezone: string
}>()

function parts(options: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat('zh-TW', {
      timeZone: props.timezone || 'Asia/Taipei',
      ...options
    }).format(new Date())
  } catch {
    return '—'
  }
}

/** Read once per selection change; no timers (the clock is a reference, not a ticker). */
const time = computed(() => parts({ hour: '2-digit', minute: '2-digit', hour12: false }))
const date = computed(() => parts({ year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }))
</script>

<style scoped>
.aside-card {
  padding: 18px 20px;
}

.aside-eyebrow {
  font-size: var(--ui-t-meta);
  font-weight: 600;
  color: var(--ui-muted);
}

.preview {
  display: flex;
  gap: 14px;
  align-items: center;
}

.preview-mark {
  display: grid;
  flex: none;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(160deg, #3d9bff, #0060df);
}

.preview-mark svg {
  width: 26px;
  height: 26px;
  fill: #fff;
}

.preview-text {
  min-width: 0;
}

.preview-name {
  overflow: hidden;
  font: 600 17px var(--ui-font-display);
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.clock {
  position: relative;
  isolation: isolate;
  min-height: 150px;
}

.clock-art {
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  border-radius: inherit;
  pointer-events: none;
}

.clock-disc {
  position: absolute;
  top: -120px;
  right: -120px;
  opacity: 0.8;
}

@media (min-width: 1025px) {
  /* line the first card up with the first form card, below its group caption */
  .preview {
    margin-top: 28px;
  }
}

.clock-time {
  margin-top: 6px;
  font: var(--ui-w-lead) 44px / 1.05 var(--ui-font-display);
  letter-spacing: var(--ui-track-lead);
  font-variant-numeric: tabular-nums;
}

.clock-date {
  margin-top: 4px;
  font-size: var(--ui-t-meta);
  color: var(--ui-muted);
}

.aside-note {
  margin: 0;
  padding: 0 4px;
  font-size: var(--ui-t-meta);
  line-height: 1.55;
  color: var(--ui-muted);
}
</style>
