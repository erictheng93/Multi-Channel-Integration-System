<template>
  <AppLayout>
    <div class="ui-page auto-reply-page">
      <!-- Page Header -->
      <UiPageHead
        title="自動回覆"
        :subtitle="!loading && headline ? headline : ''"
      >
        <template #actions>
          <button
            class="btn btn-secondary"
            :disabled="loading"
            @click="refresh"
          >
            重新整理
          </button>
        </template>
      </UiPageHead>

      <!-- Loading -->
      <div
        v-if="loading"
        class="loading-container"
      >
        <LoadingSpinner />
      </div>

      <template v-else>
        <!-- Stats -->
        <AutoReplyStats
          :active-rules="stats.activeRules"
          :total-rules="stats.totalRules"
          :today-replies="stats.todayReplies"
          :today-failed="stats.todayFailed"
          :yesterday-same-time="stats.yesterdaySameTime"
          :is-business-hours="stats.isBusinessHours"
          :business-hours="stats.businessHours"
          :success-rate="stats.successRate"
        />

        <!-- Tabs -->
        <div class="tabs-container">
          <div
            class="ui-seg tabs-bar"
            role="tablist"
          >
            <button
              class="tab-button"
              role="tab"
              :aria-selected="activeTab === 'rules'"
              :class="{ active: activeTab === 'rules' }"
              @click="switchTab('rules')"
            >
              規則管理
              <span class="ui-seg-n tab-badge">{{ store.rules.length }}</span>
            </button>
            <button
              class="tab-button"
              role="tab"
              :aria-selected="activeTab === 'schedules'"
              :class="{ active: activeTab === 'schedules' }"
              @click="switchTab('schedules')"
            >
              營業時間
            </button>
            <button
              class="tab-button"
              role="tab"
              :aria-selected="activeTab === 'logs'"
              :class="{ active: activeTab === 'logs' }"
              @click="switchTab('logs')"
            >
              執行日誌
              <span class="ui-seg-n tab-badge">{{ store.logsPagination.total }}</span>
            </button>
          </div>

          <!-- Tab Content -->
          <div class="tab-content">
            <!-- Rules Tab -->
            <RuleList
              v-if="activeTab === 'rules'"
              :rules="filteredRules"
              :expanded-rule-id="ruleEditor.expandedRuleId.value"
              :is-creating="ruleEditor.isCreating.value"
              :form-data="ruleEditor.formData"
              :saving="ruleEditor.saving.value"
              :search-query="searchQuery"
              :filter-trigger-type="filterTriggerType"
              @update:search-query="searchQuery = $event"
              @update:filter-trigger-type="filterTriggerType = $event"
              @start-create="ruleEditor.startCreate()"
              @expand-rule="ruleEditor.expandRule($event)"
              @toggle-active="ruleEditor.toggleRuleActive($event)"
              @collapse="ruleEditor.collapseRule()"
              @save="handleSaveRule"
              @delete="handleDeleteRule"
              @add-condition="(type: string, value: string) => ruleEditor.addCondition(type as 'exact' | 'contains' | 'regex' | 'message_type', value)"
              @remove-condition="(index: number) => ruleEditor.removeCondition(index)"
              @add-action="(type: string) => ruleEditor.addAction(type as 'reply_text' | 'reply_image' | 'reply_flex')"
              @remove-action="(index: number) => ruleEditor.removeAction(index)"
              @update-action-content="(index: number, content: string) => ruleEditor.updateActionContent(index, content)"
              @update-field="handleUpdateField"
            />

            <!-- Schedules Tab -->
            <ScheduleGrid
              v-if="activeTab === 'schedules'"
              :rows="scheduleEditor.rows"
              :timezone="scheduleEditor.timezone.value"
              @toggle-day="scheduleEditor.toggleDay($event)"
              @update-time="(day, field, val) => scheduleEditor.updateTime(day, field, val)"
              @update-timezone="scheduleEditor.updateTimezone($event)"
            />

            <!-- Logs Tab -->
            <LogTable
              v-if="activeTab === 'logs'"
              :logs="store.logs"
              :rules="store.rules"
              :pagination="store.logsPagination"
              :filter-rule-id="filterRuleId"
              :filter-platform="filterPlatform"
              @update:filter-rule-id="filterRuleId = $event"
              @update:filter-platform="filterPlatform = $event"
              @page-change="loadLogsPage($event)"
            />
          </div>
        </div>
      </template>

      <!-- Delete Confirmation Dialog -->
      <ConfirmDialog
        v-if="showDeleteConfirm"
        type="danger"
        title="確定刪除此規則？"
        :message="deleteConfirmMessage"
        confirm-text="刪除"
        cancel-text="取消"
        :loading="deleting"
        @confirm="confirmDelete"
        @cancel="showDeleteConfirm = false"
        @close="showDeleteConfirm = false"
      />
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import UiPageHead from '@/components/ui/UiPageHead.vue'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import AppLayout from '@/components/ui/AppLayout.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import AutoReplyStats from '@/components/auto-reply/AutoReplyStats.vue'
import RuleList from '@/components/auto-reply/RuleList.vue'
import ScheduleGrid from '@/components/auto-reply/ScheduleGrid.vue'
import LogTable from '@/components/auto-reply/LogTable.vue'
import { useAutoReplyController } from '@/composables/autoReply/useAutoReplyController'
import { useToast } from '@/composables/useToast'

const {
  loading,
  activeTab,
  searchQuery,
  filterTriggerType,
  filterRuleId,
  filterPlatform,
  filteredRules,
  stats,
  store,
  ruleEditor,
  scheduleEditor,
  initialize,
  cleanup,
  switchTab,
  loadLogsPage
} = useAutoReplyController()

const { showSuccess, showError } = useToast()

// One-line summary built from the server's stats (no invented numbers)
const headline = computed(() => {
  if (stats.value.totalRules === 0) { return '尚未建立規則，新增規則後客戶訊息會依優先序比對。' }
  const parts: string[] = []
  const hours = stats.value.businessHours
  if (hours?.hasSchedule) {
    parts.push(hours.isOpen ? '目前營業中' : '目前非營業時間')
  }
  parts.push(`${stats.value.totalRules} 條規則中 ${stats.value.activeRules} 條啟用`)
  const summary = `${parts.join('，')}。`
  const today = stats.value.todayReplies > 0 ? `今天已自動回覆 ${stats.value.todayReplies} 則，` : ''
  return `${summary}${today}優先序數字越小越先比對。`
})

async function refresh() {
  await initialize()
}

async function handleSaveRule() {
  // Capture before saveRule() collapses the editor (resets isCreating)
  const wasCreating = ruleEditor.isCreating.value
  const success = await ruleEditor.saveRule()
  if (success) {
    showSuccess(wasCreating ? '規則已建立' : '規則已更新')
  } else {
    showError('儲存規則失敗', '請稍後再試')
  }
}

// Delete confirmation state
const showDeleteConfirm = ref(false)
const deleting = ref(false)

const deleteConfirmMessage = computed(() => {
  const ruleId = ruleEditor.expandedRuleId.value
  const rule = store.rules.find(r => r.id === ruleId)
  return rule
    ? `規則「${rule.name}」刪除後無法復原，確定要繼續嗎？`
    : '此操作無法復原，確定要刪除嗎？'
})

function handleDeleteRule() {
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  if (!ruleEditor.expandedRuleId.value) { return }
  deleting.value = true
  const success = await ruleEditor.removeRule(ruleEditor.expandedRuleId.value)
  deleting.value = false
  showDeleteConfirm.value = false
  if (success) {
    showSuccess('規則已刪除')
  } else {
    showError('刪除規則失敗', '請稍後再試')
  }
}

function handleUpdateField(field: string, value: unknown) {
  const fd = ruleEditor.formData as Record<string, unknown>
  fd[field] = value
}

onMounted(() => initialize())
onUnmounted(() => cleanup())
</script>

<style scoped>

.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}

.tabs-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tabs-bar {
  align-self: flex-start;
  max-width: 100%;
  overflow-x: auto;
}

.tab-content {
  min-height: 200px;
}

@media (max-width: 768px) {

  .tabs-bar {
    align-self: stretch;
  }

  .tabs-bar > button {
    flex: 1;
    justify-content: center;
    min-height: 44px;
  }
}
</style>
