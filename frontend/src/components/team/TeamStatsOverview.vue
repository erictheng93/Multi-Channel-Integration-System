<template>
  <section class="ui-grid ui-cols-3">
    <article class="ui-card ui-kpi">
      <div class="ui-kpi-top">
        <span
          class="ui-kpi-ico"
          style="background: var(--ui-accent-soft); color: var(--ui-accent)"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          ><circle
            cx="9"
            cy="8"
            r="4"
          /><path d="M2 21v-1a6 6 0 0 1 12 0v1M17 11a3 3 0 1 0 0-6M22 21v-1a5 5 0 0 0-4-4.9" /></svg>
        </span>總成員數
      </div>
      <div class="ui-kpi-value">
        {{ stats.totalMembers }}
      </div>
      <div class="ui-kpi-foot">
        {{ activeMembers }} 位啟用 · {{ inactiveMembers }} 位停用
      </div>
    </article>

    <article class="ui-card ui-kpi">
      <div class="ui-kpi-top">
        <span
          class="ui-kpi-ico"
          style="background: var(--ui-green-soft); color: var(--ui-green-ink)"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          ><rect
            x="3"
            y="3"
            width="7"
            height="7"
            rx="2"
          /><rect
            x="14"
            y="3"
            width="7"
            height="7"
            rx="2"
          /><rect
            x="3"
            y="14"
            width="7"
            height="7"
            rx="2"
          /><rect
            x="14"
            y="14"
            width="7"
            height="7"
            rx="2"
          /></svg>
        </span>啟用中團隊
      </div>
      <div class="ui-kpi-value">
        {{ stats.activeTeams }}
      </div>
      <div class="ui-kpi-foot">
        {{ teamsFoot }}
      </div>
    </article>

    <article class="ui-card ui-kpi">
      <div class="ui-kpi-top">
        <span
          class="ui-kpi-ico"
          style="background: var(--ui-orange-soft); color: var(--ui-orange-ink)"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          ><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6Z" /></svg>
        </span>管理員
      </div>
      <div class="ui-kpi-value">
        {{ stats.adminCount }}
      </div>
      <div class="ui-kpi-foot">
        其餘 {{ stats.agentCount }} 位為客服人員
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TeamStatsData } from '@/composables/team-management'
import type { Team, TeamMember } from '@/types'

interface Props {
  stats: TeamStatsData
  members?: TeamMember[]
  teams?: Team[]
}

const props = withDefaults(defineProps<Props>(), { members: () => [], teams: () => [] })

const activeMembers = computed(() => props.members.filter(m => m.status === 'active').length)
const inactiveMembers = computed(() => props.members.length - activeMembers.value)

/** "客服一組 5 人 · 業務支援 3 人" for the first two active teams, then "等 N 個團隊". */
const teamsFoot = computed(() => {
  const active = props.teams.filter(t => t.isActive)
  if (active.length === 0) {
    return props.teams.length > 0 ? '目前沒有啟用中的團隊' : '尚未建立團隊'
  }
  const shown = active.slice(0, 2).map(t => `${t.name} ${t.memberCount ?? 0} 人`).join(' · ')
  return active.length > 2 ? `${shown} 等 ${active.length} 個團隊` : shown
})
</script>
