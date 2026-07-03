<template>
  <AppLayout>
    <main
      class="broadcast-page"
      aria-label="群發訊息"
    >
      <header class="page-header">
        <div>
          <h1>群發訊息</h1>
          <p>針對標籤受眾發送 LINE 文字訊息，並追蹤每位收件人的結果。</p>
        </div>
      </header>

      <div class="page-grid">
        <BroadcastComposeCard
          :tags="tagsStore.tags"
          :preview="broadcastsStore.preview"
          :preview-tag-id="broadcastsStore.previewTagId"
          :preview-loading="broadcastsStore.previewLoading"
          :sending="broadcastsStore.sending"
          :error="broadcastsStore.error"
          @preview="handlePreview"
          @send="handleSend"
        />

        <BroadcastHistoryList
          :broadcasts="broadcastsStore.broadcasts"
          :loading="broadcastsStore.loading"
          :pagination="broadcastsStore.pagination"
          @refresh="broadcastsStore.fetchBroadcasts()"
          @page-change="handleHistoryPageChange"
          @select="openDetail"
        />
      </div>

      <BroadcastDetailModal
        v-model="recipientStatus"
        :open="detailOpen"
        :broadcast="broadcastsStore.selectedBroadcast"
        :recipients="broadcastsStore.recipients"
        @close="detailOpen = false"
        @page-change="handleRecipientPageChange"
      />
    </main>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import AppLayout from '@/components/ui/AppLayout.vue'
import BroadcastComposeCard from '@/components/broadcast/BroadcastComposeCard.vue'
import BroadcastHistoryList from '@/components/broadcast/BroadcastHistoryList.vue'
import BroadcastDetailModal from '@/components/broadcast/BroadcastDetailModal.vue'
import { useTagsStore } from '@/stores/tags'
import { useBroadcastsStore } from '@/stores/broadcasts'
import type {
  BroadcastPreviewRequest,
  BroadcastRecipientStatus,
  CreateBroadcastRequest
} from '@/api/broadcasts'

const tagsStore = useTagsStore()
const broadcastsStore = useBroadcastsStore()
const detailOpen = ref(false)
const detailBroadcastId = ref<string | null>(null)
const recipientStatus = ref<BroadcastRecipientStatus | undefined>()
const recipientPage = ref(1)

onMounted(async () => {
  await Promise.all([
    tagsStore.fetchTags({ pageSize: 100, includeGlobal: true }),
    broadcastsStore.fetchBroadcasts()
  ])
})

async function handlePreview(input: BroadcastPreviewRequest) {
  await broadcastsStore.fetchPreview(input)
}

async function handleSend(input: CreateBroadcastRequest) {
  await broadcastsStore.createAndSend(input)
  if (broadcastsStore.selectedBroadcast) {
    await openDetail(broadcastsStore.selectedBroadcast.id)
  }
}

async function openDetail(id: string) {
  detailBroadcastId.value = id
  recipientStatus.value = undefined
  recipientPage.value = 1
  detailOpen.value = true
  await broadcastsStore.fetchBroadcast(id)
  await fetchCurrentRecipients()
}

watch(recipientStatus, async (status) => {
  if (detailOpen.value && detailBroadcastId.value) {
    recipientPage.value = 1
    await broadcastsStore.fetchRecipients(detailBroadcastId.value, { page: 1, status })
  }
})

async function handleHistoryPageChange(page: number) {
  await broadcastsStore.fetchBroadcasts({ page })
}

async function handleRecipientPageChange(page: number) {
  recipientPage.value = page
  await fetchCurrentRecipients()
}

async function fetchCurrentRecipients() {
  if (!detailBroadcastId.value) {return}
  await broadcastsStore.fetchRecipients(detailBroadcastId.value, {
    page: recipientPage.value,
    status: recipientStatus.value
  })
}
</script>

<style scoped>
.broadcast-page {
  min-height: 100%;
  background: #f2f2f7;
  padding: var(--space-6);
}

.page-header {
  margin-bottom: var(--space-6);
}

.page-header h1 {
  margin: 0;
  font-size: var(--text-3xl);
}

.page-header p {
  margin: var(--space-2) 0 0;
  color: var(--gray-500);
}

.page-grid {
  display: grid;
  gap: var(--space-6);
}

@media (min-width: 1180px) {
  .page-grid {
    grid-template-columns: minmax(360px, 460px) minmax(0, 1fr);
    align-items: start;
  }
}
</style>
