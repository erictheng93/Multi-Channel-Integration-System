/**
 * Tags Store
 * Manages tag state using Pinia
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getTags, type Tag } from '@/api/tags'

export const useTagsStore = defineStore('tags', () => {
  // State
  const tags = ref<Tag[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Actions
  async function fetchTags(params?: {
    page?: number
    pageSize?: number
    teamId?: number
    search?: string
    includeGlobal?: boolean
  }) {
    loading.value = true
    error.value = null

    try {
      const response = await getTags(params)
      tags.value = response.data
      return response
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch tags'
      throw err
    } finally {
      loading.value = false
    }
  }

  function $reset() {
    tags.value = []
    loading.value = false
    error.value = null
  }

  return {
    // State
    tags,
    loading,
    error,

    // Actions
    fetchTags,
    $reset
  }
})
