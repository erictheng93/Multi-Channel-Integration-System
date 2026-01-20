<template>
  <div class="message-media attachment-video">
    <div class="video-container">
      <video
        :ref="(el) => setVideoRef(el as HTMLVideoElement, attachment.id)"
        :src="attachment.fileUrl"
        class="video-player"
        preload="metadata"
        playsinline
        :muted="videoMuted[attachment.id] !== false"
        @play="onVideoPlay(attachment.id)"
        @pause="onVideoPause(attachment.id)"
        @ended="onVideoEnded(attachment.id)"
      />
      <!-- Control overlay -->
      <div
        class="video-controls-overlay"
        :class="{ 'is-playing': videoPlaying[attachment.id] }"
        @click="$emit('preview', attachment)"
      >
        <button
          class="video-play-btn-center"
          @click.stop="toggleVideoPlay(attachment.id)"
        >
          <PlayIcon
            v-if="!videoPlaying[attachment.id]"
            :size="32"
          />
          <PauseIcon
            v-else
            :size="32"
          />
        </button>
        <div
          class="video-controls-bar"
          @click.stop
        >
          <button
            class="video-control-btn"
            @click.stop="toggleVideoPlay(attachment.id)"
          >
            <PlayIcon
              v-if="!videoPlaying[attachment.id]"
              :size="16"
            />
            <PauseIcon
              v-else
              :size="16"
            />
          </button>
          <button
            class="video-control-btn"
            @click.stop="toggleVideoMute(attachment.id)"
          >
            <VolumeMuteIcon
              v-if="videoMuted[attachment.id] !== false"
              :size="16"
            />
            <VolumeIcon
              v-else
              :size="16"
            />
          </button>
          <button
            class="video-control-btn download-btn"
            @click.stop="$emit('download', attachment)"
          >
            <DownloadIcon :size="16" />
          </button>
        </div>
      </div>
    </div>
    <!-- Video attachment status indicator -->
    <div
      v-if="showStatus"
      class="attachment-status-indicator video-status"
      :class="statusClass"
    >
      <template v-if="isPending">
        <span class="status-spinner" />
        <span class="status-text">Uploading...</span>
      </template>
      <template v-else-if="isFailed">
        <span class="status-icon failed">x</span>
        <span class="status-text failed">Failed</span>
      </template>
      <template v-else>
        <span class="status-icon success">OK</span>
        <span class="status-text success">Sent</span>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import type { FileAttachment } from '@/composables/message'
  import { useVideoPlayer } from '@/composables/message'
  import {
    PlayIcon,
    PauseIcon,
    VolumeIcon,
    VolumeMuteIcon,
    DownloadIcon,
  } from '@/components/icons'
  import { MESSAGE_STATUS } from '@/constants/message-status'

  interface Props {
    attachment: FileAttachment
    messageStatus?: string
    showStatus?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    messageStatus: '',
    showStatus: true,
  })

  defineEmits<{
    preview: [attachment: FileAttachment]
    download: [attachment: FileAttachment]
  }>()

  // Use video player composable
  const {
    videoPlaying,
    videoMuted,
    setVideoRef,
    toggleVideoPlay,
    toggleVideoMute,
    onVideoPlay,
    onVideoPause,
    onVideoEnded,
  } = useVideoPlayer()

  // Computed status properties
  const isPending = computed(() => {
    return props.messageStatus === MESSAGE_STATUS.PENDING || props.messageStatus === 'sending'
  })

  const isFailed = computed(() => {
    return props.messageStatus === MESSAGE_STATUS.FAILED
  })

  const statusClass = computed(() => {
    if (isPending.value) {
      return 'status-pending'
    }
    if (isFailed.value) {
      return 'status-failed'
    }
    return 'status-success'
  })
</script>

<style scoped>
  @import '@/styles/components/message-bubble/_video-inline.css';
  @import '@/styles/components/message-bubble/_status.css';
  @import '@/styles/components/message-bubble/_animations.css';
</style>
