<template>
  <div
    v-if="visible"
    class="history-retention-notice"
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
    <span class="hrn-text">
      LINE 官方帳號僅保留近 6 個月的聊天記錄，{{ boundaryLabel }} 之前的歷史訊息已無法顯示。
    </span>
  </div>
</template>

<script setup lang="ts">
/**
 * HistoryRetentionNotice — informs agents that LINE only retains ~6 months of
 * chat history, so messages older than the restore boundary cannot be shown.
 * Rendered only for LINE conversations. Purely informational (no DB record).
 */
import { computed } from 'vue'

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

const visible = computed(() => (props.platform || '').toLowerCase() === 'line')
const boundaryLabel = computed(() => props.boundaryLabel)
</script>

<style scoped>
.history-retention-notice {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 8px 16px;
  padding: 8px 14px;
  border-radius: 12px;
  background: #eef1f6;
  color: #8e8e93;
  font-size: 13px;
  line-height: 1.4;
  text-align: center;
}

.hrn-icon {
  display: inline-flex;
  flex-shrink: 0;
  color: #007aff;
}

.hrn-text {
  word-break: break-word;
}

@media (max-width: 768px) {
  .history-retention-notice {
    font-size: 12px;
    margin: 6px 12px;
    padding: 7px 12px;
  }
}
</style>
