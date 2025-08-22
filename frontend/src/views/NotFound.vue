<template>
  <div class="not-found-page">
    <div class="not-found-content">
      <div class="error-illustration">
        <div class="error-code">
          404
        </div>
        <div class="error-icon">
          🔍
        </div>
      </div>
      
      <div class="error-message">
        <h1>頁面不存在</h1>
        <p>抱歉，您要找的頁面不存在或已被移除。</p>
      </div>
      
      <div class="error-actions">
        <router-link
          to="/dashboard"
          class="btn btn-primary"
        >
          <HomeIcon />
          回到首頁
        </router-link>
        <button
          class="btn btn-secondary"
          @click="goBack"
        >
          <ArrowLeftIcon />
          返回上頁
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const HomeIcon = {
  template: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>`
}

const ArrowLeftIcon = {
  template: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 19-7-7 7-7"/><path d="m19 12-7 7-7-7"/></svg>`
}

const router = useRouter()

const goBack = () => {
  if (window.history.length > 1) {
    router.go(-1)
  } else {
    router.push('/dashboard')
  }
}
</script>

<style scoped>
.not-found-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--gray-50), var(--gray-100));
  padding: var(--space-8);
}

.not-found-content {
  text-align: center;
  max-width: 500px;
}

.error-illustration {
  position: relative;
  margin-bottom: var(--space-8);
}

.error-code {
  font-size: 8rem;
  font-weight: 900;
  color: var(--primary-200);
  line-height: 1;
  margin-bottom: var(--space-4);
}

.error-icon {
  font-size: 4rem;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translate(-50%, -50%) translateY(0px); }
  50% { transform: translate(-50%, -50%) translateY(-10px); }
}

.error-message h1 {
  font-size: 2rem;
  font-weight: 700;
  color: var(--gray-900);
  margin-bottom: var(--space-4);
}

.error-message p {
  font-size: 1.125rem;
  color: var(--gray-600);
  margin-bottom: var(--space-8);
  line-height: 1.6;
}

.error-actions {
  display: flex;
  gap: var(--space-4);
  justify-content: center;
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .error-code {
    font-size: 6rem;
  }
  
  .error-message h1 {
    font-size: 1.5rem;
  }
  
  .error-actions {
    flex-direction: column;
    align-items: center;
  }
  
  .error-actions .btn {
    width: 100%;
    max-width: 200px;
  }
}
</style>