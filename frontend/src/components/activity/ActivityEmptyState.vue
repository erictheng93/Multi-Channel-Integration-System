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
  background: #FFFFFF;
  border-radius: 28px;
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.06);
  padding: 48px 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.empty-state--error {
  background: #FFF2F2;
}

.empty-state__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #E5E5EA;
  border-top-color: #007AFF;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state__icon {
  color: #AEAEB2;
}

.empty-state__title {
  font-size: 18px;
  font-weight: 600;
  color: #1C1C1E;
  margin: 0;
}

.empty-state__text {
  font-size: 14px;
  color: #8E8E93;
  margin: 0;
}

.empty-state__text--muted {
  color: #8E8E93;
}

.empty-state__text--error {
  color: #FF3B30;
}
</style>
