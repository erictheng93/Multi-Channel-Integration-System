/**
 * Message Composables
 *
 * Centralized export for all message-related composables
 *
 * @module composables/message
 */

export { useMessageTime } from './useMessageTime'
export { useMessageAttachment, type FileAttachment, type MessageAttachmentProps } from './useMessageAttachment'
export { useMessageActions, type MessageActionEmitters, type MessageActionsProps } from './useMessageActions'
export { useMessageSticker, type StickerMetadata, type MessageStickerProps } from './useMessageSticker'
export { useMessageContent, type MessageContentProps, type MessageType } from './useMessageContent'
export { useMessageBubble, type MessageBubbleProps } from './useMessageBubble'
export {
  useVideoPlayer,
  type VideoPlayerProps,
  type InlineVideoState,
  type VideoPreviewState,
} from './useVideoPlayer'
