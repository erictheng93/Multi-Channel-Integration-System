<template>
  <div class="conversation-status-banner">
    <!-- 已關閉對話橫幅 -->
    <ClosedConversationBanner
      v-if="isClosed"
      @reopen="$emit('reopen-conversation')"
    />

    <!-- 拖放上傳覆蓋層 -->
    <DragDropOverlay
      :is-visible="isDragging"
      @drop="handleFileDrop"
    />

    <!-- 新訊息通知浮動按鈕 -->
    <NewMessageNotification
      :new-message-count="newMessageCount ?? 0"
      @click="$emit('scroll-to-bottom')"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * ConversationStatusBanner - 對話狀態橫幅組件
 *
 * 這是一個容器組件，整合所有對話狀態相關的 UI 提示：
 * - ClosedConversationBanner: 對話關閉時顯示
 * - DragDropOverlay: 拖放檔案時顯示
 * - NewMessageNotification: 有新訊息時顯示
 *
 * 使用示例：
 * <ConversationStatusBanner
 *   :is-closed="conversation.status === 'closed'"
 *   :is-dragging="isDraggingFiles"
 *   :new-message-count="5"
 *   @reopen-conversation="handleReopenConversation"
 *   @file-drop="handleFileUpload"
 *   @scroll-to-bottom="scrollToBottom"
 * />
 */

import { ref, onMounted, onUnmounted } from 'vue'
import ClosedConversationBanner from './banners/ClosedConversationBanner.vue'
import DragDropOverlay from './banners/DragDropOverlay.vue'
import NewMessageNotification from './banners/NewMessageNotification.vue'

// ===== Props =====
const props = defineProps<{
  /** 對話是否已關閉 */
  isClosed: boolean
  /** 是否正在拖拽檔案 */
  isDragging?: boolean
  /** 新訊息數量 */
  newMessageCount?: number
}>()

// ===== Emits =====
const emit = defineEmits<{
  /** 重新打開對話 */
  'reopen-conversation': []
  /** 檔案拖放 */
  'file-drop': [files: File[]]
  /** 滾動到底部 */
  'scroll-to-bottom': []
  /** 拖拽狀態變化 */
  'drag-state-change': [isDragging: boolean]
}>()

// ===== State =====
const isDragging = ref(props.isDragging || false)
let dragCounter = 0 // 追蹤拖拽進入/離開次數

// ===== Methods =====

/**
 * 處理檔案拖放
 */
function handleFileDrop(event: DragEvent) {
  isDragging.value = false
  dragCounter = 0

  const files = Array.from(event.dataTransfer?.files || [])
  if (files.length > 0) {
    emit('file-drop', files)
  }
}

/**
 * 處理拖拽進入
 */
function handleDragEnter(event: DragEvent) {
  event.preventDefault()
  dragCounter++

  // 只在第一次進入時更新狀態
  if (dragCounter === 1) {
    isDragging.value = true
    emit('drag-state-change', true)
  }
}

/**
 * 處理拖拽離開
 */
function handleDragLeave(event: DragEvent) {
  event.preventDefault()
  dragCounter--

  // 只在完全離開時更新狀態
  if (dragCounter === 0) {
    isDragging.value = false
    emit('drag-state-change', false)
  }
}

/**
 * 處理拖拽經過
 */
function handleDragOver(event: DragEvent) {
  event.preventDefault()
}

// ===== Lifecycle =====

onMounted(() => {
  // 添加全局拖拽事件監聽
  document.addEventListener('dragenter', handleDragEnter)
  document.addEventListener('dragleave', handleDragLeave)
  document.addEventListener('dragover', handleDragOver)
  document.addEventListener('drop', handleFileDrop)
})

onUnmounted(() => {
  // 清理事件監聽
  document.removeEventListener('dragenter', handleDragEnter)
  document.removeEventListener('dragleave', handleDragLeave)
  document.removeEventListener('dragover', handleDragOver)
  document.removeEventListener('drop', handleFileDrop)
})
</script>

<style scoped>
.conversation-status-banner {
  /* 這個組件主要作為容器，子組件有各自的定位 */
  position: relative;
}
</style>
