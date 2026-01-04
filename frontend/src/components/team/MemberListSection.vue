<template>
  <div class="content-section">
    <!-- Header -->
    <div class="content-header">
      <h2 class="content-title">
        <UsersIcon />
        人員管理 Staff Management ({{ members.length }})
      </h2>
      <div class="header-actions">
        <PrimaryActionButton
          text="新增成員"
          :icon="PlusIcon"
          :loading="loading"
          @click="emit('add-member')"
        />
      </div>
    </div>

    <!-- Content Body -->
    <div class="content-body">
      <!-- Loading State -->
      <HamsterLoader
        v-if="loading"
        message="載入成員中..."
      />

      <!-- Empty State -->
      <EmptyState
        v-else-if="members.length === 0"
        title="尚無系統人員"
        description="新增第一位成員到您的團隊"
      >
        <template #icon>
          <UsersIcon />
        </template>
        <template #actions>
          <button
            class="btn btn-primary"
            @click="emit('add-member')"
          >
            新增成員
          </button>
        </template>
      </EmptyState>

      <!-- Members List -->
      <div
        v-else
        class="members-list"
      >
        <TeamMemberCard
          v-for="member in members"
          :key="member.id"
          :member="member"
          :current-user-id="currentUserId"
          :loading="loading"
          @update-role="(memberId: string, role: string) => emit('update-role', memberId, role)"
          @toggle-status="(member) => emit('toggle-status', member)"
          @reset-password="(member) => emit('reset-password', member)"
          @remove-member="(member) => emit('remove-member', member)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TeamMember } from '@/types'
import HamsterLoader from '@/components/ui/HamsterLoader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import TeamMemberCard from '@/components/team/TeamMemberCard.vue'
import PrimaryActionButton from '@/components/ui/PrimaryActionButton.vue'
import UsersIcon from '@/components/icons/UsersIcon.vue'
import PlusIcon from '@/components/icons/PlusIcon.vue'

interface Props {
  members: TeamMember[]
  loading: boolean
  currentUserId?: string
}

interface Emits {
  (_e: 'add-member'): void
  (_e: 'update-role', _memberId: string, _role: string): void
  (_e: 'toggle-status', _member: TeamMember): void
  (_e: 'reset-password', _member: TeamMember): void
  (_e: 'remove-member', _member: TeamMember): void
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
  color: #6366f1;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
}

.content-body {
  min-height: 200px;
}

.members-list {
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
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
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
