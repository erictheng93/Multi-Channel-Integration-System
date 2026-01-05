<template>
  <div class="welcome-section">
    <div class="welcome-content">
      <div class="welcome-greeting">
        <h1 class="welcome-title">
          {{ welcomeMessage }}
        </h1>
        <p class="welcome-subtitle">
          {{ currentDate }}
        </p>
      </div>
      <div class="welcome-actions">
        <PrimaryActionButton
          text="查看對話"
          :icon="ChatIcon"
          to="/conversations"
        />
        <RefreshButton
          :loading="loading"
          @refresh="handleRefresh"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PrimaryActionButton from '@/components/ui/PrimaryActionButton.vue'
import RefreshButton from '@/components/ui/RefreshButton.vue'
import { ChatIcon } from '@/components/icons'

export interface WelcomeSectionProps {
  /**
   * 用户名称
   */
  userName?: string

  /**
   * 当前日期
   */
  currentDate: string

  /**
   * 加载状态
   */
  loading?: boolean

  /**
   * 欢迎消息前缀
   * @default '歡迎'
   */
  welcomePrefix?: string
}

const props = withDefaults(defineProps<WelcomeSectionProps>(), {
  userName: '載入中...',
  loading: false,
  welcomePrefix: '歡迎'
})

const emit = defineEmits<{
  /**
   * 刷新事件
   */
  refresh: []
}>()

/**
 * 完整的欢迎消息
 */
const welcomeMessage = computed(() => {
  return `${props.welcomePrefix}，${props.userName}`
})

/**
 * 处理刷新事件
 */
const handleRefresh = () => {
  emit('refresh')
}
</script>

<style scoped>
.welcome-section {
  margin-bottom: var(--space-12);
  padding: var(--space-8) 0;
}

.welcome-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 100%;
}

.welcome-greeting {
  flex: 1;
}

.welcome-title {
  /* 流體字體，根據螢幕尺寸調整 */
  font-size: clamp(1.75rem, 1.5rem + 2vw, 2.8rem);
  font-weight: 800;
  color: var(--gray-900);
  margin-bottom: var(--space-2);
  letter-spacing: -0.025em;
}

.welcome-subtitle {
  font-size: 1rem;
  color: var(--gray-600);
  font-weight: 400;
}

.welcome-actions {
  display: flex;
  gap: var(--space-4);
  align-items: center;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .welcome-content {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-6);
  }

  .welcome-actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
