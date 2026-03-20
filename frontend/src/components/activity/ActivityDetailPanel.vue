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
          <span
            class="detail-value"
            :class="{
              'detail-value--old': entry.type === 'old-value',
              'detail-value--new': entry.type === 'new-value',
            }"
          >{{ entry.value }}</span>
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
  background: #F2F2F7;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.detail-entry {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.detail-key {
  font-size: 12px;
  color: #8E8E93;
  width: 96px;
  flex-shrink: 0;
}

.detail-value {
  font-size: 12px;
  color: #1C1C1E;
  font-family: monospace;
  word-break: break-all;
}

.detail-value--old {
  color: #FF3B30;
  text-decoration: line-through;
}

.detail-value--new {
  color: #34C759;
  font-weight: 500;
}
</style>
