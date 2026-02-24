<template>
  <div class="stats-overview">
    <div class="stats-grid">
      <!-- Total Tags -->
      <div class="stat-card tags">
        <div class="stat-content">
          <div class="stat-number">
            {{ stats.totalTags }}
          </div>
          <div class="stat-label">
            標籤總數
          </div>
        </div>
        <div class="stat-icon">
          <TagIcon />
        </div>
      </div>

      <!-- Total Conversations -->
      <div class="stat-card conversations">
        <div class="stat-content">
          <div class="stat-number">
            {{ stats.totalConversations }}
          </div>
          <div class="stat-label">
            標記對話數
          </div>
        </div>
        <div class="stat-icon">
          <MessageCircleIcon />
        </div>
      </div>

      <!-- Active Tags -->
      <div class="stat-card active">
        <div class="stat-content">
          <div class="stat-number">
            {{ stats.activeTags }}
          </div>
          <div class="stat-label">
            啟用標籤數
          </div>
        </div>
        <div class="stat-icon">
          <CheckCircleIcon />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { TagIcon, MessageCircleIcon, CheckCircleIcon } from '@/components/icons'

defineProps<{
  stats: {
    totalTags: number
    totalConversations: number
    activeTags: number
  }
}>()
</script>

<style scoped>
/* Stats Overview */
.stats-overview {
  margin-bottom: var(--space-12);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(clamp(240px, 20vw, 300px), 1fr));
  gap: clamp(1rem, 2vw, 2rem);
}

.stat-card {
  background: white;
  border-radius: var(--radius-2xl);
  padding: var(--space-8);
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
  border: 1px solid var(--gray-100);
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all var(--transition-fast);
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: var(--gray-200);
  transition: background-color var(--transition-fast);
}

.stat-card.tags::before {
  background: linear-gradient(180deg, #3b82f6, #2563eb);
}

.stat-card.conversations::before {
  background: linear-gradient(180deg, #8b5cf6, #7c3aed);
}

.stat-card.active::before {
  background: linear-gradient(180deg, #f59e0b, #d97706);
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
}

.stat-content {
  flex: 1;
}

.stat-number {
  font-size: 2.5rem;
  font-weight: 800;
  color: var(--gray-900);
  margin-bottom: var(--space-1);
  line-height: 1;
}

.stat-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--gray-600);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-xl);
  background: var(--gray-50);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--gray-600);
  flex-shrink: 0;
  transition: all var(--transition-fast);
}

.stat-card.tags .stat-icon {
  background: rgba(59, 130, 246, 0.1);
  color: var(--blue-600);
}

.stat-card.conversations .stat-icon {
  background: rgba(139, 92, 246, 0.1);
  color: var(--purple-600);
}

.stat-card.active .stat-icon {
  background: rgba(245, 158, 11, 0.1);
  color: var(--yellow-600);
}

.stat-icon svg {
  width: 28px;
  height: 28px;
}

/* Responsive Design */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .stat-card {
    padding: var(--space-6);
  }

  .stat-number {
    font-size: 2rem;
  }

  .stat-icon {
    width: 48px;
    height: 48px;
  }

  .stat-icon svg {
    width: 24px;
    height: 24px;
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
