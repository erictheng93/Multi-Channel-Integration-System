<template>
  <div
    v-if="hasError"
    class="error-boundary"
  >
    <div class="error-container">
      <div class="error-icon">
        <svg
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke-width="2"
          />
          <path
            d="M12 8v4M12 16h.01"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </div>
      <h2>糟糕！出現了一些問題</h2>
      <p class="error-message">
        {{ errorMessage }}
      </p>
      <div class="error-actions">
        <button
          class="btn btn-primary"
          @click="reload"
        >
          重新載入頁面
        </button>
        <button
          class="btn btn-secondary"
          @click="goHome"
        >
          返回首頁
        </button>
      </div>
      <details
        v-if="isDev"
        class="error-details"
      >
        <summary>錯誤詳情</summary>
        <pre>{{ errorDetails }}</pre>
      </details>
    </div>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const hasError = ref(false)
const errorMessage = ref('頁面載入時發生錯誤')
const errorDetails = ref('')
const isDev = import.meta.env.DEV

// 捕獲子組件錯誤
onErrorCaptured((error: Error, _instance, info) => {
  console.error('ErrorBoundary caught:', error, info)
  
  hasError.value = true
  errorMessage.value = error.message || '未知錯誤'
  errorDetails.value = `${error.stack}\n\nComponent Info: ${info}`
  
  // 防止錯誤繼續傳播
  return false
})

const reload = () => {
  window.location.reload()
}

const goHome = () => {
  hasError.value = false
  errorMessage.value = ''
  errorDetails.value = ''
  router.push('/dashboard')
}
</script>

<style scoped>
.error-boundary {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
}

.error-container {
  background: white;
  border-radius: 16px;
  padding: 3rem;
  max-width: 500px;
  width: 100%;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.error-icon {
  display: inline-flex;
  color: #e53e3e;
  margin-bottom: 1.5rem;
}

.error-container h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 1rem;
}

.error-message {
  color: #718096;
  margin-bottom: 2rem;
  line-height: 1.5;
}

.error-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.error-details {
  margin-top: 2rem;
  text-align: left;
  background: #f7fafc;
  padding: 1rem;
  border-radius: 8px;
}

.error-details summary {
  cursor: pointer;
  font-weight: 500;
  color: #4a5568;
  margin-bottom: 0.5rem;
}

.error-details pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.875rem;
  color: #e53e3e;
}
</style>