<template>
  <Teleport
    v-if="show && attachment"
    to="body"
  >
    <div
      class="video-preview-overlay"
      @click="emit('close')"
    >
      <div
        class="video-preview-modal"
        @click.stop
      >
        <div class="video-preview-header">
          <div class="video-preview-title">
            <h3>{{ attachment.filename }}</h3>
            <span class="video-preview-meta">
              {{ formatFileSize(attachment.fileSize || 0) }}
              <span v-if="previewVideoDuration > 0">
                x {{ formatVideoTime(previewVideoDuration) }}
              </span>
            </span>
          </div>
          <div class="video-preview-actions">
            <button
              class="video-preview-btn"
              title="Download"
              @click="downloadPreviewVideo"
            >
              <DownloadIcon />
            </button>
            <button
              class="video-preview-btn"
              title="Fullscreen"
              @click="requestFullscreen"
            >
              <MaximizeIcon />
            </button>
            <button
              class="video-preview-btn close"
              title="Close"
              @click="emit('close')"
            >
              <XIcon />
            </button>
          </div>
        </div>
        <div class="video-preview-content">
          <div class="video-preview-player-wrapper">
            <video
              :ref="(el) => setPreviewVideoRef(el as HTMLVideoElement)"
              :src="attachment.fileUrl"
              class="video-preview-player"
              preload="metadata"
              playsinline
              :muted="previewVideoMuted"
              @play="onPreviewVideoPlay"
              @pause="onPreviewVideoPause"
              @timeupdate="onPreviewVideoTimeUpdate"
              @loadedmetadata="onPreviewVideoLoadedMetadata"
              @ended="onPreviewVideoEnded"
              @click="togglePreviewVideoPlay"
            />
            <!-- Center play button -->
            <div
              v-if="!previewVideoPlaying"
              class="video-preview-play-overlay"
              @click="togglePreviewVideoPlay"
            >
              <button class="video-preview-play-btn-center">
                <PlayIcon :size="48" />
              </button>
            </div>
          </div>
        </div>
        <div class="video-preview-controls">
          <!-- Progress bar -->
          <div class="video-progress-container">
            <input
              type="range"
              class="video-progress-bar"
              :value="previewVideoCurrentTime"
              :max="previewVideoDuration || 100"
              step="0.1"
              @input="seekPreviewVideo"
            >
          </div>
          <!-- Control buttons row -->
          <div class="video-controls-row">
            <div class="video-controls-left">
              <!-- Play/Pause -->
              <button
                class="video-ctrl-btn"
                @click="togglePreviewVideoPlay"
              >
                <PlayIcon
                  v-if="!previewVideoPlaying"
                  :size="20"
                />
                <PauseIcon
                  v-else
                  :size="20"
                />
              </button>
              <!-- Time display -->
              <span class="video-time-display">
                {{ formatVideoTime(previewVideoCurrentTime) }} /
                {{ formatVideoTime(previewVideoDuration) }}
              </span>
            </div>
            <div class="video-controls-right">
              <!-- Volume control -->
              <div class="video-volume-control">
                <button
                  class="video-ctrl-btn"
                  @click="togglePreviewVideoMute"
                >
                  <VolumeMuteIcon
                    v-if="previewVideoMuted"
                    :size="20"
                  />
                  <VolumeIcon
                    v-else
                    :size="20"
                  />
                </button>
                <input
                  type="range"
                  class="video-volume-slider"
                  :value="previewVideoMuted ? 0 : previewVideoVolume"
                  min="0"
                  max="1"
                  step="0.1"
                  @input="changePreviewVideoVolume"
                >
              </div>
              <!-- Playback rate -->
              <div class="video-playback-rate">
                <button
                  class="video-ctrl-btn playback-rate-btn"
                  @click="togglePlaybackRateMenu"
                >
                  {{ previewVideoPlaybackRate }}x
                </button>
                <div
                  v-if="showPlaybackRateMenu"
                  class="playback-rate-menu"
                >
                  <button
                    v-for="rate in [0.5, 0.75, 1, 1.25, 1.5, 2]"
                    :key="rate"
                    class="playback-rate-option"
                    :class="{ active: previewVideoPlaybackRate === rate }"
                    @click="setPreviewVideoPlaybackRate(rate)"
                  >
                    {{ rate }}x
                  </button>
                </div>
              </div>
              <!-- Fullscreen -->
              <button
                class="video-ctrl-btn"
                title="Fullscreen"
                @click="requestFullscreen"
              >
                <MaximizeIcon :size="20" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
  import { watch, onUnmounted } from 'vue'
  import type { FileAttachment } from '@/composables/message'
  import { useVideoPlayer } from '@/composables/message'
  import { formatFileSize } from '@/utils/message'
  import {
    XIcon,
    DownloadIcon,
    MaximizeIcon,
    PlayIcon,
    PauseIcon,
    VolumeIcon,
    VolumeMuteIcon,
  } from '@/components/icons'

  interface Props {
    show: boolean
    attachment: FileAttachment | null
    downloadAttachment?: (_attachment: FileAttachment) => void
  }

  const props = defineProps<Props>()

  const emit = defineEmits<{
    close: []
  }>()

  // Use video player composable with download function
  const {
    previewVideoPlaying,
    previewVideoMuted,
    previewVideoCurrentTime,
    previewVideoDuration,
    previewVideoVolume,
    previewVideoPlaybackRate,
    showPlaybackRateMenu,
    setPreviewVideoRef,
    togglePreviewVideoPlay,
    togglePreviewVideoMute,
    onPreviewVideoPlay,
    onPreviewVideoPause,
    onPreviewVideoTimeUpdate,
    onPreviewVideoLoadedMetadata,
    onPreviewVideoEnded,
    seekPreviewVideo,
    changePreviewVideoVolume,
    setPreviewVideoPlaybackRate,
    togglePlaybackRateMenu,
    formatVideoTime,
    requestFullscreen,
    closeVideoPreview,
  } = useVideoPlayer({
    downloadAttachment: props.downloadAttachment,
  })

  // Download the video
  const downloadPreviewVideo = () => {
    if (props.attachment && props.downloadAttachment) {
      props.downloadAttachment(props.attachment)
    }
  }

  // Clean up when modal closes
  watch(
    () => props.show,
    newShow => {
      if (!newShow) {
        closeVideoPreview()
      }
    }
  )

  // Cleanup on unmount
  onUnmounted(() => {
    closeVideoPreview()
  })
</script>

<style scoped>
  @import '@/styles/components/message-bubble/_video-preview.css';
  @import '@/styles/components/message-bubble/_animations.css';
</style>
