<template>
  <div class="members-grid">
    <div
      v-for="member in members"
      :key="member.id"
      class="member-item"
      :class="{
        'selection-mode': isSelectionMode,
        'selected': isSelectionMode && selectedMemberIds.has(member.id)
      }"
      @click="handleItemClick(member)"
    >
      <!-- 🆕 Selection Checkbox (shown in selection mode) -->
      <div
        v-if="isSelectionMode"
        class="selection-checkbox"
        @click.stop="$emit('toggle-selection', member.id)"
      >
        <input
          type="checkbox"
          :checked="selectedMemberIds.has(member.id)"
          class="checkbox-input"
          @click.stop="$emit('toggle-selection', member.id)"
        >
      </div>

      <!-- Member Avatar -->
      <div class="member-avatar">
        {{ getInitials(member) }}
      </div>

      <!-- Member Info -->
      <div class="member-info">
        <span class="member-name">{{ member.name || member.loginId }}</span>
        <span class="member-role">{{ getRoleDisplayName(member.role) }}</span>
      </div>

      <!-- Remove Button (hidden in selection mode) -->
      <button
        v-if="!isSelectionMode"
        class="btn-remove"
        :disabled="removingMemberId === member.id"
        title="從團隊移除"
        @click.stop="$emit('remove-member', member)"
      >
        {{ removingMemberId === member.id ? '移除中...' : '✕' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * MemberGrid Component
 *
 * Extracted from TeamCard.vue (lines 186-211, 1460-1553)
 * Displays team members in a responsive grid layout
 *
 * Features:
 * - Avatar with initials
 * - Member name and role display
 * - Remove button with loading state
 * - 🆕 Selection mode with checkboxes
 * - 🆕 Visual feedback for selected items
 * - Responsive grid layout
 */

import type { TeamMember } from '@/types'

interface Props {
  /** List of team members to display */
  members: TeamMember[]

  /** ID of member currently being removed (for loading state) */
  removingMemberId: string | null

  /** 🆕 Whether selection mode is active */
  isSelectionMode?: boolean

  /** 🆕 Set of selected member IDs */
  selectedMemberIds?: Set<string>
}

interface Emits {
  /** Emitted when remove button is clicked */
  (_e: 'remove-member', _member: TeamMember): void

  /** 🆕 Emitted when member selection is toggled */
  (_e: 'toggle-selection', _memberId: string): void
}

const props = withDefaults(defineProps<Props>(), {
  isSelectionMode: false,
  selectedMemberIds: () => new Set()
})

const emit = defineEmits<Emits>()

/**
 * Handle item click
 * In selection mode: toggle selection
 * Normal mode: no action (remove button handles removal)
 */
const handleItemClick = (member: TeamMember) => {
  if (props.isSelectionMode) {
    emit('toggle-selection', member.id)
  }
}

/**
 * Get initials from member name or loginId
 * Handles single names, full names, and fallback cases
 */
const getInitials = (member: TeamMember): string => {
  const name = member.name || member.loginId
  if (!name) {
    return '?'
  }

  const names = name.split(' ').filter(n => n.trim())
  if (names.length === 0) {
    return '?'
  }

  if (names.length === 1) {
    const firstName = names[0]
    return firstName ? firstName.charAt(0).toUpperCase() : '?'
  }

  const firstName = names[0]
  const lastName = names[names.length - 1]
  return firstName && lastName ? (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() : '?'
}

/**
 * Get display name for role
 */
const getRoleDisplayName = (role: string): string => {
  const roleMap: Record<string, string> = {
    admin: '管理員',
    team: '組長',
    agent: '客服'
  }
  return roleMap[role] || role
}
</script>

<style scoped>
.members-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.member-item:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
}

/* 🆕 Selection Mode Styles */
.member-item.selection-mode {
  cursor: pointer;
}

.member-item.selection-mode:hover:not(.selected) {
  background: #eef2ff;
  border-color: #c7d2fe;
}

.member-item.selected {
  background: #eef2ff;
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.member-item.selected:hover {
  background: #e0e7ff;
}

/* 🆕 Selection Checkbox */
.selection-checkbox {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.checkbox-input {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 2px solid #d1d5db;
  cursor: pointer;
  transition: all 0.2s ease;
  accent-color: #6366f1;
}

.checkbox-input:checked {
  border-color: #6366f1;
}

.checkbox-input:hover {
  border-color: #6366f1;
}

.member-avatar {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 1rem;
  flex-shrink: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.member-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.member-name {
  color: #1e293b;
  font-size: 1.125rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.member-role {
  color: #64748b;
  font-size: 0.875rem;
  font-weight: 500;
}

.btn-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid #fecaca;
  background: #fee2e2;
  color: #991b1b;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 1rem;
  font-weight: 600;
  flex-shrink: 0;
}

.btn-remove:hover:not(:disabled) {
  background: #fecaca;
  border-color: #ef4444;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2);
}

.btn-remove:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  font-size: 0.75rem;
}

/* ============================================
   Responsive - RWD
   ============================================ */

/* Tablet */
@media (max-width: 768px) {
  .members-grid {
    grid-template-columns: 1fr;
  }
}

/* Mobile - already single column, just adjust spacing */
@media (max-width: 640px) {
  .member-item {
    padding: 16px;
  }
}
</style>
