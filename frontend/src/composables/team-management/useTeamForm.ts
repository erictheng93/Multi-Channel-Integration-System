/**
 * useTeamForm Composable
 *
 * Extracted from TeamCard.vue (lines 252-383)
 * Manages team edit form state, validation, and submission
 *
 * Features:
 * - Form data reactive state
 * - Validation with error messages
 * - Form initialization from team data
 * - Form submission with API integration
 * - Reset functionality
 */

import { ref, reactive, type Ref } from 'vue'
import { teamApi } from '@/api/team'
import { useTeamStore } from '@/stores/team'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useToast } from '@/composables/useToast'

interface Team {
  id: number
  name: string
  description?: string
}

interface FormData {
  name: string
  description: string
}

interface FormErrors {
  name?: string
  description?: string
}

export interface UseTeamFormReturn {
  /** Form data */
  formData: FormData

  /** Form validation errors */
  errors: Ref<FormErrors>

  /** Loading state during submission */
  loading: Ref<boolean>

  /** Initialize form with team data */
  initForm: (_team: Team) => void

  /** Validate form data */
  validateForm: () => boolean

  /** Submit form changes */
  submitForm: (_teamId: number) => Promise<boolean>

  /** Reset form to initial state */
  resetForm: () => void
}

export function useTeamForm(): UseTeamFormReturn {
  const teamStore = useTeamStore()
  const { showWarning } = useConfirmDialog()
  const { showSuccess, showError } = useToast()

  const formData = reactive<FormData>({
    name: '',
    description: ''
  })

  const errors = ref<FormErrors>({}) as Ref<FormErrors>
  const loading = ref<boolean>(false) as Ref<boolean>

  // Store initial form data for reset
  let initialFormData: FormData = { name: '', description: '' }

  /**
   * Initialize form with team data
   */
  const initForm = (team: Team) => {
    formData.name = team.name
    formData.description = team.description || ''

    // Store initial state for reset
    initialFormData = {
      name: team.name,
      description: team.description || ''
    }

    // Clear errors
    errors.value = {}
  }

  /**
   * Validate form data
   * Returns true if valid, false otherwise
   */
  const validateForm = (): boolean => {
    errors.value = {}

    // Validate name
    if (!formData.name || formData.name.trim() === '') {
      errors.value.name = '團隊名稱為必填'
      return false
    }

    if (formData.name.length > 100) {
      errors.value.name = '團隊名稱不能超過 100 個字元'
      return false
    }

    // Validate description (optional, but has length limit)
    if (formData.description && formData.description.length > 500) {
      errors.value.description = '團隊描述不能超過 500 個字元'
      return false
    }

    return true
  }

  /**
   * Submit form changes
   * Returns true if successful, false otherwise
   */
  const submitForm = async (teamId: number): Promise<boolean> => {
    // Validate first
    if (!validateForm()) {
      showError('請修正表單錯誤')
      return false
    }

    try {
      // Show confirmation dialog
      const confirmed = await showWarning(
        '確定要更新團隊資訊？',
        `團隊名稱將更新為 "${formData.name}"`
      )

      if (!confirmed) {
        return false
      }

      loading.value = true

      const response = await teamApi.updateTeam(teamId, {
        name: formData.name,
        description: formData.description
      })

      if (response.success) {
        // 最小化刷新：直接更新 store 中的單一團隊，避免全量重新載入
        teamStore.updateTeamLocal(teamId, {
          name: formData.name,
          description: formData.description
        })

        showSuccess('團隊更新成功')
        // Update initial form data to new values
        initialFormData = {
          name: formData.name,
          description: formData.description
        }
        return true
      } else {
        showError(response.error || '更新團隊失敗')
        return false
      }
    } catch (error) {
      console.error('更新團隊失敗:', error)
      showError('更新團隊時發生錯誤')
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Reset form to initial state
   */
  const resetForm = () => {
    formData.name = initialFormData.name
    formData.description = initialFormData.description
    errors.value = {}
  }

  return {
    formData,
    errors,
    loading,
    initForm,
    validateForm,
    submitForm,
    resetForm
  }
}
