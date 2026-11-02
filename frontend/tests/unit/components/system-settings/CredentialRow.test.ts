import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CredentialRow from '@/components/system-settings/CredentialRow.vue'

function make(modelValue: string) {
  return mount(CredentialRow, {
    props: {
      label: 'Channel Secret',
      inputId: 'line-secret',
      modelValue,
      configured: true,
      last4: '1234'
    }
  })
}

describe('CredentialRow.vue', () => {
  it('shows the stored value when nothing is pending', () => {
    const wrapper = make('')
    expect(wrapper.find('.cred-last4').text()).toContain('1234')
    expect(wrapper.find('input').exists()).toBe(false)
  })

  // A remounted row (back from another settings section) starts with replacing = false
  it('keeps a pending replacement visible when the row remounts', () => {
    const wrapper = make('new-secret-value')
    expect(wrapper.find('.cred-last4').exists()).toBe(false)
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('new-secret-value')
  })

  it('cancelling a pending replacement clears it', async () => {
    const wrapper = make('new-secret-value')
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([''])
  })
})
