<template>
  <div class="message-skeleton-container">
    <div
      v-for="index in count"
      :key="index"
      class="message-skeleton"
      :class="{ 
        'skeleton-sent': index % 3 === 0, 
        'skeleton-received': index % 3 !== 0 
      }"
    >
      <!-- 頭像骨架 -->
      <div 
        v-if="index % 3 !== 0"
        class="skeleton-avatar skeleton-shimmer"
      />
      
      <!-- 消息內容骨架 -->
      <div class="skeleton-content">
        <!-- 消息氣泡骨架 -->
        <div class="skeleton-bubble skeleton-shimmer">
          <!-- 文字行骨架 -->
          <div class="skeleton-text-lines">
            <div 
              v-for="line in getRandomLines()"
              :key="line"
              class="skeleton-text-line skeleton-shimmer"
              :style="{ width: getRandomWidth() }"
            />
          </div>
        </div>
        
        <!-- 時間戳骨架 -->
        <div class="skeleton-timestamp skeleton-shimmer" />
      </div>
      
      <!-- 已發送消息的頭像（右側） -->
      <div 
        v-if="index % 3 === 0"
        class="skeleton-avatar skeleton-shimmer"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  /** 骨架屏顯示的消息數量 */
  count?: number
  /** 是否顯示動畫效果 */
  animated?: boolean
}

withDefaults(defineProps<Props>(), {
  count: 5,
  animated: true
})

// 隨機生成文字行數（1-3行）
const getRandomLines = () => {
  return Math.floor(Math.random() * 3) + 1
}

// 隨機生成寬度（模擬不同長度的文字）
const getRandomWidth = () => {
  const widths = ['60%', '80%', '45%', '90%', '70%', '35%', '85%']
  return widths[Math.floor(Math.random() * widths.length)]
}
</script>

<style scoped>
.message-skeleton-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 800px;
  margin: 0 auto;
  padding: var(--space-4) 0;
}

.message-skeleton {
  display: flex;
  align-items: flex-end;
  gap: var(--space-3);
  opacity: 0;
  animation: skeletonFadeIn 0.4s ease forwards;
}

.message-skeleton:nth-child(1) { animation-delay: 0.1s; }
.message-skeleton:nth-child(2) { animation-delay: 0.2s; }
.message-skeleton:nth-child(3) { animation-delay: 0.3s; }
.message-skeleton:nth-child(4) { animation-delay: 0.4s; }
.message-skeleton:nth-child(5) { animation-delay: 0.5s; }

/* 已發送消息（右對齊） */
.skeleton-sent {
  flex-direction: row-reverse;
  justify-content: flex-start;
}

.skeleton-sent .skeleton-content {
  align-items: flex-end;
}

.skeleton-sent .skeleton-bubble {
  background: linear-gradient(
    135deg,
    rgba(99, 102, 241, 0.1),
    rgba(99, 102, 241, 0.05)
  );
}

/* 接收消息（左對齊） */
.skeleton-received {
  flex-direction: row;
  justify-content: flex-start;
}

.skeleton-received .skeleton-content {
  align-items: flex-start;
}

.skeleton-received .skeleton-bubble {
  background: linear-gradient(
    135deg,
    rgba(107, 114, 128, 0.1),
    rgba(107, 114, 128, 0.05)
  );
}

/* 頭像骨架 */
.skeleton-avatar {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  background: linear-gradient(
    135deg,
    rgba(148, 163, 184, 0.2),
    rgba(148, 163, 184, 0.1)
  );
  flex-shrink: 0;
}

/* 內容骨架 */
.skeleton-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-width: 70%;
  min-width: 200px;
}

/* 消息氣泡骨架 */
.skeleton-bubble {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-xl);
  position: relative;
  overflow: hidden;
}

/* 文字行骨架 */
.skeleton-text-lines {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.skeleton-text-line {
  height: 16px;
  border-radius: var(--radius-sm);
  background: linear-gradient(
    135deg,
    rgba(148, 163, 184, 0.3),
    rgba(148, 163, 184, 0.1)
  );
}

/* 時間戳骨架 */
.skeleton-timestamp {
  height: 12px;
  width: 60px;
  border-radius: var(--radius-sm);
  background: linear-gradient(
    135deg,
    rgba(148, 163, 184, 0.2),
    rgba(148, 163, 184, 0.08)
  );
}

/* 閃爍動畫效果 */
.skeleton-shimmer {
  position: relative;
  overflow: hidden;
}

.skeleton-shimmer::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.4),
    transparent
  );
  animation: shimmer 2s infinite ease-in-out;
}

/* 響應式調整 */
@media (max-width: 768px) {
  .message-skeleton-container {
    gap: var(--space-3);
    padding: var(--space-3) 0;
  }
  
  .skeleton-avatar {
    width: 32px;
    height: 32px;
  }
  
  .skeleton-content {
    max-width: 85%;
    min-width: 150px;
  }
  
  .skeleton-bubble {
    padding: var(--space-2) var(--space-3);
  }
}

/* 動畫定義 */
@keyframes skeletonFadeIn {
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
    left: -100%;
  }
  50% {
    left: 100%;
  }
  100% {
    left: 100%;
  }
}

/* 暗黑模式支持 */
@media (prefers-color-scheme: dark) {
  .skeleton-avatar {
    background: linear-gradient(
      135deg,
      rgba(75, 85, 99, 0.3),
      rgba(75, 85, 99, 0.1)
    );
  }
  
  .skeleton-sent .skeleton-bubble {
    background: linear-gradient(
      135deg,
      rgba(99, 102, 241, 0.2),
      rgba(99, 102, 241, 0.1)
    );
  }
  
  .skeleton-received .skeleton-bubble {
    background: linear-gradient(
      135deg,
      rgba(75, 85, 99, 0.2),
      rgba(75, 85, 99, 0.1)
    );
  }
  
  .skeleton-text-line {
    background: linear-gradient(
      135deg,
      rgba(75, 85, 99, 0.4),
      rgba(75, 85, 99, 0.2)
    );
  }
  
  .skeleton-timestamp {
    background: linear-gradient(
      135deg,
      rgba(75, 85, 99, 0.3),
      rgba(75, 85, 99, 0.1)
    );
  }
  
  .skeleton-shimmer::after {
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.1),
      transparent
    );
  }
}
</style>