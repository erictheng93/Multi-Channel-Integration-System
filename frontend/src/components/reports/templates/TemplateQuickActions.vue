<template>
  <section
    v-if="popularTemplates.length > 0"
    class="ui-card quick-actions"
  >
    <div class="ui-card-head">
      <div>
        <h3 class="ui-card-title">
          常用模板
        </h3>
        <p class="ui-card-sub">
          一鍵以預設值產生
        </p>
      </div>
    </div>
    <div class="quick-buttons">
      <button
        v-for="quickTemplate in popularTemplates"
        :key="quickTemplate.name"
        type="button"
        class="ui-chip quick-btn"
        :disabled="generating"
        @click="$emit('use', quickTemplate)"
      >
        {{ quickTemplate.name }}
      </button>
    </div>
  </section>
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
.quick-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 22px 20px;
}

.quick-btn:disabled {
  opacity: 0.5;
}
</style>
