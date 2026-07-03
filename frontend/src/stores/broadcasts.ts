import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  createBroadcast,
  getBroadcast,
  listBroadcastRecipients,
  listBroadcasts,
  previewBroadcastAudience,
  sendBroadcast,
  type BroadcastAudiencePreview,
  type BroadcastListResult,
  type BroadcastPreviewRequest,
  type BroadcastRecipientListResult,
  type BroadcastRecipientStatus,
  type BroadcastRecord,
  type BroadcastSendStats,
  type CreateBroadcastRequest
} from '@/api/broadcasts'

export const useBroadcastsStore = defineStore('broadcasts', () => {
  const broadcasts = ref<BroadcastRecord[]>([])
  const selectedBroadcast = ref<BroadcastRecord | null>(null)
  const preview = ref<BroadcastAudiencePreview | null>(null)
  const previewTagId = ref<number | null>(null)
  const recipients = ref<BroadcastRecipientListResult | null>(null)
  const lastSendStats = ref<BroadcastSendStats | null>(null)
  const pagination = ref<Omit<BroadcastListResult, 'items'> | null>(null)
  const recipientsPagination = ref<Omit<BroadcastRecipientListResult, 'items'> | null>(null)
  const loading = ref(false)
  const previewLoading = ref(false)
  const sending = ref(false)
  const error = ref<string | null>(null)
  let previewRequestSeq = 0

  async function fetchPreview(input: BroadcastPreviewRequest) {
    const requestSeq = ++previewRequestSeq
    const tagId = input.tagIds[0] ?? null
    previewLoading.value = true
    error.value = null
    try {
      const result = await previewBroadcastAudience(input)
      if (requestSeq === previewRequestSeq) {
        preview.value = result
        previewTagId.value = tagId
      }
      return result
    } catch (err) {
      if (requestSeq === previewRequestSeq) {
        error.value = err instanceof Error ? err.message : '無法取得群發預覽'
      }
      throw err
    } finally {
      if (requestSeq === previewRequestSeq) {
        previewLoading.value = false
      }
    }
  }

  async function createAndSend(input: CreateBroadcastRequest) {
    sending.value = true
    error.value = null
    try {
      const created = await createBroadcast(input)
      selectedBroadcast.value = created
      lastSendStats.value = await sendBroadcast(created.id)
      await fetchBroadcast(created.id)
      await fetchBroadcasts()
      return lastSendStats.value
    } catch (err) {
      error.value = err instanceof Error ? err.message : '群發送出失敗'
      throw err
    } finally {
      sending.value = false
    }
  }

  async function fetchBroadcasts(params?: { page?: number; pageSize?: number }) {
    loading.value = true
    error.value = null
    try {
      const result = await listBroadcasts(params)
      broadcasts.value = result.items
      pagination.value = {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages
      }
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : '無法取得群發列表'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchBroadcast(id: string) {
    selectedBroadcast.value = await getBroadcast(id)
    return selectedBroadcast.value
  }

  async function fetchRecipients(
    id: string,
    params?: { page?: number; pageSize?: number; status?: BroadcastRecipientStatus }
  ) {
    const result = await listBroadcastRecipients(id, params)
    recipients.value = result
    recipientsPagination.value = {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages
    }
    return result
  }

  function clearPreview() {
    preview.value = null
    previewTagId.value = null
  }

  return {
    broadcasts,
    selectedBroadcast,
    preview,
    previewTagId,
    recipients,
    lastSendStats,
    pagination,
    recipientsPagination,
    loading,
    previewLoading,
    sending,
    error,
    fetchPreview,
    createAndSend,
    fetchBroadcasts,
    fetchBroadcast,
    fetchRecipients,
    clearPreview
  }
})
