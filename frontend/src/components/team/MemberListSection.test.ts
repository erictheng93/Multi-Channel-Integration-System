// Bulk delete acts on the selection, so 全選 must never reach members the team filter hides.
import { describe, it, expect } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import MemberListSection from './MemberListSection.vue'
import type { Team, TeamMember } from '@/types'

const member = (id: string, teamId: number) =>
  ({ id, name: id, primaryTeamId: teamId, teams: [{ teamId }] }) as unknown as TeamMember

const mountSection = () => shallowMount(MemberListSection, {
  props: {
    members: [member('a1', 1), member('a2', 1), member('b1', 2)],
    allTeams: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }] as unknown as Team[],
    loading: false,
    sortOptions: [],
    sortState: { field: 'name', order: 'asc' },
    currentSortLabel: '姓名',
    sortMode: 'auto',
    isSelectionMode: true
  } as never
})

const button = (wrapper: ReturnType<typeof mountSection>, label: string) => {
  const found = wrapper.findAll('button').find((b) => b.text().startsWith(label))
  if (!found) { throw new Error(`no button ${label}`) }
  return found
}

describe('MemberListSection select all', () => {
  it('selects only the members of the filtered team', async () => {
    const wrapper = mountSection()
    await button(wrapper, 'A').trigger('click')
    await button(wrapper, '全選').trigger('click')
    expect(wrapper.emitted('select-all')).toEqual([[['a1', 'a2']]])
  })

  it('selects every member when no filter is active', async () => {
    const wrapper = mountSection()
    await button(wrapper, '全選').trigger('click')
    expect(wrapper.emitted('select-all')).toEqual([[['a1', 'a2', 'b1']]])
  })
})
