<template>
  <div class="stats-grid">
    <div
      class="stat-card healthy clickable"
      @click="$emit('stat-click', 'healthy')"
    >
      <div class="stat-content">
        <div class="stat-number">
          {{ stats.healthyCount }}
        </div>
        <div class="stat-label">
          正常端點
        </div>
      </div>
      <div class="stat-icon healthy-icon">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22,4 12,14.01 9,11.01" />
        </svg>
      </div>
    </div>

    <div
      class="stat-card warning clickable"
      @click="$emit('stat-click', 'warning')"
    >
      <div class="stat-content">
        <div class="stat-number">
          {{ stats.warningCount }}
        </div>
        <div class="stat-label">
          警告端點
        </div>
      </div>
      <div class="stat-icon warning-icon">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <path d="M12 9v4" />
          <path d="m12 17 .01 0" />
        </svg>
      </div>
    </div>

    <div
      class="stat-card error clickable"
      @click="$emit('stat-click', 'error')"
    >
      <div class="stat-content">
        <div class="stat-number">
          {{ stats.errorCount }}
        </div>
        <div class="stat-label">
          錯誤端點
        </div>
      </div>
      <div class="stat-icon error-icon">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
          />
          <path d="m15 9-6 6" />
          <path d="m9 9 6 6" />
        </svg>
      </div>
    </div>

    <div
      class="stat-card total clickable"
      @click="$emit('stat-click', 'all')"
    >
      <div class="stat-content">
        <div class="stat-number">
          {{ stats.totalEndpoints }}
        </div>
        <div class="stat-label">
          總端點數
        </div>
      </div>
      <div class="stat-icon total-icon">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M3 3v18h18" />
          <path d="M7 12h10" />
          <path d="M7 8h7" />
          <path d="M7 16h6" />
        </svg>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ApiStatistics } from '@/types/api-monitor'

interface Props {
  stats: ApiStatistics
}

interface Emits {
  (_e: 'stat-click', _type: 'all' | 'healthy' | 'warning' | 'error'): void
}

defineProps<Props>()
defineEmits<Emits>()
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  border-radius: 16px 16px 0 0;
  transition: all 0.3s;
}

.stat-card.healthy::before {
  background: linear-gradient(90deg, #22c55e, #16a34a);
}

.stat-card.warning::before {
  background: linear-gradient(90deg, #f59e0b, #d97706);
}

.stat-card.error::before {
  background: linear-gradient(90deg, #ef4444, #dc2626);
}

.stat-card.total::before {
  background: linear-gradient(90deg, #3b82f6, #2563eb);
}

.stat-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.12);
}

.stat-content {
  flex: 1;
}

.stat-number {
  font-size: 3rem;
  font-weight: 800;
  margin-bottom: 0.5rem;
}

.stat-card.healthy .stat-number {
  background: linear-gradient(135deg, #22c55e, #16a34a);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-card.warning .stat-number {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-card.error .stat-number {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-card.total .stat-number {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-label {
  font-size: 1rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-icon {
  width: 80px;
  height: 80px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.3s;
}

.healthy-icon {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(22, 163, 74, 0.15));
  color: #16a34a;
}

.warning-icon {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(217, 119, 6, 0.15));
  color: #d97706;
}

.error-icon {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.15));
  color: #dc2626;
}

.total-icon {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(37, 99, 235, 0.15));
  color: #2563eb;
}

/* Responsive */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  .stat-card {
    padding: 1.5rem;
  }

  .stat-number {
    font-size: 2rem;
  }

  .stat-icon {
    width: 60px;
    height: 60px;
  }

  .stat-icon svg {
    width: 36px;
    height: 36px;
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}

/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  .stat-card {
    transition: none !important;
  }

  .stat-card:hover {
    transform: none !important;
  }
}
</style>
