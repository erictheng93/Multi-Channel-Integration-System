<template>
  <div
    class="metric-comparison"
    :class="[
      `trend-${data.trend}`,
      { 'clickable': expandable, 'expanded': isExpanded }
    ]"
    @click="handleClick"
  >
    <!-- 主要數值顯示 -->
    <div class="metric-header">
      <div class="metric-label">
        {{ label }}
      </div>
      <div class="metric-value">
        {{ formatValue(data.current) }}
      </div>
    </div>

    <!-- 變化指標 -->
    <div class="metric-change">
      <div
        class="change-indicator"
        :class="`indicator-${data.trend}`"
      >
        <span class="trend-icon">{{ trendIcon }}</span>
        <span
          class="change-percentage"
          :class="`text-${data.trend}`"
        >
          {{ Math.abs(data.changePercentage).toFixed(2) }}%
        </span>
        <span class="change-absolute">
          ({{ formatChange(data.change) }})
        </span>
      </div>

      <!-- Tooltip -->
      <div
        v-if="showTooltip"
        class="metric-tooltip"
      >
        <div class="tooltip-content">
          <div class="tooltip-row">
            <span class="tooltip-label">當前期間:</span>
            <span class="tooltip-value">{{ formatValue(data.current) }}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">上一期間:</span>
            <span class="tooltip-value">{{ formatValue(data.previous) }}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">變化:</span>
            <span
              class="tooltip-value"
              :class="`text-${data.trend}`"
            >
              {{ formatChange(data.change) }} ({{ data.changePercentage.toFixed(2) }}%)
            </span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">趨勢:</span>
            <span class="tooltip-value">{{ trendText }}</span>
          </div>
          <div
            v-if="data.period"
            class="tooltip-periods"
          >
            <div class="period-info">
              <span class="period-label">當前:</span>
              <span class="period-dates">
                {{ formatDate(data.period.current.start) }} - {{ formatDate(data.period.current.end) }}
              </span>
            </div>
            <div class="period-info">
              <span class="period-label">對比:</span>
              <span class="period-dates">
                {{ formatDate(data.period.previous.start) }} - {{ formatDate(data.period.previous.end) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 歷史趨勢展開區域 -->
    <transition name="expand">
      <div
        v-if="isExpanded && expandable"
        class="trend-history"
      >
        <div class="history-header">
          <span>歷史趨勢</span>
        </div>
        <div class="history-content">
          <slot name="history">
            <!-- 可以在這裡插入圖表或歷史數據 -->
            <div class="history-placeholder">
              <p>點擊可查看更多歷史數據</p>
            </div>
          </slot>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface Period {
  start: string;
  end: string;
  label?: string;
}

interface ComparisonData {
  current: number;
  previous: number;
  change: number;
  changePercentage: number;
  trend: 'up' | 'down' | 'stable';
  period: {
    current: Period;
    previous: Period;
  };
}

interface Props {
  label: string;
  data: ComparisonData;
  expandable?: boolean;
  showTooltip?: boolean;
  valueFormatter?: (_value: number) => string;
}

const props = withDefaults(defineProps<Props>(), {
  expandable: true,
  showTooltip: true,
  valueFormatter: (_value: number) => _value.toLocaleString()
});

const isExpanded = ref(false);

const trendIcon = computed(() => {
  switch (props.data.trend) {
    case 'up':
      return '';
    case 'down':
      return '';
    case 'stable':
      return '→';
    default:
      return '→';
  }
});

const trendText = computed(() => {
  switch (props.data.trend) {
    case 'up':
      return '上升趨勢';
    case 'down':
      return '下降趨勢';
    case 'stable':
      return '保持穩定';
    default:
      return '未知';
  }
});

function formatValue(value: number): string {
  if (props.valueFormatter) {
    return props.valueFormatter(value);
  }
  return value.toLocaleString();
}

function formatChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${formatValue(change)}`;
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
}

function handleClick() {
  if (props.expandable) {
    isExpanded.value = !isExpanded.value;
  }
}
</script>

<style scoped>
.metric-comparison {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  transition: all 0.2s ease;
  position: relative;
}

.metric-comparison.clickable {
  cursor: pointer;
}

.metric-comparison.clickable:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

/* 趨勢背景色 */
.metric-comparison.trend-up {
  border-left: 4px solid #10b981;
}

.metric-comparison.trend-down {
  border-left: 4px solid #ef4444;
}

.metric-comparison.trend-stable {
  border-left: 4px solid #6b7280;
}

/* 標頭 */
.metric-header {
  margin-bottom: 12px;
}

.metric-label {
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 8px;
  font-weight: 500;
}

.metric-value {
  font-size: 28px;
  font-weight: 700;
  color: #111827;
}

/* 變化指標 */
.metric-change {
  position: relative;
}

.change-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.trend-icon {
  font-size: 20px;
  font-weight: bold;
  display: inline-block;
  transform: translateY(1px);
}

.indicator-up .trend-icon {
  color: #10b981;
}

.indicator-down .trend-icon {
  color: #ef4444;
}

.indicator-stable .trend-icon {
  color: #6b7280;
}

.change-percentage {
  font-weight: 600;
  font-size: 16px;
}

.text-up {
  color: #10b981;
}

.text-down {
  color: #ef4444;
}

.text-stable {
  color: #6b7280;
}

.change-absolute {
  color: #9ca3af;
  font-size: 13px;
}

/* Tooltip */
.metric-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: #1f2937;
  color: white;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 13px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  z-index: 10;
  margin-bottom: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.metric-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: #1f2937;
}

.metric-comparison:hover .metric-tooltip {
  opacity: 1;
  pointer-events: auto;
}

.tooltip-row {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 6px;
}

.tooltip-row:last-child {
  margin-bottom: 0;
}

.tooltip-label {
  color: #9ca3af;
  font-weight: 500;
}

.tooltip-value {
  font-weight: 600;
}

.tooltip-periods {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #374151;
}

.period-info {
  display: flex;
  flex-direction: column;
  margin-bottom: 6px;
  font-size: 12px;
}

.period-info:last-child {
  margin-bottom: 0;
}

.period-label {
  color: #9ca3af;
  margin-bottom: 2px;
}

.period-dates {
  color: #d1d5db;
}

/* 歷史趨勢展開 */
.trend-history {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.history-header {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 12px;
}

.history-content {
  min-height: 100px;
}

.history-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100px;
  color: #9ca3af;
  font-size: 13px;
}

/* 展開動畫 */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}

.expand-enter-to,
.expand-leave-from {
  max-height: 500px;
  opacity: 1;
}

/* 響應式設計 */
@media (max-width: 768px) {
  .metric-value {
    font-size: 24px;
  }

  .change-percentage {
    font-size: 14px;
  }

  .metric-tooltip {
    position: fixed;
    left: 16px;
    right: 16px;
    transform: none;
    bottom: 16px;
  }

  .metric-tooltip::after {
    display: none;
  }
}
</style>