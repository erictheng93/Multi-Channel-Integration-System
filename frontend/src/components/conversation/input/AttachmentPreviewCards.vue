<template>
  <div class="attachments-preview">
    <div
      v-for="(attachment, index) in attachments"
      :key="index"
      class="attachment-card"
    >
      <!-- 圖片預覽 -->
      <div
        v-if="attachment.isImage && attachment.blobUrl"
        class="attachment-thumbnail"
      >
        <img
          :src="attachment.blobUrl"
          :alt="attachment.name"
          class="thumbnail-image"
        >
      </div>
      <!-- 非圖片檔案圖標 -->
      <div
        v-else
        class="attachment-icon"
        :style="{ backgroundColor: attachment.typeColor + '15' }"
      >
        <FileIcon :style="{ color: attachment.typeColor }" />
      </div>

      <!-- 檔案資訊 -->
      <div class="attachment-details">
        <div class="attachment-name-row">
          <span class="attachment-name">{{ attachment.name }}</span>
          <button
            class="remove-attachment"
            type="button"
            title="移除附件"
            @click="$emit('remove-attachment', index)"
          >
            <XIcon />
          </button>
        </div>
        <div class="attachment-meta">
          <span
            class="attachment-type"
            :style="{ color: attachment.typeColor }"
          >
            {{ attachment.fileType }}
          </span>
          <span class="attachment-size">{{ formatFileSize(attachment.size) }}</span>
          <span class="attachment-status">待發送</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { FileIcon, XIcon } from '@/components/icons'
  import { useFileTypeDetection } from '@/composables/message-input/useFileTypeDetection'
  import type { MessageInputAttachment } from '@/types/message-input'

  defineProps<{
    attachments: MessageInputAttachment[]
  }>()

  defineEmits<{
    'remove-attachment': [index: number]
  }>()

  const { formatFileSize } = useFileTypeDetection()
</script>

<style scoped>
  /* Phase 3A: 增強附件預覽卡片樣式 */
  .attachments-preview {
    margin-top: var(--space-3);
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .attachment-card {
    display: flex;
    align-items: stretch;
    width: calc(50% - var(--space-2));
    min-width: 200px;
    max-width: 300px;
    background: white;
    border: 1px solid var(--gray-200);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    transition: all 0.2s ease;
  }

  .attachment-card:hover {
    border-color: var(--gray-300);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  .attachment-thumbnail {
    width: 72px;
    height: 72px;
    flex-shrink: 0;
    background: var(--gray-100);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .thumbnail-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .attachment-icon {
    width: 72px;
    height: 72px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .attachment-icon svg {
    width: 28px;
    height: 28px;
  }

  .attachment-details {
    flex: 1;
    min-width: 0;
    padding: var(--space-2) var(--space-3);
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
  }

  .attachment-name-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .attachment-name {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--gray-900);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .attachment-meta {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: 0.6875rem;
  }

  .attachment-type {
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .attachment-size {
    color: var(--gray-500);
  }

  .attachment-status {
    color: var(--gray-400);
    padding-left: var(--space-2);
    border-left: 1px solid var(--gray-200);
  }

  .remove-attachment {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    background: none;
    color: var(--gray-400);
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .remove-attachment:hover {
    background: var(--red-100);
    color: var(--red-600);
  }

  .remove-attachment svg {
    width: 12px;
    height: 12px;
  }

  /* Responsive: tablet */
  @media (max-width: 768px) {
    .attachments-preview {
      margin-top: var(--space-2);
      gap: var(--space-2);
    }

    .attachment-card {
      width: 100%;
      max-width: none;
      min-width: 0;
    }

    .attachment-thumbnail,
    .attachment-icon {
      width: 56px;
      height: 56px;
    }

    .attachment-icon svg {
      width: 22px;
      height: 22px;
    }

    .attachment-details {
      padding: var(--space-2);
    }

    .attachment-name {
      font-size: 0.75rem;
    }

    .attachment-meta {
      font-size: 0.625rem;
    }
  }

  /* Touch devices */
  @media (pointer: coarse) {
    .remove-attachment {
      min-width: 32px;
      min-height: 32px;
    }
  }
</style>
