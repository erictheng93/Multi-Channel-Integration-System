<template>
  <div class="form-group">
    <label class="form-label required">報表類型</label>
    <div class="report-type-grid report-type-selector">
      <div
        v-for="typeGroup in groupedReportTypes"
        :key="typeGroup.category"
        class="type-category"
      >
        <h3 class="category-title">
          {{ typeGroup.title }}
        </h3>
        <div class="type-options">
          <div
            v-for="option in typeGroup.types"
            :key="option.value"
            class="type-option"
            :class="{ 'selected': selectedType === option.value }"
            @click="$emit('select', option.value)"
          >
            <div class="type-icon">
              {{ getReportTypeIcon(option.value) }}
            </div>
            <div class="type-info">
              <div class="type-name">
                {{ option.label }}
              </div>
              <div class="type-desc">
                {{ option.description }}
              </div>
            </div>
            <div
              v-if="getTypeBadgeClass(option.value) === 'enterprise'"
              class="type-badge"
            >
              Enterprise
            </div>
          </div>
        </div>
      </div>
    </div>
    <div
      v-if="error"
      class="error-message"
    >
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ReportsAPI from '@/api/reports';
import type { ReportType } from '@/types/reports';

interface Props {
  selectedType: ReportType | null;
  error?: string;
}

defineProps<Props>();

defineEmits<{
  select: [type: ReportType];
}>();

// Grouped report types for the selector grid
const groupedReportTypes = computed(() => {
  const types = ReportsAPI.getAvailableReportTypes() || [];

  return [
    {
      category: 'basic',
      title: '基礎報表',
      types: types.filter(t => ['conversation_summary', 'agent_performance', 'team_analytics', 'customer_satisfaction', 'platform_usage', 'message_statistics', 'response_time_analysis', 'workload_distribution', 'system_health', 'custom'].includes(t.value))
    },
    {
      category: 'enterprise',
      title: '企業級報表',
      types: types.filter(t => ['cost_analysis', 'sla_compliance', 'anomaly_detection', 'audit_trail', 'resource_utilization'].includes(t.value))
    },
    {
      category: 'business_intelligence',
      title: '商業智能',
      types: types.filter(t => ['trend_forecast', 'customer_insights', 'channel_integration', 'goal_achievement', 'automation_effectiveness'].includes(t.value))
    },
    {
      category: 'advanced_analytics',
      title: '高級分析',
      types: types.filter(t => ['security_risk', 'knowledge_base', 'call_quality', 'executive_summary'].includes(t.value))
    }
  ];
});

// Icon mapping for report types
const getReportTypeIcon = (type: ReportType): string => {
  const iconMap: Record<ReportType, string> = {
    'conversation_summary': '\uD83D\uDCAC',
    'agent_performance': '\uD83D\uDC64',
    'team_analytics': '\uD83D\uDC65',
    'customer_satisfaction': '\uD83D\uDE0A',
    'platform_usage': '\uD83D\uDCF1',
    'message_statistics': '\uD83D\uDCCA',
    'response_time_analysis': '\u23F1\uFE0F',
    'workload_distribution': '\u2696\uFE0F',
    'system_health': '\uD83C\uDFE5',
    'custom': '\uD83D\uDD27',
    'cost_analysis': '\uD83D\uDCB0',
    'sla_compliance': '\u2696\uFE0F',
    'anomaly_detection': '\uD83D\uDEA8',
    'audit_trail': '\uD83D\uDCCB',
    'resource_utilization': '\u26A1',
    'trend_forecast': '\uD83D\uDCC8',
    'customer_insights': '\uD83D\uDCA1',
    'channel_integration': '\uD83C\uDF10',
    'goal_achievement': '\uD83C\uDFAF',
    'automation_effectiveness': '\uD83E\uDD16',
    'security_risk': '\uD83D\uDD12',
    'knowledge_base': '\uD83D\uDCDA',
    'call_quality': '\uD83D\uDCDE',
    'executive_summary': '\uD83D\uDCBC'
  };
  return iconMap[type] || '\uD83D\uDCCA';
};

// Badge classification for report types
const getTypeBadgeClass = (type: ReportType): string => {
  if (['cost_analysis', 'sla_compliance', 'anomaly_detection', 'audit_trail', 'resource_utilization'].includes(type)) {
    return 'enterprise';
  }
  if (['trend_forecast', 'customer_insights', 'channel_integration', 'goal_achievement', 'automation_effectiveness'].includes(type)) {
    return 'business-intelligence';
  }
  if (['security_risk', 'knowledge_base', 'call_quality', 'executive_summary'].includes(type)) {
    return 'advanced';
  }
  return 'basic';
};

// Expose for parent usage
defineExpose({ getReportTypeIcon });
</script>

<style scoped>
.form-group {
  margin-bottom: 1.5rem;
}

.form-label {
  display: block;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.5rem;
}

.form-label.required::after {
  content: ' *';
  color: #ef4444;
}

.report-type-grid {
  margin-top: 1rem;
}

.type-category {
  margin-bottom: 2rem;
}

.category-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.type-options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.type-option {
  display: flex;
  align-items: center;
  padding: 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.type-option:hover {
  border-color: #3b82f6;
  background-color: #f8fafc;
}

.type-option.selected {
  border-color: #3b82f6;
  background-color: #eff6ff;
}

.type-icon {
  font-size: 1.5rem;
  margin-right: 0.75rem;
}

.type-info {
  flex: 1;
}

.type-name {
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.25rem;
}

.type-desc {
  font-size: 0.9rem;
  color: #6b7280;
}

.type-badge {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.error-message {
  color: #ef4444;
  font-size: 0.9rem;
  margin-top: 0.25rem;
}

@media (max-width: 1024px) {
  .type-options {
    grid-template-columns: 1fr;
  }
}
</style>
