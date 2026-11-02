<template>
  <Transition
    @enter="onEnter"
    @after-enter="onAfterEnter"
    @leave="onLeave"
  >
    <div
      v-if="show && entries.length > 0"
      class="detail-panel"
    >
      <div class="detail-panel__content">
        <div
          v-for="(entry, index) in entries"
          :key="index"
          class="detail-entry"
        >
          <span class="detail-key">{{ entry.key }}</span>
          <template v-if="entry.type === 'diff'">
            <span
              v-if="entry.oldValue"
              class="detail-value detail-value--old"
              :title="entry.oldValue"
            >{{ entry.oldValue }}</span>
            <span
              v-if="entry.oldValue"
              class="detail-arrow"
            >&rarr;</span>
            <span
              class="detail-value detail-value--new"
              :title="entry.value"
            >{{ entry.value }}</span>
          </template>
          <template v-else>
            <span
              class="detail-value"
              :class="{
                'detail-value--old': entry.type === 'old-value',
                'detail-value--new': entry.type === 'new-value',
              }"
              :title="entry.value"
            >{{ entry.value }}</span>
          </template>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { DetailEntry } from './types'

defineProps<{
  entries: DetailEntry[]
  show: boolean
}>()

function onEnter(el: Element): void {
  const htmlEl = el as HTMLElement
  htmlEl.style.maxHeight = '0'
  htmlEl.style.opacity = '0'
  htmlEl.style.overflow = 'hidden'
  // Force reflow
  void htmlEl.offsetHeight
  htmlEl.style.transition = 'max-height 300ms ease-out, opacity 300ms ease-out'
  htmlEl.style.maxHeight = `${htmlEl.scrollHeight}px`
  htmlEl.style.opacity = '1'
}

function onAfterEnter(el: Element): void {
  const htmlEl = el as HTMLElement
  htmlEl.style.maxHeight = ''
  htmlEl.style.opacity = ''
  htmlEl.style.overflow = ''
  htmlEl.style.transition = ''
}

function onLeave(el: Element): void {
  const htmlEl = el as HTMLElement
  htmlEl.style.maxHeight = `${htmlEl.scrollHeight}px`
  htmlEl.style.overflow = 'hidden'
  // Force reflow
  void htmlEl.offsetHeight
  htmlEl.style.transition = 'max-height 300ms ease-out, opacity 300ms ease-out'
  htmlEl.style.maxHeight = '0'
  htmlEl.style.opacity = '0'
}
</script>

<style scoped>
.detail-panel__content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
  padding: 12px 14px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-surface-2);
}

.detail-entry {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
  font-size: 13px;
}

.detail-key {
  flex: none;
  width: 76px;
  font-size: 13px;
  color: var(--ui-muted);
}

.detail-value {
  min-width: 0;
  color: var(--ui-ink);
  word-break: break-all;
}

.detail-value--old {
  color: var(--ui-muted);
  text-decoration: line-through;
  text-decoration-color: color-mix(in srgb, var(--ui-muted) 60%, transparent);
}

.detail-value--new {
  font-weight: 600;
}

.detail-arrow {
  flex-shrink: 0;
  color: var(--ui-faint);
}
</style>
