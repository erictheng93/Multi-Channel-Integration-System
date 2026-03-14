<!-- 報表模板卡片 -->
<!-- Individual template card displayed in the grid -->

<template>
  <div
    class="template-card"
    :class="{ selected: isSelected }"
    @click="$emit('select', template)"
  >
    <!-- 模板圖標和基本資訊 -->
    <div class="template-header">
      <div class="template-icon">
        {{ template.icon }}
      </div>
      <div class="template-basic-info">
        <h3 class="template-name">
          {{ template.name }}
        </h3>
        <p class="template-description">
          {{ template.description }}
        </p>
      </div>
      <div class="template-category">
        <span
          class="category-badge"
          :class="template.category"
        >
          {{ getCategoryLabel(template.category) }}
        </span>
      </div>
    </div>

    <!-- 模板詳細資訊 -->
    <div class="template-details">
      <div class="template-type">
        <strong>報表類型：</strong>
        <span class="type-label">{{ getReportTypeLabel(template.type) }}</span>
      </div>

      <div class="template-time">
        <strong>預估時間：</strong>
        <span class="time-estimate">{{ formatEstimatedTime(template.estimatedTime) }}</span>
      </div>

      <div class="template-filters">
        <strong>必需篩選：</strong>
        <div class="required-filters">
          <span
            v-for="filter in template.requiredFilters"
            :key="filter"
            class="filter-tag required"
          >
            {{ getFilterLabel(filter) }}
          </span>
          <span
            v-if="template.requiredFilters.length === 0"
            class="no-filters"
          >
            無必需篩選
          </span>
        </div>
      </div>

      <div
        v-if="template.optionalFilters.length > 0"
        class="template-optional-filters"
      >
        <strong>可選篩選：</strong>
        <div class="optional-filters">
          <span
            v-for="filter in template.optionalFilters"
            :key="filter"
            class="filter-tag optional"
          >
            {{ getFilterLabel(filter) }}
          </span>
        </div>
      </div>
    </div>

    <!-- 選擇指示器 -->
    <div
      v-if="isSelected"
      class="selection-indicator"
    >
      <i class="check-icon"></i>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ReportTemplate } from '@/types/reports';
import {
  getCategoryLabel,
  getReportTypeLabel,
  getFilterLabel,
  formatEstimatedTime
} from './templateHelpers';

defineProps<{
  template: ReportTemplate;
  isSelected: boolean;
}>();

defineEmits<{
  select: [template: ReportTemplate];
}>();
</script>

<style scoped>
.template-card {
  background: white;
  border: 2px solid #e1e5e9;
  border-radius: 12px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.template-card:hover {
  border-color: #007bff;
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.15);
  transform: translateY(-2px);
}

.template-card.selected {
  border-color: #007bff;
  background: #f8f9ff;
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.2);
}

.template-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.template-icon {
  font-size: 2.5rem;
  flex-shrink: 0;
}

.template-basic-info {
  flex: 1;
}

.template-name {
  font-size: 1.3rem;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 0.5rem;
}

.template-description {
  color: #666;
  font-size: 0.95rem;
  line-height: 1.4;
}

.category-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
}

.category-badge.basic {
  background: #e3f2fd;
  color: #1565c0;
}

.category-badge.enterprise {
  background: #fff3e0;
  color: #e65100;
}

.category-badge.business_intelligence {
  background: #f3e5f5;
  color: #7b1fa2;
}

.category-badge.advanced_analytics {
  background: #e8f5e8;
  color: #2e7d32;
}

.template-details {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.template-type,
.template-time {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.template-type strong,
.template-time strong {
  color: #333;
  min-width: 80px;
}

.type-label {
  background: #f0f4f8;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.85rem;
}

.time-estimate {
  color: #007bff;
  font-weight: 500;
}

.template-filters,
.template-optional-filters {
  font-size: 0.9rem;
}

.template-filters strong,
.template-optional-filters strong {
  color: #333;
  display: block;
  margin-bottom: 0.5rem;
}

.required-filters,
.optional-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.filter-tag {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
}

.filter-tag.required {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #ffcdd2;
}

.filter-tag.optional {
  background: #e8f5e8;
  color: #2e7d32;
  border: 1px solid #c8e6c9;
}

.no-filters {
  color: #999;
  font-style: italic;
}

.selection-indicator {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 2rem;
  height: 2rem;
  background: #007bff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
}

@media (max-width: 768px) {
  .template-header {
    flex-direction: column;
    text-align: center;
  }
}

@media (max-width: 480px) {
  .template-card {
    padding: 1rem;
  }
}
</style>
