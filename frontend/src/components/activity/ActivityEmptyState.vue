<template>
  <div
    class="empty-state"
    :class="{ 'empty-state--error': variant === 'error' }"
  >
    <template v-if="variant === 'loading'">
      <div class="empty-state__spinner" />
      <p class="empty-state__text empty-state__text--muted">
        {{ loadingText }}
      </p>
    </template>

    <template v-else-if="variant === 'empty'">
      <ClockIcon
        :size="48"
        class="empty-state__icon"
      />
      <h3 class="empty-state__title">
        {{ emptyTitle }}
      </h3>
      <p class="empty-state__text">
        {{ emptySubtitle }}
      </p>
    </template>

    <template v-else-if="variant === 'error'">
      <p class="empty-state__text empty-state__text--error">
        {{ displayMessage }}
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ClockIcon } from '@/components/icons'

const props = defineProps<{
  variant: 'loading' | 'empty' | 'error'
  message?: string
}>()

const loadingText = '\u8F09\u5165\u6D3B\u52D5\u8A18\u9304\u4E2D...'
const emptyTitle = '\u6C92\u6709\u6D3B\u52D5\u8A18\u9304'
const emptySubtitle = '\u5728\u9078\u5B9A\u7684\u6642\u9593\u7BC4\u570D\u5167\u6C92\u6709\u627E\u5230\u4EFB\u4F55\u6D3B\u52D5\u8A18\u9304'

const displayMessage = computed(() => {
  return props.message ?? '\u767C\u751F\u932F\u8AA4\uFF0C\u8ACB\u7A0D\u5F8C\u518D\u8A66'
})
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 48px 24px;
  border-radius: var(--ui-r-card);
  background: var(--ui-surface);
  box-shadow: var(--ui-shadow-card);
  text-align: center;
}

.empty-state--error {
  background: var(--ui-red-soft);
}

.empty-state__spinner {
  width: 30px;
  height: 30px;
  border: 3px solid var(--ui-fill-strong);
  border-top-color: var(--ui-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state__icon {
  color: var(--ui-faint);
}

.empty-state__title {
  margin: 0;
  font: 600 16px var(--ui-font-display);
  color: var(--ui-ink);
}

.empty-state__text {
  max-width: 40ch;
  margin: 0;
  font-size: 13.5px;
  color: var(--ui-muted);
}

.empty-state__text--muted {
  color: var(--ui-muted);
}

.empty-state__text--error {
  color: var(--ui-red-ink);
}
</style>
