<!--
  TeamRoster.vue
  Signature of the team page: a roster board. One row per team, one column per team role
  (主管 / 組長 / 成員), every cell holds the people who hold that role in that team, lit by their live
  presence. Rows line up, so "who covers what, and who is online" reads across teams at a glance.
  Built only from loaded data: team members (teams[].roleInTeam), presence ids, open conversations per team.
  Phone: each team becomes a card whose roles are stacked rows (empty roles are left out).
-->
<template>
  <article
    class="ui-lead roster"
    aria-label="團隊陣容"
  >
    <header class="ro-head">
      <h2 class="ro-title">
        團隊陣容
      </h2>
      <div
        class="ro-online"
        :aria-busy="loading || undefined"
      >
        <template v-if="onlineCount !== null">
          <span
            class="ro-dot is-on"
            aria-hidden="true"
          /><b>{{ onlineCount }}</b> / {{ activeCount }} 位在線
        </template>
        <template v-else>
          目前無法取得在線狀態
        </template>
      </div>
    </header>

    <div
      class="ro-grid"
      :style="{ '--cols': cols }"
      role="table"
      aria-label="團隊與角色"
    >
      <div
        class="ro-cols"
        role="row"
      >
        <span
          class="ro-col-team"
          role="columnheader"
        >團隊</span>
        <span
          v-for="rank in ranks"
          :key="rank.key"
          class="ro-col"
          role="columnheader"
        >{{ rank.label }}</span>
        <span
          v-if="presenceAvailable"
          class="ro-col ro-col-live"
          role="columnheader"
        >在線</span>
      </div>

      <section
        v-for="lane in lanes"
        :key="lane.id"
        class="ro-lane"
        role="row"
        :style="{ '--lane': teamToneColor(lane.id) }"
      >
        <div
          class="ro-team"
          role="rowheader"
        >
          <div class="ro-team-name">
            <i
              class="ro-swatch"
              aria-hidden="true"
            />{{ lane.name }}
          </div>
          <div class="ro-team-sub">
            <template v-if="lane.online !== null">
              <b>{{ lane.online }}</b> / {{ lane.total }} 在線
            </template>
            <template v-else>
              {{ lane.total }} 位成員
            </template>
            <template v-if="lane.open !== null">
              · {{ lane.open }} 件處理中
            </template>
          </div>
          <p
            v-if="lane.description"
            class="ro-team-desc"
          >
            {{ lane.description }}
          </p>
        </div>
        <div
          v-for="rank in ranks"
          :key="rank.key"
          class="ro-cell"
          :class="{ 'is-members': rank.key === 'member' }"
          role="cell"
        >
          <span class="ro-cell-label">{{ rank.label }}</span>
          <div
            v-if="rank.key === 'member' && lane.byRank[rank.key].length > 0"
            class="ro-crew"
          >
            <ul class="ro-stack">
              <li
                v-for="person in lane.byRank[rank.key].slice(0, STACK_MAX)"
                :key="person.id"
                :title="person.name"
              >
                <TeamAvatar
                  :name="person.name"
                  :seed="person.id"
                  :src="person.avatar"
                  size="sm"
                />
                <span class="sr-only">{{ person.name }}</span>
              </li>
              <li
                v-if="lane.byRank[rank.key].length > STACK_MAX"
                class="ro-more"
              >
                +{{ lane.byRank[rank.key].length - STACK_MAX }}
              </li>
            </ul>
            <span class="ro-crew-n">
              <b>{{ lane.byRank[rank.key].length }}</b> 位成員<template v-if="memberOnline(lane.byRank[rank.key]) !== null"> · {{ memberOnline(lane.byRank[rank.key]) }} 在線</template>
            </span>
          </div>
          <ul
            v-else-if="lane.byRank[rank.key].length > 0"
            class="ro-people"
          >
            <li
              v-for="person in lane.byRank[rank.key]"
              :key="person.id"
              class="ro-person"
              :class="{ 'is-on': person.online }"
            >
              <TeamAvatar
                :name="person.name"
                :seed="person.id"
                :src="person.avatar"
                size="sm"
                :presence="person.online === null ? undefined : person.online ? 'online' : 'offline'"
              />
              <span class="ro-person-name">{{ person.name }}</span>
            </li>
          </ul>
          <span
            v-else
            class="ro-none"
          >尚未指派</span>
        </div>
        <div
          v-if="presenceAvailable"
          class="ro-live"
          role="cell"
          :aria-label="`${lane.online} / ${lane.total} 在線`"
        >
          <i
            v-for="(dot, i) in lane.dots"
            :key="i"
            :class="{ 'is-on': dot }"
            aria-hidden="true"
          />
        </div>
      </section>
    </div>

    <p
      v-if="sharedMembers.length > 0"
      class="ro-note"
    >
      {{ sharedMembers.join('、') }} 同時屬於多個團隊，各團隊分別計入
    </p>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TeamAvatar from '@/components/team/TeamAvatar.vue'
import { teamToneColor } from '@/utils/team-tone'
import type { Team, TeamMember } from '@/types'

type Rank = 'supervisor' | 'lead' | 'member'

const props = defineProps<{
  teams: Team[]
  members: TeamMember[]
  /** Online member ids; ignored when presence is unavailable */
  onlineIds: ReadonlySet<string>
  presenceAvailable: boolean
  /** Open conversations per team id; null until known */
  openByTeam: ReadonlyMap<number, number> | null
  loading?: boolean
}>()

/** Members are shown as a face stack (the member table below names everyone); leaders keep their names */
const STACK_MAX = 5

function memberOnline(people: ReadonlyArray<{ online: boolean | null }>): number | null {
  return props.presenceAvailable ? people.filter(p => p.online).length : null
}

const RANKS: ReadonlyArray<{ key: Rank, label: string }> = [
  { key: 'supervisor', label: '主管' },
  { key: 'lead', label: '組長' },
  { key: 'member', label: '成員' }
]

const active = computed(() => props.members.filter(m => m.status !== 'inactive'))

const onlineCount = computed<number | null>(() =>
  props.presenceAvailable ? active.value.filter(m => props.onlineIds.has(m.id)).length : null)
const activeCount = computed(() => active.value.length)

interface Person {
  id: string
  name: string
  avatar?: string
  online: boolean | null
}

const lanes = computed(() =>
  props.teams
    .map((team) => {
      const byRank: Record<Rank, Person[]> = { supervisor: [], lead: [], member: [] }
      for (const m of active.value) {
        const link = (m.teams ?? []).find(t => t.teamId === team.id)
        if (!link && m.primaryTeamId !== team.id) { continue }
        byRank[link?.roleInTeam ?? 'member'].push({
          id: m.id,
          name: m.name || m.loginId,
          avatar: m.avatar,
          online: props.presenceAvailable ? props.onlineIds.has(m.id) : null
        })
      }
      const everyone = [...byRank.supervisor, ...byRank.lead, ...byRank.member]
      return {
        id: team.id,
        name: team.name,
        description: team.description?.trim() ?? '',
        total: everyone.length,
        online: props.presenceAvailable ? everyone.filter(p => p.online).length : null,
        open: props.openByTeam ? (props.openByTeam.get(team.id) ?? 0) : null,
        byRank,
        /** One dot per person: lit when online, so a team's cover reads as a row of lights */
        dots: everyone.map(p => p.online === true).sort((a, b) => Number(b) - Number(a))
      }
    })
    .filter(lane => lane.total > 0))

/** Only roles somebody holds get a column */
const ranks = computed(() => RANKS.filter(rank => lanes.value.some(lane => lane.byRank[rank.key].length > 0)))
const cols = computed(() => [
  ...ranks.value.map(rank => (rank.key === 'member' ? 'minmax(0, 1.6fr)' : 'minmax(0, 1fr)')),
  ...(props.presenceAvailable ? ['minmax(88px, 0.6fr)'] : [])
].join(' '))

/** Active members in more than one team: the per-team counts can exceed the overall count */
const sharedMembers = computed(() =>
  active.value
    .filter(m => new Set((m.teams ?? []).map(t => t.teamId)).size > 1)
    .map(m => m.name || m.loginId))
</script>

<style scoped>
.roster {
  display: grid;
  gap: 14px;
  padding: 22px 28px 20px;
}

.ro-head {
  display: flex;
  gap: 12px;
  align-items: baseline;
  justify-content: space-between;
}

.ro-title {
  margin: 0;
  font: 600 19px / 1.3 var(--ui-font-display);
  letter-spacing: -0.015em;
}

.ro-online {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  font-size: 14px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.ro-online b {
  font: 600 17px var(--ui-font-display);
  color: var(--ui-ink);
}

.ro-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--ui-faint);
}

.ro-dot.is-on {
  background: var(--ui-green);
}

/* the matrix: team | 主管 | 組長 | 成員 */
.ro-grid {
  display: grid;
  gap: 10px;
}

.ro-cols,
.ro-lane {
  display: grid;
  grid-template-columns: var(--team-w, 280px) var(--cols);
  gap: 0 18px;
  align-items: center;
}

.ro-cols {
  padding: 0 20px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-muted);
}

.ro-lane {
  padding: 14px 20px;
  border-radius: var(--ui-r-inner);
  background: var(--ui-surface-2);
  box-shadow: inset 4px 0 0 var(--lane);
}

.ro-team-name {
  display: flex;
  gap: 8px;
  align-items: center;
  font: 600 16px / 1.3 var(--ui-font-display);
}

.ro-swatch {
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--lane);
}

.ro-team-sub {
  margin-top: 3px;
  font-size: 13px;
  color: var(--ui-muted);
  font-variant-numeric: tabular-nums;
}

.ro-team-sub b {
  color: var(--ui-ink);
}

.ro-team-desc {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--ui-muted);
}

.ro-cell {
  min-width: 0;
}

.ro-cell-label {
  display: none;
}

.ro-people {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ro-person {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  padding: 3px 12px 3px 3px;
  border-radius: 999px;
  background: var(--ui-surface);
  font-size: 14px;
  color: var(--ui-ink);
  white-space: nowrap;
}

/* online people are bolder; offline ones keep full ink so they never read as disabled (the dot carries presence) */
.ro-person.is-on {
  font-weight: 600;
}

.ro-crew {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  align-items: center;
}

.ro-stack {
  display: flex;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ro-stack li + li {
  margin-left: -3px;
}

.ro-live {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.ro-live i {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px var(--ui-field-edge);
}

.ro-live i.is-on {
  background: var(--ui-green);
  box-shadow: none;
}

.ro-stack :deep(.team-avatar.is-sm) {
  width: 32px;
  height: 32px;
  box-shadow: 0 0 0 2px var(--ui-surface-2);
}

.ro-more {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--ui-fill-strong);
  box-shadow: 0 0 0 2px var(--ui-surface-2);
  font-size: 13px;
  font-weight: 600;
  color: var(--ui-ink-2);
}

.ro-crew-n {
  font-size: 14px;
  color: var(--ui-ink-2);
  font-variant-numeric: tabular-nums;
}

.ro-crew-n b {
  color: var(--ui-ink);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* an unfilled role is a dashed capsule, not blank grey text */
.ro-none {
  display: inline-flex;
  padding: 4px 12px;
  border-radius: 999px;
  box-shadow: inset 0 0 0 1px var(--ui-sep-strong, var(--ui-faint));
  font-size: 13px;
  color: var(--ui-ink-2);
}

.ro-note {
  margin: 0;
  padding-left: 4px;
  font-size: 13px;
  color: var(--ui-muted);
}

@media (max-width: 1024px) {
  .roster {
    padding: 20px;
  }

  .ro-cols,
  .ro-lane {
    --team-w: 200px;

    grid-template-columns: var(--team-w) var(--cols);
    gap: 0 12px;
  }

  .ro-lane {
    padding: 12px 14px;
  }
}

/* phone: one card per team, roles stacked as labelled rows, empty roles left out */
@media (max-width: 768px) {
  .roster {
    padding: 18px 14px 16px;
  }

  .ro-head {
    padding: 0 4px;
  }

  .ro-cols,
  .ro-live {
    display: none;
  }

  .ro-lane {
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
    padding: 14px;
  }

  .ro-cell {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  /* an empty role is left out; the members row is the face stack, so the card never hides who is in the team */
  .ro-cell:has(.ro-none),
  .ro-note {
    display: none;
  }

  .ro-cell.is-members .ro-crew {
    padding-top: 2px;
  }

  .ro-cell-label {
    display: block;
    flex: none;
    width: 32px;
    padding-top: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--ui-muted);
  }
}
</style>
