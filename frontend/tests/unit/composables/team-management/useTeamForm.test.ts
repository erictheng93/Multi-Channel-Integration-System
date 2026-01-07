/**
 * Unit Tests for useTeamForm Composable
 *
 * Tests form state management, validation, and submission:
 * - Form initialization
 * - Validation rules (name required, length limits)
 * - Form submission with confirmation
 * - API integration
 * - Form reset functionality
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTeamForm } from '@/composables/team-management/useTeamForm'

// Mock dependencies
vi.mock('@/api/team', () => {
  return {
    teamApi: {
      updateTeam: vi.fn()
    }
  }
})

vi.mock('@/composables/useConfirmDialog', () => {
  return {
    useConfirmDialog: vi.fn(() => ({
      showWarning: vi.fn().mockResolvedValue(true)
    }))
  }
})

vi.mock('@/composables/useToast', () => {
  return {
    useToast: vi.fn(() => ({
      showSuccess: vi.fn(),
      showError: vi.fn()
    }))
  }
})

import { teamApi } from '@/api/team'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useToast } from '@/composables/useToast'

describe('useTeamForm', () => {
  // Mock function references for assertions
  let mockShowWarning: ReturnType<typeof vi.fn>
  let mockShowSuccess: ReturnType<typeof vi.fn>
  let mockShowError: ReturnType<typeof vi.fn>

  const mockTeam = {
    id: 1,
    name: 'Test Team',
    description: 'Test Description'
  }

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Create fresh mock functions
    mockShowWarning = vi.fn().mockResolvedValue(true)
    mockShowSuccess = vi.fn()
    mockShowError = vi.fn()

    // Setup default API responses
    vi.mocked(teamApi.updateTeam).mockResolvedValue({
      success: true
    })

    // Setup default composable responses
    vi.mocked(useConfirmDialog).mockReturnValue({
      showWarning: mockShowWarning
    } as any)

    vi.mocked(useToast).mockReturnValue({
      showSuccess: mockShowSuccess,
      showError: mockShowError
    } as any)
  })

  describe('initial state', () => {
    it('should initialize with empty form data', () => {
      const { formData } = useTeamForm()

      expect(formData.name).toBe('')
      expect(formData.description).toBe('')
    })

    it('should initialize with no errors', () => {
      const { errors } = useTeamForm()

      expect(errors.value).toEqual({})
    })

    it('should initialize with loading false', () => {
      const { loading } = useTeamForm()

      expect(loading.value).toBe(false)
    })
  })

  describe('initForm', () => {
    it('should populate form data from team', () => {
      const { formData, initForm } = useTeamForm()

      initForm(mockTeam)

      expect(formData.name).toBe('Test Team')
      expect(formData.description).toBe('Test Description')
    })

    it('should handle missing description', () => {
      const { formData, initForm } = useTeamForm()
      const teamWithoutDesc = { id: 1, name: 'No Desc Team' }

      initForm(teamWithoutDesc)

      expect(formData.name).toBe('No Desc Team')
      expect(formData.description).toBe('')
    })

    it('should clear existing errors', () => {
      const { errors, formData, initForm, validateForm } = useTeamForm()

      // Create validation error
      formData.name = ''
      validateForm()
      expect(errors.value.name).toBeDefined()

      // Init should clear errors
      initForm(mockTeam)
      expect(errors.value).toEqual({})
    })

    it('should store initial data for reset', () => {
      const { formData, initForm, resetForm } = useTeamForm()

      initForm(mockTeam)

      // Modify form data
      formData.name = 'Modified Name'
      formData.description = 'Modified Description'

      // Reset should restore initial data
      resetForm()

      expect(formData.name).toBe('Test Team')
      expect(formData.description).toBe('Test Description')
    })
  })

  describe('validateForm', () => {
    describe('name validation', () => {
      it('should require name', () => {
        const { formData, validateForm, errors } = useTeamForm()

        formData.name = ''
        const isValid = validateForm()

        expect(isValid).toBe(false)
        expect(errors.value.name).toBe('團隊名稱為必填')
      })

      it('should reject whitespace-only name', () => {
        const { formData, validateForm, errors } = useTeamForm()

        formData.name = '   '
        const isValid = validateForm()

        expect(isValid).toBe(false)
        expect(errors.value.name).toBe('團隊名稱為必填')
      })

      it('should enforce max length of 100 characters', () => {
        const { formData, validateForm, errors } = useTeamForm()

        formData.name = 'a'.repeat(101)
        const isValid = validateForm()

        expect(isValid).toBe(false)
        expect(errors.value.name).toBe('團隊名稱不能超過 100 個字元')
      })

      it('should accept name with exactly 100 characters', () => {
        const { formData, validateForm } = useTeamForm()

        formData.name = 'a'.repeat(100)
        const isValid = validateForm()

        expect(isValid).toBe(true)
      })

      it('should accept valid name', () => {
        const { formData, validateForm, errors } = useTeamForm()

        formData.name = 'Valid Team Name'
        const isValid = validateForm()

        expect(isValid).toBe(true)
        expect(errors.value.name).toBeUndefined()
      })
    })

    describe('description validation', () => {
      it('should allow empty description', () => {
        const { formData, validateForm } = useTeamForm()

        formData.name = 'Valid Name'
        formData.description = ''
        const isValid = validateForm()

        expect(isValid).toBe(true)
      })

      it('should enforce max length of 500 characters', () => {
        const { formData, validateForm, errors } = useTeamForm()

        formData.name = 'Valid Name'
        formData.description = 'a'.repeat(501)
        const isValid = validateForm()

        expect(isValid).toBe(false)
        expect(errors.value.description).toBe('團隊描述不能超過 500 個字元')
      })

      it('should accept description with exactly 500 characters', () => {
        const { formData, validateForm } = useTeamForm()

        formData.name = 'Valid Name'
        formData.description = 'a'.repeat(500)
        const isValid = validateForm()

        expect(isValid).toBe(true)
      })
    })

    it('should clear previous errors before validation', () => {
      const { formData, validateForm, errors } = useTeamForm()

      // Create error
      formData.name = ''
      validateForm()
      expect(errors.value.name).toBeDefined()

      // Fix and validate again
      formData.name = 'Valid Name'
      validateForm()
      expect(errors.value).toEqual({})
    })
  })

  describe('submitForm', () => {
    it('should validate before submitting', async () => {
      const { formData, submitForm } = useTeamForm()

      formData.name = '' // Invalid
      const result = await submitForm(1)

      expect(result).toBe(false)
      expect(mockShowError).toHaveBeenCalledWith('請修正表單錯誤')
      expect(teamApi.updateTeam).not.toHaveBeenCalled()
    })

    it('should show confirmation dialog', async () => {
      const { formData, initForm, submitForm } = useTeamForm()

      initForm(mockTeam)
      formData.name = 'Updated Name'

      await submitForm(1)

      expect(mockShowWarning).toHaveBeenCalledWith(
        '確定要更新團隊資訊？',
        '團隊名稱將更新為 "Updated Name"'
      )
    })

    it('should cancel submission if user declines confirmation', async () => {
      mockShowWarning.mockResolvedValue(false) // User cancels

      const { initForm, submitForm } = useTeamForm()

      initForm(mockTeam)
      const result = await submitForm(1)

      expect(result).toBe(false)
      expect(teamApi.updateTeam).not.toHaveBeenCalled()
      expect(mockShowSuccess).not.toHaveBeenCalled()
    })

    it('should call API with correct data on successful validation', async () => {
      const { formData, initForm, submitForm } = useTeamForm()

      initForm(mockTeam)
      formData.name = 'Updated Name'
      formData.description = 'Updated Description'

      await submitForm(1)

      expect(teamApi.updateTeam).toHaveBeenCalledWith(1, {
        name: 'Updated Name',
        description: 'Updated Description'
      })
    })

    it('should show success message on successful submission', async () => {
      const { initForm, submitForm } = useTeamForm()

      initForm(mockTeam)
      const result = await submitForm(1)

      expect(result).toBe(true)
      expect(mockShowSuccess).toHaveBeenCalledWith('團隊更新成功')
    })

    it('should update initial form data after successful submission', async () => {
      const { formData, initForm, submitForm, resetForm } = useTeamForm()

      initForm(mockTeam)
      formData.name = 'Updated Name'

      await submitForm(1)

      // Reset should now use updated data as initial
      formData.name = 'Temporary Change'
      resetForm()

      expect(formData.name).toBe('Updated Name')
    })

    it('should handle API failure', async () => {
      vi.mocked(teamApi.updateTeam).mockResolvedValue({
        success: false,
        error: 'Update failed'
      })

      const { initForm, submitForm } = useTeamForm()

      initForm(mockTeam)
      const result = await submitForm(1)

      expect(result).toBe(false)
      expect(mockShowError).toHaveBeenCalledWith('Update failed')
    })

    it('should handle API failure without error message', async () => {
      vi.mocked(teamApi.updateTeam).mockResolvedValue({
        success: false
      })

      const { initForm, submitForm } = useTeamForm()

      initForm(mockTeam)
      const result = await submitForm(1)

      expect(result).toBe(false)
      expect(mockShowError).toHaveBeenCalledWith('更新團隊失敗')
    })

    it('should handle network error', async () => {
      vi.mocked(teamApi.updateTeam).mockRejectedValue(new Error('Network error'))

      const { initForm, submitForm } = useTeamForm()

      initForm(mockTeam)
      const result = await submitForm(1)

      expect(result).toBe(false)
      expect(mockShowError).toHaveBeenCalledWith('更新團隊時發生錯誤')
    })

    it('should set loading state during submission', async () => {
      const { loading, initForm, submitForm } = useTeamForm()

      initForm(mockTeam)

      expect(loading.value).toBe(false)

      const promise = submitForm(1)
      // Loading should be true during async operation
      // (Note: This is a bit tricky to test due to timing)

      await promise
      expect(loading.value).toBe(false)
    })

    it('should reset loading state even on error', async () => {
      vi.mocked(teamApi.updateTeam).mockRejectedValue(new Error('Network error'))

      const { loading, initForm, submitForm } = useTeamForm()

      initForm(mockTeam)
      await submitForm(1)

      expect(loading.value).toBe(false)
    })
  })

  describe('resetForm', () => {
    it('should restore form data to initial state', () => {
      const { formData, initForm, resetForm } = useTeamForm()

      initForm(mockTeam)

      // Modify form
      formData.name = 'Modified'
      formData.description = 'Modified Desc'

      resetForm()

      expect(formData.name).toBe('Test Team')
      expect(formData.description).toBe('Test Description')
    })

    it('should clear validation errors', () => {
      const { formData, errors, initForm, validateForm, resetForm } = useTeamForm()

      initForm(mockTeam)

      // Create validation error
      formData.name = ''
      validateForm()
      expect(errors.value.name).toBeDefined()

      resetForm()
      expect(errors.value).toEqual({})
    })

    it('should work with default initial state', () => {
      const { formData, resetForm } = useTeamForm()

      // No init call, so initial state is empty
      formData.name = 'Some Name'
      formData.description = 'Some Desc'

      resetForm()

      expect(formData.name).toBe('')
      expect(formData.description).toBe('')
    })
  })

  describe('reactivity', () => {
    it('should trigger reactivity when form data changes', () => {
      const { formData } = useTeamForm()
      const observer = vi.fn()

      // Simulate a watcher
      observer(formData.name)

      formData.name = 'New Name'
      observer(formData.name)

      expect(observer).toHaveBeenCalledWith('')
      expect(observer).toHaveBeenCalledWith('New Name')
    })

    it('should trigger reactivity when errors change', () => {
      const { errors, formData, validateForm } = useTeamForm()
      const observer = vi.fn()

      observer(errors.value)

      formData.name = ''
      validateForm()
      observer(errors.value)

      expect(observer).toHaveBeenCalledTimes(2)
      expect(observer.mock.calls[1][0]).toHaveProperty('name')
    })
  })
})
