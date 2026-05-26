<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="open"
        class="restore-modal__backdrop"
        @click.self="emit('cancel')"
      >
        <section
          class="restore-modal__panel"
          role="dialog"
          aria-modal="true"
          :aria-label="hasConflict ? '還原衝突' : '確認還原'"
        >
          <header class="restore-modal__header">
            <h2
              class="restore-modal__title"
              :class="{ 'restore-modal__title--warning': hasConflict }"
            >
              {{ hasConflict ? '還原衝突' : '確認還原' }}
            </h2>
          </header>

          <div class="restore-modal__body">
            <p class="restore-modal__description">
              {{ activity.userName }} 的 {{ activity.action }} 將被還原。
            </p>

            <template v-if="hasConflict">
              <p class="restore-modal__warning">
                這筆資料在原始操作後已有變更，請確認差異後再覆蓋還原。
              </p>
              <table class="conflict-table">
                <thead>
                  <tr>
                    <th>欄位</th>
                    <th>原始值</th>
                    <th>目前值</th>
                    <th>還原後</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in midChanges"
                    :key="row.field"
                  >
                    <td class="conflict-table__field">
                      {{ row.field }}
                    </td>
                    <td>{{ formatValue(row.valueAtOriginalAction) }}</td>
                    <td class="value--current">
                      {{ formatValue(row.valueNow) }}
                    </td>
                    <td class="value--restore">
                      {{ formatValue(row.valueAfterRestore) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </template>
          </div>

          <footer class="restore-modal__footer">
            <button
              class="btn btn-secondary btn-sm"
              data-test="restore-cancel"
              :disabled="loading"
              @click="emit('cancel')"
            >
              取消
            </button>
            <button
              v-if="!hasConflict"
              class="btn btn-primary btn-sm"
              data-test="restore-confirm"
              :disabled="loading"
              @click="emit('confirm', { force: false })"
            >
              確認還原
            </button>
            <button
              v-else
              class="btn btn-primary btn-sm"
              data-test="restore-force"
              :disabled="loading"
              @click="emit('confirm', { force: true })"
            >
              覆蓋還原
            </button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ActivityLog } from '@/api/activities'
import type { MidChange } from './types'

const props = defineProps<{
  open: boolean
  activity: ActivityLog
  midChanges: MidChange[] | null
  loading: boolean
}>()

const emit = defineEmits<{
  (_e: 'confirm', _payload: { force: boolean }): void
  (_e: 'cancel'): void
}>()

const hasConflict = computed(() => (props.midChanges?.length ?? 0) > 0)

function formatValue(value: unknown): string {
  if (value === null) {return 'null'}
  if (value === undefined) {return 'undefined'}
  if (typeof value === 'string') {return value}
  return JSON.stringify(value)
}
</script>

<style scoped>
.restore-modal__backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgb(0 0 0 / 0.28);
}

.restore-modal__panel {
  width: min(720px, 100%);
  max-height: min(720px, calc(100vh - 48px));
  overflow: auto;
  background: #FFFFFF;
  border-radius: 8px;
  box-shadow: 0 16px 44px rgb(0 0 0 / 0.18);
}

.restore-modal__header {
  padding: 20px 24px 8px;
}

.restore-modal__title {
  margin: 0;
  color: #1C1C1E;
  font-size: 18px;
  font-weight: 650;
}

.restore-modal__title--warning {
  color: #FF3B30;
}

.restore-modal__body {
  padding: 8px 24px 16px;
}

.restore-modal__description,
.restore-modal__warning {
  margin: 0 0 12px;
  color: #1C1C1E;
  font-size: 14px;
  line-height: 1.6;
}

.restore-modal__warning {
  color: #8E8E93;
}

.conflict-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.conflict-table th {
  padding: 8px 0;
  border-bottom: 1px solid rgb(0 0 0 / 0.06);
  color: #8E8E93;
  font-weight: 500;
  text-align: left;
}

.conflict-table td {
  padding: 12px 8px 12px 0;
  border-bottom: 1px solid rgb(0 0 0 / 0.04);
  color: #1C1C1E;
  vertical-align: top;
}

.conflict-table__field {
  font-weight: 600;
}

.value--current {
  color: #FF9500;
}

.value--restore {
  color: #34C759;
}

.restore-modal__footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 16px 24px 20px;
  background: #F2F2F7;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 200ms ease-out;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
