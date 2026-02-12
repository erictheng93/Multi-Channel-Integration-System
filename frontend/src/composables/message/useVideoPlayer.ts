/**
 * useVideoPlayer Composable
 *
 * Manages video playback state for both inline video players and preview modals.
 * Handles play/pause, mute, volume, playback rate, and fullscreen controls.
 *
 * @module composables/message/useVideoPlayer
 */

import { ref, type Ref } from 'vue'
import type { FileAttachment } from './useMessageAttachment'

/**
 * Props for the useVideoPlayer composable
 */
export interface VideoPlayerProps {
  /** Optional download function for video attachments */
  downloadAttachment?: (_attachment: FileAttachment) => void
}

/**
 * State for inline video players (multiple videos per message)
 */
export interface InlineVideoState {
  videoPlaying: Ref<Record<string, boolean>>
  videoMuted: Ref<Record<string, boolean>>
  videoRefs: Ref<Record<string, HTMLVideoElement | null>>
}

/**
 * State for video preview modal
 */
export interface VideoPreviewState {
  showVideoPreview: Ref<boolean>
  previewVideoAttachment: Ref<FileAttachment | null>
  previewVideoRef: Ref<HTMLVideoElement | null>
  previewVideoPlaying: Ref<boolean>
  previewVideoMuted: Ref<boolean>
  previewVideoCurrentTime: Ref<number>
  previewVideoDuration: Ref<number>
  previewVideoVolume: Ref<number>
  previewVideoPlaybackRate: Ref<number>
  showPlaybackRateMenu: Ref<boolean>
}

/**
 * Video player composable for managing video playback state
 *
 * @param props - Optional configuration props
 * @returns Video player state and methods
 */
export function useVideoPlayer(props?: VideoPlayerProps) {
  // ===== Inline Video Player State =====
  const videoPlaying = ref<Record<string, boolean>>({})
  const videoMuted = ref<Record<string, boolean>>({})
  const videoRefs = ref<Record<string, HTMLVideoElement | null>>({})

  // ===== Inline Video Methods =====

  /**
   * Set video element reference for an attachment
   */
  const setVideoRef = (el: HTMLVideoElement | null, attachmentId: string) => {
    videoRefs.value[attachmentId] = el
  }

  /**
   * Toggle play/pause for inline video
   */
  const toggleVideoPlay = (attachmentId: string) => {
    const video = videoRefs.value[attachmentId]
    if (!video) {
      return
    }

    if (video.paused) {
      video.play()
      videoPlaying.value[attachmentId] = true
    } else {
      video.pause()
      videoPlaying.value[attachmentId] = false
    }
  }

  /**
   * Toggle mute for inline video
   */
  const toggleVideoMute = (attachmentId: string) => {
    const video = videoRefs.value[attachmentId]
    if (!video) {
      return
    }

    video.muted = !video.muted
    videoMuted.value[attachmentId] = video.muted
  }

  /**
   * Handle video play event
   */
  const onVideoPlay = (attachmentId: string) => {
    videoPlaying.value[attachmentId] = true
  }

  /**
   * Handle video pause event
   */
  const onVideoPause = (attachmentId: string) => {
    videoPlaying.value[attachmentId] = false
  }

  /**
   * Handle video ended event
   */
  const onVideoEnded = (attachmentId: string) => {
    videoPlaying.value[attachmentId] = false
  }

  // ===== Video Preview Modal State =====
  const showVideoPreview = ref(false)
  const previewVideoAttachment = ref<FileAttachment | null>(null)
  const previewVideoRef = ref<HTMLVideoElement | null>(null)
  const previewVideoPlaying = ref(false)
  const previewVideoMuted = ref(true)
  const previewVideoCurrentTime = ref(0)
  const previewVideoDuration = ref(0)
  const previewVideoVolume = ref(1)
  const previewVideoPlaybackRate = ref(1)
  const showPlaybackRateMenu = ref(false)

  // ===== Video Preview Methods =====

  /**
   * Open video preview modal
   */
  const openVideoPreview = (attachment: FileAttachment) => {
    previewVideoAttachment.value = attachment
    showVideoPreview.value = true
    previewVideoPlaying.value = false
    previewVideoMuted.value = true
    previewVideoCurrentTime.value = 0
    previewVideoDuration.value = 0
    previewVideoPlaybackRate.value = 1
    showPlaybackRateMenu.value = false
  }

  /**
   * Close video preview modal
   */
  const closeVideoPreview = () => {
    if (previewVideoRef.value) {
      previewVideoRef.value.pause()
    }
    showVideoPreview.value = false
    previewVideoAttachment.value = null
    previewVideoPlaying.value = false
  }

  /**
   * Set preview video element reference
   */
  const setPreviewVideoRef = (el: HTMLVideoElement | null) => {
    previewVideoRef.value = el
  }

  /**
   * Toggle play/pause for preview video
   */
  const togglePreviewVideoPlay = () => {
    if (!previewVideoRef.value) {
      return
    }

    if (previewVideoRef.value.paused) {
      previewVideoRef.value.play()
    } else {
      previewVideoRef.value.pause()
    }
  }

  /**
   * Toggle mute for preview video
   */
  const togglePreviewVideoMute = () => {
    if (!previewVideoRef.value) {
      return
    }

    previewVideoRef.value.muted = !previewVideoRef.value.muted
    previewVideoMuted.value = previewVideoRef.value.muted
  }

  /**
   * Handle preview video play event
   */
  const onPreviewVideoPlay = () => {
    previewVideoPlaying.value = true
  }

  /**
   * Handle preview video pause event
   */
  const onPreviewVideoPause = () => {
    previewVideoPlaying.value = false
  }

  /**
   * Handle preview video time update event
   */
  const onPreviewVideoTimeUpdate = () => {
    if (previewVideoRef.value) {
      previewVideoCurrentTime.value = previewVideoRef.value.currentTime
    }
  }

  /**
   * Handle preview video loaded metadata event
   */
  const onPreviewVideoLoadedMetadata = () => {
    if (previewVideoRef.value) {
      previewVideoDuration.value = previewVideoRef.value.duration
    }
  }

  /**
   * Handle preview video ended event
   */
  const onPreviewVideoEnded = () => {
    previewVideoPlaying.value = false
  }

  /**
   * Seek to a position in the preview video
   */
  const seekPreviewVideo = (event: Event) => {
    const target = event.target as HTMLInputElement
    if (previewVideoRef.value) {
      previewVideoRef.value.currentTime = Number(target.value)
    }
  }

  /**
   * Change preview video volume
   */
  const changePreviewVideoVolume = (event: Event) => {
    const target = event.target as HTMLInputElement
    if (previewVideoRef.value) {
      previewVideoRef.value.volume = Number(target.value)
      previewVideoVolume.value = Number(target.value)
      previewVideoMuted.value = Number(target.value) === 0
    }
  }

  /**
   * Set preview video playback rate
   */
  const setPreviewVideoPlaybackRate = (rate: number) => {
    if (previewVideoRef.value) {
      previewVideoRef.value.playbackRate = rate
      previewVideoPlaybackRate.value = rate
    }
    showPlaybackRateMenu.value = false
  }

  /**
   * Toggle playback rate menu visibility
   */
  const togglePlaybackRateMenu = () => {
    showPlaybackRateMenu.value = !showPlaybackRateMenu.value
  }

  /**
   * Format time in seconds to MM:SS string
   */
  const formatVideoTime = (seconds: number): string => {
    if (isNaN(seconds) || !isFinite(seconds)) {
      return '00:00'
    }
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  /**
   * Request fullscreen for preview video
   */
  const requestFullscreen = () => {
    if (previewVideoRef.value) {
      if (previewVideoRef.value.requestFullscreen) {
        previewVideoRef.value.requestFullscreen()
      }
    }
  }

  /**
   * Download the preview video
   */
  const downloadPreviewVideo = () => {
    if (previewVideoAttachment.value && props?.downloadAttachment) {
      props.downloadAttachment(previewVideoAttachment.value)
    }
  }

  return {
    // Inline video state
    videoPlaying,
    videoMuted,
    videoRefs,

    // Inline video methods
    setVideoRef,
    toggleVideoPlay,
    toggleVideoMute,
    onVideoPlay,
    onVideoPause,
    onVideoEnded,

    // Preview video state
    showVideoPreview,
    previewVideoAttachment,
    previewVideoRef,
    previewVideoPlaying,
    previewVideoMuted,
    previewVideoCurrentTime,
    previewVideoDuration,
    previewVideoVolume,
    previewVideoPlaybackRate,
    showPlaybackRateMenu,

    // Preview video methods
    openVideoPreview,
    closeVideoPreview,
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
    downloadPreviewVideo,
  }
}
