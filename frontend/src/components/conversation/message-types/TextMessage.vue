<template>
  <div class="text-message">
    <SafeHtmlRenderer
      :html="processedContent"
      class="message-text"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import type { Message } from '@/types'
import { renderDatabaseMessageForVue } from '@/utils/enhanced-message-renderer'
import { convertEmojiForMessageDetail } from '@/utils/layered-emoji-processor'
import SafeHtmlRenderer from '@/components/ui/SafeHtmlRenderer.vue'

/**
 * TextMessage Component
 *
 * Renders text-based messages with:
 * - HTML rendering (safe)
 * - Emoji processing
 * - Link detection and formatting
 * - Markdown-like formatting
 *
 * @component
 */

interface Props {
  /** The message object to display */
  message: Message
  /** Whether this is an outgoing message */
  isOutgoing?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isOutgoing: false
})

// ═══════════════════════════════════════════════════════════════
// Content Processing
// ═══════════════════════════════════════════════════════════════

const processedContent = ref('')
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// Content cache for performance optimization
const contentCache = new Map<string, string>()

/**
 * Process message content with enhanced rendering and emoji conversion
 */
const processMessageContent = async () => {
  const content = props.message.content || ''
  const cacheKey = `${content}_${props.message.messageType}`

  // Check cache first
  if (contentCache.has(cacheKey)) {
    processedContent.value = contentCache.get(cacheKey)!
    return
  }

  // Debounce rapid updates
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }

  debounceTimer = setTimeout(async () => {
    try {
      // Step 1: Render database message (handles LINE formatting, links, etc.)
      let rendered = await renderDatabaseMessageForVue(
        content,
        props.message.messageType,
        typeof props.message.metadata === 'string' ? props.message.metadata : JSON.stringify(props.message.metadata)
      )

      // Step 2: Convert emojis to appropriate format
      rendered = await convertEmojiForMessageDetail(rendered)

      // Cache the result
      contentCache.set(cacheKey, rendered)
      processedContent.value = rendered
    } catch (error) {
      console.error('Error processing message content:', error)
      // Fallback to raw content
      processedContent.value = content
    }
  }, 50) // 50ms debounce
}

// Watch for message content changes
watch(
  () => ({
    content: props.message.content,
    messageType: props.message.messageType,
    metadata: props.message.metadata
  }),
  (newValue, oldValue) => {
    // Only re-process if content actually changed
    if (!oldValue ||
        newValue.content !== oldValue.content ||
        newValue.messageType !== oldValue.messageType ||
        JSON.stringify(newValue.metadata) !== JSON.stringify(oldValue.metadata)) {
      processMessageContent()
    }
  },
  { immediate: true, deep: true }
)

// Cleanup on unmount
onUnmounted(() => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  contentCache.clear()
})
</script>

<style scoped>
.text-message {
  width: 100%;
}

.message-text {
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: pre-wrap;
  line-height: 1.5;
}

/* Link styling within text messages */
.message-text :deep(a) {
  color: #3b82f6;
  text-decoration: underline;
  transition: color 0.2s ease;
}

.message-text :deep(a:hover) {
  color: #2563eb;
}

/* Emoji sizing */
.message-text :deep(img.emoji) {
  width: 1.2em;
  height: 1.2em;
  vertical-align: middle;
  display: inline-block;
}

/* Code blocks */
.message-text :deep(code) {
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.9em;
}

/* Bold text */
.message-text :deep(strong),
.message-text :deep(b) {
  font-weight: 600;
}

/* Italic text */
.message-text :deep(em),
.message-text :deep(i) {
  font-style: italic;
}
</style>
