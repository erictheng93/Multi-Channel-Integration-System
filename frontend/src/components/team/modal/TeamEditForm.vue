<template>
  <div class="team-edit-form">
    <h3>編輯團隊資訊</h3>
    <form @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="teamName">團隊名稱</label>
        <input
          id="teamName"
          :value="formData.name"
          type="text"
          placeholder="請輸入團隊名稱"
          :class="{ error: errors.name }"
          required
          @input="handleNameInput"
        >
        <span
          v-if="errors.name"
          class="error-message"
        >{{ errors.name }}</span>
      </div>
      <div class="form-group">
        <label for="teamDescription">團隊描述</label>
        <textarea
          id="teamDescription"
          :value="formData.description"
          rows="3"
          placeholder="請輸入團隊描述"
          :class="{ error: errors.description }"
          @input="handleDescriptionInput"
        />
        <span
          v-if="errors.description"
          class="error-message"
        >{{ errors.description }}</span>
      </div>
      <div class="form-actions">
        <button
          type="button"
          class="btn btn-secondary"
          @click="$emit('cancel')"
        >
          取消
        </button>
        <button
          type="submit"
          class="btn btn-primary"
          :disabled="loading"
        >
          {{ loading ? '儲存中...' : '儲存變更' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
/**
 * TeamEditForm Component
 *
 * Extracted from TeamCard.vue (lines 66-108)
 * Handles team information editing
 *
 * Features:
 * - Team name and description editing
 * - Form validation with error display
 * - Loading state during submission
 * - Cancel and submit actions
 */

interface FormData {
  name: string
  description: string
}

interface FormErrors {
  name?: string
  description?: string
}

interface Props {
  /** Form data */
  formData: FormData

  /** Validation errors */
  errors: FormErrors

  /** Loading state */
  loading: boolean
}

interface Emits {
  /** Emitted when form is submitted */
  (_e: 'submit'): void

  /** Emitted when cancel button is clicked */
  (_e: 'cancel'): void

  /** Emitted when name input changes */
  (_e: 'update:name', _value: string): void

  /** Emitted when description input changes */
  (_e: 'update:description', _value: string): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const handleSubmit = () => {
  emit('submit')
}

const handleNameInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:name', target.value)
}

const handleDescriptionInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement
  emit('update:description', target.value)
}
</script>

<style scoped>
.team-edit-form {
  margin-bottom: 28px;
  padding: 20px;
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.team-edit-form h3 {
  color: #1e293b;
  font-size: 1.375rem;
  font-weight: 700;
  margin: 0 0 20px 0;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #1e293b;
  font-size: 1rem;
  font-weight: 600;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.3s ease;
  background: #f8fafc;
  color: #475569;
  font-family: inherit;
}

.form-group input.error,
.form-group textarea.error {
  border-color: #ef4444;
  background: #fef2f2;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  background: white;
}

.form-group input:hover,
.form-group textarea:hover {
  border-color: #94a3b8;
}

.form-group textarea {
  resize: vertical;
  min-height: 80px;
}

.error-message {
  display: block;
  margin-top: 4px;
  color: #ef4444;
  font-size: 0.875rem;
  font-weight: 500;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 16px 24px;
  border: 1px solid;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  text-decoration: none;
  min-width: 120px;
  justify-content: center;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f8fafc;
  color: #475569;
  border-color: #cbd5e1;
}

.btn-secondary:hover:not(:disabled) {
  background: #e2e8f0;
  border-color: #94a3b8;
  transform: translateY(-1px);
}

.btn-primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border-color: #667eea;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #5a67d8, #6b4598);
  border-color: #5a67d8;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}
</style>
