<template>
  <div class="content-section">
    <!-- Header -->
    <div class="content-header">
      <h2 class="content-title">
        <TeamsIcon />
        團隊設置 Team Settings ({{ teams.length }})
      </h2>
      <div class="header-actions">
        <PrimaryActionButton
          text="新增團隊"
          :icon="PlusIcon"
          :loading="loading"
          @click="emit('add-team')"
        />
      </div>
    </div>

    <!-- Content Body -->
    <div class="content-body">
      <!-- Loading State -->
      <HamsterLoader
        v-if="loading"
        message="載入團隊中..."
      />

      <!-- Empty State -->
      <EmptyState
        v-else-if="teams.length === 0"
        title="尚無團隊"
        description="建立第一個團隊來管理客服人員"
      >
        <template #icon>
          <TeamsIcon />
        </template>
        <template #actions>
          <button
            class="btn btn-primary"
            @click="emit('add-team')"
          >
            新增團隊
          </button>
        </template>
      </EmptyState>

      <!-- Teams List -->
      <div
        v-else
        class="teams-list"
      >
        <TeamCard
          v-for="team in teams"
          :key="team.id"
          :team="team"
          :loading="loading"
          @toggle-status="(team) => emit('toggle-status', team)"
          @remove-team="(team) => emit('remove-team', team)"
          @member-updated="emit('member-updated')"
          @team-updated="emit('team-updated')"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Team } from '@/composables/team-management'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import TeamCard from '@/components/team/TeamCard.vue'
import PrimaryActionButton from '@/components/ui/PrimaryActionButton.vue'
import TeamsIcon from '@/components/icons/TeamsIcon.vue'
import PlusIcon from '@/components/icons/PlusIcon.vue'

interface Props {
  teams: Team[]
  loading: boolean
}

interface Emits {
  (_e: 'add-team'): void
  (_e: 'toggle-status', _team: Team): void
  (_e: 'remove-team', _team: Team): void
  (_e: 'member-updated'): void
  (_e: 'team-updated'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()
</script>

<style scoped>
.content-section {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.content-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.content-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0;
}

.content-title svg {
  width: 24px;
  height: 24px;
  color: #10b981;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
}

.content-body {
  min-height: 200px;
}

.teams-list {
  display: grid;
  gap: 1rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

@media (max-width: 768px) {
  .content-section {
    padding: 1.5rem;
  }

  .content-header {
    flex-direction: column;
    align-items: stretch;
  }

  .content-title {
    font-size: 1.25rem;
  }
}
</style>
