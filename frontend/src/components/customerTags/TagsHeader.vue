<template>
  <div class="welcome-section">
    <div class="welcome-content">
      <div class="welcome-greeting">
        <h1 class="welcome-title">
          客戶標籤管理 
        </h1>
        <p class="welcome-subtitle">
          統一管理和組織您的客戶標籤，提升客戶分類效率
        </p>
      </div>
      <div class="welcome-actions">
        <button
          class="btn btn-primary btn-lg"
          @click="$emit('create-tag')"
        >
          <PlusIcon />
          <span>新增標籤</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PlusIcon } from '@/components/icons'

defineEmits<{
  'create-tag': []
}>()
</script>

<style scoped>
/* Welcome Section */
.welcome-section {
  margin-bottom: var(--space-12);
  padding: var(--space-8) 0;
}

.welcome-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 100%;
  gap: var(--space-6);
}

.welcome-greeting {
  flex: 1;
}

.welcome-title {
  font-size: clamp(1.75rem, 1.5rem + 2vw, 2.8rem);
  font-weight: 800;
  color: var(--gray-900);
  margin-bottom: var(--space-2);
  letter-spacing: -0.025em;
  line-height: 1.2;
}

.welcome-subtitle {
  font-size: 1rem;
  color: var(--gray-600);
  font-weight: 400;
  margin: 0;
  line-height: 1.5;
}

.welcome-actions {
  display: flex;
  gap: var(--space-4);
  align-items: center;
  flex-shrink: 0;
}

.btn svg {
  width: 18px;
  height: 18px;
}

/* Responsive Design */
@media (max-width: 768px) {
  .welcome-content {
    flex-direction: column;
    align-items: flex-start;
  }

  .welcome-actions {
    width: 100%;
  }

  .btn-lg {
    width: 100%;
  }

  .welcome-title {
    font-size: 1.75rem;
  }
}
</style>
