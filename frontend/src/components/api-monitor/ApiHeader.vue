<template>
  <div class="api-header">
    <div class="header-content">
      <div class="header-info">
        <h1 class="page-title">
          API 監控儀表板
        </h1>
        <p class="page-subtitle">
          實時監控系統API狀態，快速診斷問題
        </p>
      </div>
    </div>

    <div class="header-actions">
      <div class="auto-refresh-control">
        <label class="auto-refresh-label">
          <input
            v-model="autoRefreshEnabled"
            type="checkbox"
            @change="handleAutoRefreshChange"
          >
          <span>自動刷新 (15秒)</span>
        </label>
      </div>

      <RefreshButton
        :loading="loading"
        @refresh="$emit('refresh')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import RefreshButton from '@/components/ui/RefreshButton.vue'

interface Props {
  loading?: boolean
  autoRefresh?: boolean
}

interface Emits {
  (_e: 'refresh'): void
  (_e: 'toggle-auto-refresh', _enabled: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  autoRefresh: true
})

const emit = defineEmits<Emits>()

const autoRefreshEnabled = ref(props.autoRefresh)

function handleAutoRefreshChange() {
  emit('toggle-auto-refresh', autoRefreshEnabled.value)
}
</script>

<style scoped>
.api-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2.5rem 2rem;
  margin-bottom: 2rem;
  border-radius: 16px;
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.15);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
}

.header-content {
  flex: 1;
}

.header-info {
  text-align: left;
}

.page-title {
  font-size: 2rem;
  font-weight: 700;
  color: white;
  margin: 0 0 0.5rem 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.page-subtitle {
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
  font-weight: 400;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.auto-refresh-control {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: all 0.2s;
}

.auto-refresh-control:hover {
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
}

.auto-refresh-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #374151;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  margin: 0;
}

.auto-refresh-label input[type="checkbox"] {
  margin: 0;
  accent-color: #667eea;
  cursor: pointer;
}

/* Responsive */
@media (max-width: 768px) {
  .api-header {
    flex-direction: column;
    align-items: stretch;
    padding: 2rem 1.5rem;
  }

  .header-info {
    text-align: center;
  }

  .header-actions {
    flex-direction: column;
    gap: 0.75rem;
  }

  .page-title {
    font-size: 1.5rem;
  }

  .page-subtitle {
    font-size: 1rem;
  }
}

@media (max-width: 480px) {
  .api-header {
    padding: 1.5rem 1rem;
  }

  .page-title {
    font-size: 1.25rem;
  }
}
</style>
