<template>
  <div
    v-if="visible"
    class="modal-overlay"
  >
    <div
      class="modal"
      @click.stop
    >
      <!-- Header -->
      <div class="modal-header">
        <h2>團隊 QR Code</h2>
        <button
          class="close-btn"
          @click="handleClose"
        >
          &times;
        </button>
      </div>

      <!-- Body -->
      <div class="modal-body">
        <!-- Team Info -->
        <div
          v-if="team"
          class="team-info"
        >
          <h3>{{ team.name }}</h3>
          <p v-if="team.description">
            {{ team.description }}
          </p>
        </div>

        <!-- QR Code Display -->
        <div class="qr-code-container">
          <!-- Loading State -->
          <div
            v-if="imageLoading"
            class="qr-loading"
          >
            <div class="spinner" />
            <p>載入 QR Code 中...</p>
          </div>

          <!-- QR Code Image -->
          <img
            v-else-if="qrCode"
            :src="qrCode"
            alt="Team QR Code"
            class="qr-code-image"
          >

          <!-- Error State -->
          <div
            v-else
            class="qr-error"
          >
            <p>QR Code 暫時無法顯示</p>
            <small>請稍後再試</small>
          </div>
        </div>

        <!-- Instructions -->
        <div class="instructions">
          <h4>使用說明</h4>
          <ol>
            <li>使用 LINE App 掃描此 QR Code</li>
            <li>加入此團隊的官方帳號</li>
            <li>開始接收訊息並與客服互動</li>
          </ol>
        </div>
      </div>

      <!-- Actions -->
      <div class="modal-actions">
        <button
          type="button"
          class="btn btn-secondary"
          @click="handleClose"
        >
          關閉
        </button>
        <button
          v-if="qrCode && !imageLoading"
          type="button"
          class="btn btn-primary"
          @click="handleDownload"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line
              x1="12"
              y1="15"
              x2="12"
              y2="3"
            />
          </svg>
          下載 QR Code
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Team } from '@/composables/team-management'

interface Props {
  visible: boolean
  team: Team | null
  qrCode: string
  imageLoading: boolean
}

interface Emits {
  (e: 'close'): void
  (e: 'download'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

function handleClose() {
  emit('close')
}

function handleDownload() {
  emit('download')
}
</script>

<style scoped>
/* Modal Overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

/* Modal Container */
.modal {
  background: white;
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

/* Modal Header */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #1f2937;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  line-height: 1;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

/* Modal Body */
.modal-body {
  padding: 1.5rem;
}

/* Team Info */
.team-info {
  text-align: center;
  margin-bottom: 1.5rem;
}

.team-info h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.125rem;
  font-weight: 700;
  color: #1f2937;
}

.team-info p {
  margin: 0;
  font-size: 0.875rem;
  color: #6b7280;
}

/* QR Code Container */
.qr-code-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  padding: 2rem;
}

.qr-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e5e7eb;
  border-top-color: #10b981;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.qr-loading p {
  margin: 0;
  font-size: 0.875rem;
  color: #6b7280;
}

.qr-code-image {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.qr-error {
  text-align: center;
}

.qr-error p {
  margin: 0 0 0.5rem 0;
  font-size: 0.875rem;
  color: #6b7280;
}

.qr-error small {
  font-size: 0.75rem;
  color: #9ca3af;
}

/* Instructions */
.instructions {
  background: #f0fdf4;
  border-left: 4px solid #10b981;
  padding: 1rem 1.25rem;
  border-radius: 6px;
}

.instructions h4 {
  margin: 0 0 0.75rem 0;
  font-size: 0.875rem;
  font-weight: 700;
  color: #065f46;
}

.instructions ol {
  margin: 0;
  padding-left: 1.25rem;
}

.instructions li {
  font-size: 0.875rem;
  color: #047857;
  line-height: 1.6;
  margin-bottom: 0.5rem;
}

.instructions li:last-child {
  margin-bottom: 0;
}

/* Modal Actions */
.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

/* Buttons */
.btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn svg {
  width: 16px;
  height: 16px;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-primary {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

/* Responsive */
@media (max-width: 640px) {
  .modal {
    max-width: 100%;
    border-radius: 12px 12px 0 0;
    margin-top: auto;
  }

  .modal-header,
  .modal-body,
  .modal-actions {
    padding: 1rem;
  }

  .qr-code-container {
    min-height: 250px;
    padding: 1.5rem;
  }

  .modal-actions {
    flex-direction: column-reverse;
  }

  .btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
