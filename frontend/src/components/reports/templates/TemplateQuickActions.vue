<!-- 快速動作工具列 -->
<!-- Quick action toolbar for popular templates -->

<template>
  <div class="quick-actions">
    <div class="quick-actions-content">
      <h3>快速動作</h3>
      <div class="quick-buttons">
        <button
          v-for="quickTemplate in popularTemplates"
          :key="quickTemplate.name"
          class="quick-btn"
          :disabled="generating"
          @click="$emit('use', quickTemplate)"
        >
          <span class="quick-icon">{{ quickTemplate.icon }}</span>
          <span class="quick-label">{{ quickTemplate.name }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ReportTemplate } from '@/types/reports';

defineProps<{
  popularTemplates: ReportTemplate[];
  generating: boolean;
}>();

defineEmits<{
  use: [template: ReportTemplate];
}>();
</script>

<style scoped>
.quick-actions {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 2rem;
  color: white;
  text-align: center;
}

.quick-actions-content h3 {
  margin-bottom: 1.5rem;
  font-size: 1.3rem;
}

.quick-buttons {
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.quick-btn {
  background: rgba(255, 255, 255, 0.15);
  border: 2px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  min-width: 120px;
}

.quick-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-2px);
}

.quick-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.quick-icon {
  font-size: 1.5rem;
}

.quick-label {
  font-size: 0.9rem;
  font-weight: 500;
}

@media (max-width: 768px) {
  .quick-buttons {
    flex-direction: column;
  }
}
</style>
