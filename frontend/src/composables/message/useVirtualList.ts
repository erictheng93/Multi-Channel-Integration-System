/**
 * Virtual List Composable
 *
 * Handles virtualizer setup (@tanstack/vue-virtual), displayedMessages
 * computed with search filtering, and virtualItems computed with date
 * separator insertion.
 *
 * @module composables/message/useVirtualList
 */

import { computed, type Ref } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import type { Message } from '@/types'

/**
 * Represents an item in the virtual list (message, date separator, or typing indicator).
 */
export interface VirtualItem {
  type: 'message' | 'date' | 'typing'
  data: Message | Date
  id: string
}

/**
 * Props required by useVirtualList composable
 */
export interface UseVirtualListProps {
  messages: Message[]
  displayedMessages?: Message[]
  isSearchActive?: boolean
  searchTerm?: string
  showDateSeparators?: boolean
}

/**
 * Options for useVirtualList composable
 */
export interface UseVirtualListOptions {
  props: UseVirtualListProps
  scrollContainer: Ref<HTMLElement | undefined>
}

/**
 * Composable for managing the virtual list setup.
 *
 * Provides:
 * - displayedMessages computed (with search filtering)
 * - virtualItems computed (with date separator insertion)
 * - virtualizer instance from @tanstack/vue-virtual
 *
 * @param options - Configuration options
 * @returns Virtual list state and computed values
 */
export function useVirtualList(options: UseVirtualListOptions) {
  const { props, scrollContainer } = options

  /**
   * Computed displayed messages with search filtering.
   * Uses provided displayedMessages prop if available, otherwise
   * filters messages based on search term.
   */
  const displayedMessages = computed(() => {
    if (props.displayedMessages) {
      return props.displayedMessages
    }

    if (props.isSearchActive && props.searchTerm) {
      return props.messages.filter(msg =>
        msg.content.toLowerCase().includes((props.searchTerm ?? '').toLowerCase())
      )
    }
    return props.messages
  })

  /**
   * Computed virtual items with date separator insertion.
   * Inserts date separator items between messages from different dates
   * when showDateSeparators is enabled.
   */
  const virtualItems = computed<VirtualItem[]>(() => {
    const items: VirtualItem[] = []

    if (props.showDateSeparators) {
      let currentDate = ''

      displayedMessages.value.forEach((message) => {
        const messageDate = new Date(message.createdAt).toDateString()

        if (messageDate !== currentDate) {
          currentDate = messageDate
          items.push({
            type: 'date',
            data: new Date(message.createdAt),
            id: `date-${messageDate}`
          })
        }

        items.push({
          type: 'message',
          data: message,
          id: `message-${message.id}`
        })
      })
    } else {
      displayedMessages.value.forEach((message) => {
        items.push({
          type: 'message',
          data: message,
          id: `message-${message.id}`
        })
      })
    }

    return items
  })

  /**
   * Virtualizer instance from @tanstack/vue-virtual.
   * Configured with dynamic measurement and overscan for smooth scrolling.
   */
  const virtualizer = useVirtualizer({
    get count() { return virtualItems.value.length },
    getScrollElement: () => scrollContainer.value || null,
    estimateSize: () => 100,
    overscan: 5,
    measureElement: (element) => element?.getBoundingClientRect().height || 100,
  })

  return {
    displayedMessages,
    virtualItems,
    virtualizer,
  }
}
