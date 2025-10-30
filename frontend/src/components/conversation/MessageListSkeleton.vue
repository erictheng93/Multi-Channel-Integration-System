<template>
  <div class="message-list-skeleton">
    <div class="skeleton-messages">
      <!-- 動態生成骨架消息 -->
      <div
        v-for="(item, index) in skeletonItems"
        :key="`skeleton-${index}`"
        class="skeleton-message"
        :class="item.type === 'customer' ? 'customer-message' : 'agent-message'"
        :style="{ animationDelay: `${index * 0.1}s` }"
      >
        <div
          v-if="item.type === 'customer'"
          class="skeleton-avatar"
        />
        <div class="skeleton-bubble">
          <div
            class="skeleton-text"
            :style="{ width: item.width }"
          />
          <div
            v-if="item.hasSecondLine"
            class="skeleton-text short"
            :style="{ width: item.secondLineWidth }"
          />
        </div>
        <div
          v-if="item.type === 'agent'"
          class="skeleton-avatar"
        />
      </div>
    </div>

    <div class="skeleton-hint">
      <div class="skeleton-hint-icon">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
          />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </div>
      <span>{{ loadingText }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  count?: number // 骨架條目數量 (3-10)
  loadingText?: string
}

const props = withDefaults(defineProps<Props>(), {
  count: 5,
  loadingText: '載入對話歷史...'
})

// 生成骨架條目配置
const skeletonItems = computed(() => {
  const items = []
  const actualCount = Math.min(10, Math.max(3, props.count))

  for (let i = 0; i < actualCount; i++) {
    // 交替生成客戶和代理消息（60% 客戶，40% 代理）
    const isCustomer = i % 5 < 3
    const type = isCustomer ? 'customer' : 'agent'

    // 隨機寬度
    const widths = isCustomer
      ? ['60%', '75%', '85%', '70%', '65%']
      : ['65%', '80%', '75%', '90%', '70%']

    const width = widths[i % widths.length] || '70%'

    // 30% 的機率有第二行
    const hasSecondLine = i % 3 === 0
    const secondLineWidth = ['40%', '50%', '45%'][i % 3] || '45%'

    items.push({
      type,
      width,
      hasSecondLine,
      secondLineWidth
    })
  }

  return items
})
</script>

<style scoped>
.message-list-skeleton {
  display: flex;
  flex-direction: column;
  padding: var(--space-6);
  gap: var(--space-4);
  background: linear-gradient(to bottom, var(--gray-50), var(--gray-100));
  min-height: 400px;
  animation: fadeIn 0.3s ease-out;
}

.skeleton-messages {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  flex: 1;
}

.skeleton-message {
  display: flex;
  gap: var(--space-3);
  animation: slideIn 0.4s ease-out both;
  max-width: 80%;
}

.customer-message {
  align-self: flex-start;
  flex-direction: row;
}

.agent-message {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.skeleton-avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  background: linear-gradient(
    90deg,
    var(--gray-200) 0%,
    var(--gray-300) 50%,
    var(--gray-200) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  flex-shrink: 0;
}

.skeleton-bubble {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  min-width: 150px;
}

.customer-message .skeleton-bubble {
  border-bottom-left-radius: 4px;
}

.agent-message .skeleton-bubble {
  border-bottom-right-radius: 4px;
  background: var(--primary-50);
}

.skeleton-text {
  height: 16px;
  border-radius: var(--radius-sm);
  background: linear-gradient(
    90deg,
    var(--gray-200) 0%,
    var(--gray-300) 50%,
    var(--gray-200) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

.skeleton-text.short {
  height: 14px;
}

.agent-message .skeleton-text {
  background: linear-gradient(
    90deg,
    var(--primary-100) 0%,
    var(--primary-200) 50%,
    var(--primary-100) 100%
  );
  background-size: 200% 100%;
}

.skeleton-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3);
  margin-top: var(--space-4);
  color: var(--gray-500);
  font-size: 0.875rem;
  font-weight: 500;
  animation: pulse 2s ease-in-out infinite;
}

.skeleton-hint-icon {
  display: flex;
  align-items: center;
  color: var(--primary-500);
  animation: spin 2s linear infinite;
}

/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Mobile responsive */
@media (max-width: 768px) {
  .message-list-skeleton {
    padding: var(--space-4);
    min-height: 300px;
  }

  .skeleton-message {
    max-width: 85%;
  }

  .skeleton-avatar {
    width: 32px;
    height: 32px;
  }

  .skeleton-bubble {
    padding: var(--space-3);
    min-width: 120px;
  }

  .skeleton-hint {
    font-size: 0.8125rem;
  }
}
</style>
