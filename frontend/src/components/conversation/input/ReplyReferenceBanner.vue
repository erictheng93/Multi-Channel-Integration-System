<template>
  <div class="reply-reference">
    <div class="reply-content">
      <div class="reply-header">
        <span class="reply-label">回覆</span>
        <span class="reply-sender">{{ replyToMessage.senderName }}</span>
      </div>
      <div class="reply-text">
        {{ replyToMessage.content }}
      </div>
    </div>
    <button
      class="reply-close"
      @click="$emit('clear-reply')"
    >
      <XIcon />
    </button>
  </div>
</template>

<script setup lang="ts">
  import { XIcon } from '@/components/icons'

  defineProps<{
    replyToMessage: { content: string; senderName: string }
  }>()

  defineEmits<{
    'clear-reply': []
  }>()
</script>

<style scoped>
  .reply-reference {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(59, 130, 246, 0.05));
    border: 1px solid rgba(99, 102, 241, 0.15);
    border-radius: 16px 16px 0 0;
    padding: 16px 20px;
    margin-bottom: -1px;
    position: relative;
    overflow: hidden;
  }

  .reply-reference::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: linear-gradient(180deg, #6366f1, #3b82f6);
    border-radius: 0 2px 2px 0;
  }

  .reply-content {
    flex: 1;
    min-width: 0;
    padding-left: 12px;
  }

  .reply-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .reply-label {
    font-size: 11px;
    font-weight: 600;
    color: #6366f1;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    padding: 2px 8px;
    background: rgba(99, 102, 241, 0.1);
    border-radius: 12px;
    border: 1px solid rgba(99, 102, 241, 0.2);
  }

  .reply-sender {
    font-size: 14px;
    font-weight: 600;
    color: #4338ca;
    opacity: 0.9;
  }

  .reply-text {
    font-size: 14px;
    color: #475569;
    line-height: 1.5;
    max-height: 42px;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    opacity: 0.8;
    font-weight: 400;
  }

  .reply-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: rgba(71, 85, 105, 0.05);
    color: #64748b;
    cursor: pointer;
    border-radius: 14px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    margin-left: 12px;
    flex-shrink: 0;
    backdrop-filter: blur(8px);
  }

  .reply-close:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
    transform: scale(1.05);
  }

  .reply-close:active {
    transform: scale(0.95);
  }

  .reply-close svg {
    width: 16px;
    height: 16px;
    transition: transform 0.2s ease;
  }

  .reply-close:hover svg {
    transform: rotate(90deg);
  }

  /* Responsive: tablet */
  @media (max-width: 768px) {
    .reply-reference {
      padding: 12px 16px;
      border-radius: 14px 14px 0 0;
    }

    .reply-content {
      padding-left: 8px;
    }

    .reply-header {
      gap: 6px;
      margin-bottom: 4px;
    }

    .reply-label {
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 10px;
    }

    .reply-sender {
      font-size: 13px;
    }

    .reply-text {
      font-size: 13px;
      max-height: 36px;
    }

    .reply-close {
      width: 24px;
      height: 24px;
      border-radius: 12px;
      margin-left: 8px;
    }

    .reply-close svg {
      width: 14px;
      height: 14px;
    }
  }
</style>
