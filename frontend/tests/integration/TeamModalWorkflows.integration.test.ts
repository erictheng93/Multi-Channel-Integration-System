/**
 * Team modal workflows: EditTeamModal and AddTeamModal are presentational.
 * They bind the parent-owned form object and emit events; the parent does
 * the API calls. These tests drive the real components through those
 * contracts (Modal is stubbed to render its slots inline).
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EditTeamModal from '@/components/team/EditTeamModal.vue'
import AddTeamModal from '@/components/team/AddTeamModal.vue'

const ModalStub = {
  template: '<div class="modal-stub"><slot /><slot name="footer" /></div>',
  props: ['show', 'title', 'size', 'closeOnOverlay'],
  emits: ['close']
}

const members = [
  { id: 'm1', name: 'John Doe', email: 'john@example.com', role: 'agent', isActive: true },
  { id: 'm2', name: 'Jane Smith', email: 'jane@example.com', role: 'agent', isActive: true }
]

const helpers = {
  getInitials: (name: string) => name.substring(0, 2),
  getRoleDisplayName: (role: string) => `role:${role}`
}

function mountEdit(overrides: Record<string, unknown> = {}) {
  const form = {
    id: 1,
    name: 'Engineering Team',
    description: 'Software development team',
    isActive: true,
    membersToAdd: [] as string[],
    ...((overrides.form as object) ?? {})
  }
  const wrapper = mount(EditTeamModal, {
    props: {
      visible: true,
      loading: false,
      currentMembers: [],
      availableMembers: [],
      isAllAvailableMembersSelected: false,
      ...helpers,
      ...overrides,
      form
    } as never,
    global: { stubs: { Modal: ModalStub } }
  })
  return { wrapper, form }
}

function mountAdd(overrides: Record<string, unknown> = {}) {
  const form = { name: '', description: '', selectedMembers: [] as string[], ...((overrides.form as object) ?? {}) }
  const wrapper = mount(AddTeamModal, {
    props: {
      visible: true,
      loading: false,
      availableMembers: members,
      isAllMembersSelected: false,
      ...helpers,
      ...overrides,
      form
    } as never,
    global: { stubs: { Modal: ModalStub } }
  })
  return { wrapper, form }
}

describe('EditTeamModal workflow', () => {
  it('pre-fills the form and writes edits back into the parent form object', async () => {
    const { wrapper, form } = mountEdit()

    const nameInput = wrapper.find('#edit-team-name')
    expect((nameInput.element as HTMLInputElement).value).toBe('Engineering Team')
    expect((wrapper.find('#edit-team-description').element as HTMLTextAreaElement).value).toBe(
      'Software development team'
    )

    await nameInput.setValue('Engineering Team - Updated')

    expect(form.name).toBe('Engineering Team - Updated')
  })

  it('emits submit once when the form is submitted', async () => {
    const { wrapper } = mountEdit()

    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('cancel emits close and does not submit', async () => {
    const { wrapper } = mountEdit()

    await wrapper.find('button.btn-secondary').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('disables the primary action while loading', () => {
    const { wrapper } = mountEdit({ loading: true })

    expect(wrapper.find('button.btn-primary').attributes('disabled')).toBeDefined()
  })

  it('lists current members and emits remove-member with the member id', async () => {
    const { wrapper } = mountEdit({ currentMembers: members })

    const cards = wrapper.findAll('.member-card')
    expect(cards).toHaveLength(2)
    expect(cards[0]?.text()).toContain('John Doe')
    expect(cards[0]?.text()).toContain('role:agent')

    await cards[1]?.find('.btn-remove-member').trigger('click')

    expect(wrapper.emitted('remove-member')).toEqual([['m2']])
  })

  it('shows the empty-state message when the team has no members', () => {
    const { wrapper } = mountEdit()

    expect(wrapper.find('.no-members-message').exists()).toBe(true)
    expect(wrapper.find('.member-card').exists()).toBe(false)
  })

  it('reflects selected additions and emits toggle events for available members', async () => {
    const { wrapper } = mountEdit({
      availableMembers: members,
      form: { membersToAdd: ['m1'] }
    })

    const boxes = wrapper.findAll('.member-checkbox-item input[type="checkbox"]')
    expect(boxes).toHaveLength(2)
    expect((boxes[0]?.element as HTMLInputElement).checked).toBe(true)
    expect((boxes[1]?.element as HTMLInputElement).checked).toBe(false)
    expect(wrapper.find('.selection-count').text()).toContain('1')

    await boxes[1]?.trigger('change')
    await wrapper.find('.select-all-section input[type="checkbox"]').trigger('change')

    expect(wrapper.emitted('toggle-available-member')).toEqual([['m2']])
    expect(wrapper.emitted('toggle-select-all')).toHaveLength(1)
  })
})

describe('AddTeamModal workflow', () => {
  it('writes name and description into the parent form and emits submit', async () => {
    const { wrapper, form } = mountAdd()

    await wrapper.find('#team-name').setValue('New Team')
    await wrapper.find('#team-description').setValue('New team description')
    await wrapper.find('form').trigger('submit')

    expect(form.name).toBe('New Team')
    expect(form.description).toBe('New team description')
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('marks the name field required so an empty team cannot be submitted natively', () => {
    const { wrapper } = mountAdd()

    expect(wrapper.find('#team-name').attributes('required')).toBeDefined()
  })

  it('shows the selection count and emits toggle-member with the member id', async () => {
    const { wrapper } = mountAdd({ form: { selectedMembers: ['m1'] } })

    expect(wrapper.find('.member-count').text()).toBe('(1 / 2)')
    const boxes = wrapper.findAll('.member-item input[type="checkbox"]')
    expect((boxes[0]?.element as HTMLInputElement).checked).toBe(true)

    await boxes[1]?.trigger('change')

    expect(wrapper.emitted('toggle-member')).toEqual([['m2']])
  })

  it('shows the empty message when there are no available members', () => {
    const { wrapper } = mountAdd({ availableMembers: [] })

    expect(wrapper.find('.no-members').exists()).toBe(true)
  })

  it('labels the primary button by loading state', () => {
    expect(mountAdd().wrapper.find('button.btn-primary').text()).toBe('新增團隊')
    expect(mountAdd({ loading: true }).wrapper.find('button.btn-primary').text()).toBe('新增中...')
  })
})
