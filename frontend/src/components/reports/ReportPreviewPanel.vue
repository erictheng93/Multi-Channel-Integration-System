<template>
  <div class="preview-section">
    <!-- 報表預覽卡片 -->
    <div
      v-if="reportType"
      class="preview-card"
    >
      <div class="preview-header">
        <h3 class="preview-title">
          報表預覽
        </h3>
      </div>
      <div class="preview-content">
        <div class="preview-item">
          <span class="preview-label">類型：</span>
          <span class="preview-value">{{ reportTypeLabel }}</span>
        </div>
        <div
          v-if="title"
          class="preview-item"
        >
          <span class="preview-label">標題：</span>
          <span class="preview-value">{{ title }}</span>
        </div>
        <div class="preview-item">
          <span class="preview-label">格式：</span>
          <span class="preview-value">{{ formatLabel }}</span>
        </div>
        <div
          v-if="timeRange"
          class="preview-item"
        >
          <span class="preview-label">時間範圍：</span>
          <span class="preview-value">{{ timeRangeLabel }}</span>
        </div>
        <div
          v-if="estimatedTime"
          class="preview-item"
        >
          <span class="preview-label">預估時間：</span>
          <span class="preview-value">{{ estimatedTime }} 秒</span>
        </div>
      </div>
    </div>

    <!-- 生成進度 -->
    <div
      v-if="isGenerating"
      class="progress-card"
    >
      <div class="progress-header">
        <h3 class="progress-title">
          生成進度
        </h3>
      </div>
      <div class="progress-content">
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: `${progress}%` }"
          />
        </div>
        <div class="progress-text">
          {{ progress }}% 完成
        </div>
        <div
          v-if="currentStep"
          class="progress-status"
        >
          {{ currentStep }}
        </div>
      </div>
    </div>

    <!-- 最近生成的報表 -->
    <div
      v-if="recentReports.length > 0"
      class="recent-reports"
    >
      <div class="recent-header">
        <h3 class="recent-title">
          最近的報表
        </h3>
      </div>
      <div class="recent-list">
        <div
          v-for="report in recentReports.slice(0, 3)"
          :key="report.id"
          class="recent-item"
          @click="$emit('view-report', report.id)"
        >
          <div class="recent-icon">
            {{ getReportTypeIcon(report.type) }}
          </div>
          <div class="recent-info">
            <div class="recent-name">
              {{ report.title }}
            </div>
            <div class="recent-meta">
              {{ formatDate(report.createdAt) }}
            </div>
          </div>
          <div class="recent-status">
            {{ getStatusIcon(report.status) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ReportsAPI from '@/api/reports';
import type {
  ReportType,
  ReportFormat,
  ReportTimeRange,
  ReportBase
} from '@/types/reports';

interface Props {
  reportType: ReportType | null;
  title: string;
  format: ReportFormat;
  timeRange: ReportTimeRange | '';
  isGenerating: boolean;
  progress: number;
  currentStep: string;
  recentReports: ReportBase[];
}

const props = defineProps<Props>();

defineEmits<{
  'view-report': [reportId: string];
}>();

// Computed labels
const reportTypeLabel = computed(() => {
  if (!props.reportType) {
    return '';
  }
  return ReportsAPI.formatReportType(props.reportType);
});

const formatLabel = computed(() => {
  const formats = ReportsAPI.getAvailableFormats() || [];
  const found = formats.find(f => f.value === props.format);
  return found?.label || props.format;
});

const timeRangeLabel = computed(() => {
  const ranges = ReportsAPI.getTimeRangeOptions() || [];
  const found = ranges.find(r => r.value === props.timeRange);
  return found?.label || props.timeRange;
});

const estimatedTime = computed(() => {
  if (!props.reportType) {
    return null;
  }

  const typeMap: Record<ReportType, number> = {
    'conversation_summary': 30,
    'agent_performance': 45,
    'team_analytics': 60,
    'customer_satisfaction': 40,
    'platform_usage': 25,
    'message_statistics': 35,
    'response_time_analysis': 50,
    'workload_distribution': 40,
    'system_health': 20,
    'custom': 120,
    'cost_analysis': 90,
    'sla_compliance': 75,
    'anomaly_detection': 120,
    'audit_trail': 100,
    'resource_utilization': 80,
    'trend_forecast': 150,
    'customer_insights': 135,
    'channel_integration': 110,
    'goal_achievement': 95,
    'automation_effectiveness': 125,
    'security_risk': 180,
    'knowledge_base': 105,
    'call_quality': 140,
    'executive_summary': 200
  };

  return typeMap[props.reportType] || 60;
});

// Helper methods
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

const getStatusIcon = (status: string): string => {
  const statusMap: Record<string, string> = {
    'pending': '\u23F3',
    'generating': '\u2699\uFE0F',
    'completed': '\u2705',
    'failed': '\u274C',
    'expired': '\u23F0'
  };
  return statusMap[status] || '\u2753';
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('zh-TW');
};
</script>

<style scoped>
.preview-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.preview-card,
.progress-card,
.recent-reports {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.preview-header,
.progress-header,
.recent-header {
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.preview-title,
.progress-title,
.recent-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.preview-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.preview-label {
  font-weight: 500;
  color: #6b7280;
}

.preview-value {
  font-weight: 600;
  color: #1f2937;
  text-align: right;
  flex: 1;
  margin-left: 1rem;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background-color: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #1d4ed8);
  transition: width 0.3s ease;
}

.progress-text {
  text-align: center;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.progress-status {
  text-align: center;
  color: #6b7280;
  font-style: italic;
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.recent-item {
  display: flex;
  align-items: center;
  padding: 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.recent-item:hover {
  border-color: #3b82f6;
  background-color: #f8fafc;
}

.recent-icon {
  font-size: 1.25rem;
  margin-right: 0.75rem;
}

.recent-info {
  flex: 1;
}

.recent-name {
  font-weight: 500;
  color: #1f2937;
  margin-bottom: 0.25rem;
}

.recent-meta {
  font-size: 0.9rem;
  color: #6b7280;
}

.recent-status {
  font-size: 1.1rem;
}
</style>
