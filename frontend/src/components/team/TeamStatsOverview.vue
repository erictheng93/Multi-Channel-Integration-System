<template>
  <div class="stats-overview">
    <div class="stats-grid">
      <!-- 总成员数 -->
      <div class="stat-card members">
        <div class="stat-content">
          <div class="stat-number">
            {{ stats.totalMembers }}
          </div>
          <div class="stat-label">
            總成員數
          </div>
        </div>
        <div class="stat-icon">
          <UsersIcon />
        </div>
      </div>

      <!-- 团队数量 -->
      <div class="stat-card active">
        <div class="stat-content">
          <div class="stat-number">
            {{ stats.teamCount }}
          </div>
          <div class="stat-label">
            現存團隊數量
          </div>
        </div>
        <div class="stat-icon">
          <TeamsIcon />
        </div>
      </div>

      <!-- 管理员人数 -->
      <div class="stat-card admins">
        <div class="stat-content">
          <div class="stat-number">
            {{ stats.adminCount }}
          </div>
          <div class="stat-label">
            管理員人數
          </div>
        </div>
        <div class="stat-icon">
          <ShieldIcon />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TeamStatsData } from '@/composables/team-management'
import UsersIcon from '@/components/icons/UsersIcon.vue'
import TeamsIcon from '@/components/icons/TeamsIcon.vue'
import ShieldIcon from '@/components/icons/ShieldIcon.vue'

interface Props {
  stats: TeamStatsData
}

defineProps<Props>()
</script>

<style scoped>
.stats-overview {
  margin-bottom: 2rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.stat-card.members {
  border-color: rgba(59, 130, 246, 0.2);
}

.stat-card.members:hover {
  border-color: rgba(59, 130, 246, 0.4);
}

.stat-card.active {
  border-color: rgba(16, 185, 129, 0.2);
}

.stat-card.active:hover {
  border-color: rgba(16, 185, 129, 0.4);
}

.stat-card.admins {
  border-color: rgba(245, 158, 11, 0.2);
}

.stat-card.admins:hover {
  border-color: rgba(245, 158, 11, 0.4);
}

.stat-content {
  flex: 1;
}

.stat-number {
  font-size: 2.5rem;
  font-weight: 700;
  color: #1f2937;
  line-height: 1;
  margin-bottom: 0.5rem;
}

.stat-label {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.stat-icon {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;
  margin-left: 1rem;
}

.stat-card.members .stat-icon {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.stat-card.active .stat-icon {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.stat-card.admins .stat-icon {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .stat-number {
    font-size: 2rem;
  }

  .stat-icon {
    width: 48px;
    height: 48px;
  }
}
</style>
