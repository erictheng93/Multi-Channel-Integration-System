<template>
  <section class="ui-card step-card report-type-selector">
    <div class="ui-card-head">
      <span
        class="step-n"
        :class="{ done: !!selectedType }"
      >1</span>
      <div>
        <h3 class="ui-card-title">
          報表類型
        </h3>
        <p class="ui-card-sub">
          {{ selectedType ? '已選：' + selectedLabel : '選擇要產生的報表' }}
        </p>
      </div>
    </div>
    <div class="type-options">
      <ReportChoiceGroup
        :model-value="selectedType"
        :options="typeOptions"
        label="報表類型"
        :columns="3"
        @update:model-value="$emit('select', $event as ReportType)"
      />
    </div>
    <p
      v-if="error"
      class="error-message"
      role="alert"
    >
      {{ error }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ReportsAPI from '@/api/reports';
import ReportChoiceGroup from './ReportChoiceGroup.vue';
import type { ReportType } from '@/types/reports';

interface Props {
  selectedType: ReportType | null;
  error?: string;
}

const props = withDefaults(defineProps<Props>(), {
  error: undefined
});

defineEmits<{
  select: [type: ReportType];
}>();

// Only the types the backend can actually generate
const typeOptions = computed(() => ReportsAPI.getGeneratableOptions().types);

const selectedLabel = computed(
  () => typeOptions.value.find(option => option.value === props.selectedType)?.label ?? ''
);
</script>

<style scoped>
.step-card .ui-card-head {
  align-items: center;
}

.step-n {
  display: grid;
  flex: none;
  width: 26px;
  height: 26px;
  place-items: center;
  border-radius: 50%;
  background: var(--ui-fill);
  font-size: 13px;
  font-weight: 700;
  color: var(--ui-muted);
}

.step-n.done {
  background: var(--ui-accent);
  color: #fff;
}

.type-options {
  padding: 4px 22px 20px;
}

.error-message {
  margin: 0;
  padding: 0 22px 16px;
  font-size: 13px;
  color: var(--ui-red-ink);
}

@media (max-width: 768px) {
  .type-options {
    padding: 4px 16px 16px;
  }
}
</style>
