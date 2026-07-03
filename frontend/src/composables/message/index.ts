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
export { useRecallCountdown, type RecallCountdown } from './useRecallCountdown'
export {
  useVideoPlayer,
  type VideoPlayerProps,
  type InlineVideoState,
  type VideoPreviewState,
} from './useVideoPlayer'

// VirtualMessageList composables
export {
  useVirtualScroll,
  type UseVirtualScrollOptions,
} from './useVirtualScroll'
export {
  useVirtualList,
  type VirtualItem,
  type UseVirtualListProps,
  type UseVirtualListOptions,
} from './useVirtualList'
export {
  useScrollEventHandlers,
  type UseScrollEventHandlersProps,
  type UseScrollEventHandlersOptions,
} from './useScrollEventHandlers'
export {
  useResizeObserver,
  type UseResizeObserverOptions,
} from './useResizeObserver'
export {
  useScrollWatchers,
  type UseScrollWatchersProps,
  type UseScrollWatchersOptions,
} from './useScrollWatchers'
