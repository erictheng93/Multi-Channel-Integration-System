<template>
  <div
    v-if="visible && !dismissed"
    class="history-retention-notice"
    :class="{ 'is-keyboard-open': keyboardOpen }"
    role="note"
  >
    <span
      class="hrn-icon"
      aria-hidden="true"
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
        <circle
          cx="12"
          cy="12"
          r="10"
        />
        <line
          x1="12"
          y1="8"
          x2="12"
          y2="12"
        />
        <line
          x1="12"
          y1="16"
          x2="12.01"
          y2="16"
        />
      </svg>
    </span>
    <span
      class="hrn-text"
      :title="`LINE 僅保留近 6 個月記錄，${boundaryLabel} 前的訊息已無法顯示`"
    >LINE 僅保留近 6 個月記錄<span class="hrn-more">，{{ boundaryLabel }} 前的訊息已無法顯示</span></span>
    <button
      type="button"
      class="hrn-close"
      aria-label="關閉提示"
      @click="dismiss"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linecap="round"
        aria-hidden="true"
      ><path d="M18 6 6 18M6 6l12 12" /></svg>
    </button>
  </div>
</template>

<script setup lang="ts">
/**
 * HistoryRetentionNotice — informs agents that LINE only retains ~6 months of
 * chat history, so messages older than the restore boundary cannot be shown.
 * Rendered only for LINE conversations. Purely informational (no DB record).
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Conversation platform; the notice only applies to LINE. */
    platform?: string | null
    /** Boundary date label shown to the agent (YYYY/MM/DD). */
    boundaryLabel?: string
  }>(),
  {
    platform: null,
    boundaryLabel: '2025/12/17'
  }
)

const STORAGE_KEY = 'mcis.history-retention-notice.dismissed'
function readDismissed(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === '1' } catch { return false }
}
const dismissed = ref(readDismissed())
function dismiss(): void {
  dismissed.value = true
  try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* private mode: the chip just returns next visit */ }
}

const visible = computed(() => (props.platform || '').toLowerCase() === 'line')
const boundaryLabel = computed(() => props.boundaryLabel)

/* iOS Safari and Android Chrome (without interactive-widget=resizes-content) open the on-screen
   keyboard by shrinking only the visual viewport; CSS height queries keep seeing the layout
   viewport. Compare the two: height * scale cancels pinch-zoom, leaving the keyboard's height. */
const KEYBOARD_MIN_HEIGHT = 150
const keyboardOpen = ref(false)

function updateKeyboardOpen(): void {
  const vv = window.visualViewport
  keyboardOpen.value = !!vv && window.innerHeight - vv.height * vv.scale > KEYBOARD_MIN_HEIGHT
}

onMounted(() => {
  window.visualViewport?.addEventListener('resize', updateKeyboardOpen)
  updateKeyboardOpen()
})
onBeforeUnmount(() => {
  window.visualViewport?.removeEventListener('resize', updateKeyboardOpen)
})
</script>

<style scoped>
.history-retention-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  max-width: calc(100% - 32px);
  margin: 10px auto 0;
  padding: 4px 4px 4px 12px;
  border-radius: 18px;
  background: var(--ui-accent-soft);
  color: var(--ui-ink);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
}

.hrn-icon {
  display: inline-flex;
  flex-shrink: 0;
  color: var(--ui-accent);
}

.hrn-text {
  min-width: 0;
}

.hrn-close {
  display: grid;
  flex: none;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--ui-ink-2);
  cursor: pointer;
}

.hrn-close:hover {
  background: var(--ui-fill);
}

@media (pointer: coarse) {
  .hrn-close {
    width: 44px;
    height: 44px;
    margin: -8px 0;
  }
}

/* Phone: the headline only, one line (the boundary date sits in the title) */
@media (max-width: 768px) {
  .history-retention-notice {
    max-width: calc(100% - 24px);
    margin-top: 8px;
  }

  .hrn-more {
    display: none;
  }
}

/* On-screen keyboard open: the reply box and message list matter more than an informational
   note, which would otherwise take ~75px of a ~120px message area. The height query covers
   browsers that resize the layout viewport; .is-keyboard-open covers visual-viewport-only ones. */
@media (max-width: 768px) and (max-height: 600px) {
  .history-retention-notice {
    display: none;
  }
}

@media (max-width: 768px) {
  .history-retention-notice.is-keyboard-open {
    display: none;
  }
}
</style>
