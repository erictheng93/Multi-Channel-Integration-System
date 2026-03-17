<template>
  <AppLayout>
    <div class="auto-reply-page">
      <!-- Page Header -->
      <div class="page-header">
        <div class="page-header__content">
          <h1 class="page-title">
            自動回覆管理
          </h1>
          <p class="page-subtitle">
            管理自動回覆規則、營業時間排程，及查看執行日誌
          </p>
        </div>
        <button
          class="btn btn-secondary"
          :disabled="loading"
          @click="refresh"
        >
          重新整理
        </button>
      </div>

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
          :today-replies="stats.todayReplies"
          :is-business-hours="stats.isBusinessHours"
          :success-rate="stats.successRate"
        />

        <!-- Tabs -->
        <div class="tabs-container">
          <div class="tabs-bar">
            <button
              class="tab-button"
              :class="{ active: activeTab === 'rules' }"
              @click="switchTab('rules')"
            >
              規則管理
              <span class="tab-badge">{{ store.rules.length }}</span>
            </button>
            <button
              class="tab-button"
              :class="{ active: activeTab === 'schedules' }"
              @click="switchTab('schedules')"
            >
              營業時間
            </button>
            <button
              class="tab-button"
              :class="{ active: activeTab === 'logs' }"
              @click="switchTab('logs')"
            >
              執行日誌
              <span class="tab-badge">{{ store.logsPagination.total }}</span>
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

async function refresh() {
  await initialize()
}

async function handleSaveRule() {
  const success = await ruleEditor.saveRule()
  if (success) {
    showSuccess(ruleEditor.isCreating.value ? '規則已建立' : '規則已更新')
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
.auto-reply-page {
  padding: var(--space-6);
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-6);
}

.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0;
}

.page-subtitle {
  color: var(--gray-500);
  font-size: 0.875rem;
  margin-top: var(--space-1);
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
}

.tabs-container {
  margin-top: var(--space-6);
}

.tabs-bar {
  display: flex;
  gap: 0;
  border-bottom: 2px solid var(--gray-200);
  margin-bottom: var(--space-4);
}

.tab-button {
  padding: var(--space-3) var(--space-5);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--gray-500);
  background: none;
  border: none;
  cursor: pointer;
  position: relative;
  transition: color var(--transition-fast);
}

.tab-button:hover {
  color: var(--gray-700);
}

.tab-button.active {
  color: var(--primary-700);
}

.tab-button.active::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 2px;
  background-color: var(--primary-600);
}

.tab-badge {
  display: inline-block;
  background-color: var(--gray-100);
  color: var(--gray-600);
  border-radius: 10px;
  padding: 1px 8px;
  font-size: 0.75rem;
  margin-left: var(--space-1);
}

.tab-button.active .tab-badge {
  background-color: var(--primary-50);
  color: var(--primary-700);
}

.tab-content {
  min-height: 400px;
}

@media (max-width: 768px) {
  .auto-reply-page {
    padding: var(--space-4);
  }

  .page-header {
    flex-direction: column;
    gap: var(--space-3);
  }

  .tabs-bar {
    overflow-x: auto;
  }

  .tab-button {
    white-space: nowrap;
    padding: var(--space-2) var(--space-3);
    font-size: 0.8125rem;
  }
}
</style>
