<template>
  <div 
    ref="containerRef"
    class="virtual-list-container"
    :style="{ height: containerHeight + 'px' }"
    @scroll="handleScroll"
  >
    <div 
      class="virtual-list-spacer"
      :style="{ height: totalHeight + 'px' }"
    >
      <div 
        class="virtual-list-items"
        :style="{ transform: `translateY(${offsetY}px)` }"
      >
        <div
          v-for="item in visibleItems"
          :key="getItemKey(item)"
          class="virtual-list-item"
          :style="{ height: itemHeight + 'px' }"
        >
          <slot
            :item="item.data"
            :index="item.index"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T">
import { ref, computed, watch } from 'vue'

interface Props {
  items: T[]
  itemHeight: number
  containerHeight: number
  overscan?: number
  keyField?: string
}

interface VisibleItem<T> {
  data: T
  index: number
}

const props = withDefaults(defineProps<Props>(), {
  overscan: 5,
  keyField: 'id'
})

const containerRef = ref<HTMLElement>()
const scrollTop = ref(0)

// Computed properties
const totalHeight = computed(() => props.items.length * props.itemHeight)

const visibleRange = computed(() => {
  const start = Math.floor(scrollTop.value / props.itemHeight)
  const end = Math.min(
    start + Math.ceil(props.containerHeight / props.itemHeight),
    props.items.length
  )
  
  return {
    start: Math.max(0, start - props.overscan),
    end: Math.min(props.items.length, end + props.overscan)
  }
})

const visibleItems = computed((): VisibleItem<T>[] => {
  const { start, end } = visibleRange.value
  const items: VisibleItem<T>[] = []
  
  for (let i = start; i < end; i++) {
    const item = props.items[i]
    if (item !== undefined) {
      items.push({
        data: item,
        index: i
      })
    }
  }
  
  return items
})

const offsetY = computed(() => visibleRange.value.start * props.itemHeight)

// Methods
const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement
  scrollTop.value = target.scrollTop
}

const getItemKey = (item: VisibleItem<T>): string | number => {
  if (props.keyField && item.data && typeof item.data === 'object' && props.keyField in item.data) {
    const keyValue = (item.data as Record<string, unknown>)[props.keyField]
    if (typeof keyValue === 'string' || typeof keyValue === 'number') {
      return keyValue
    }
  }
  return item.index
}

const scrollToIndex = (index: number) => {
  if (!containerRef.value) {return}
  
  const targetScrollTop = index * props.itemHeight
  containerRef.value.scrollTop = targetScrollTop
}

const scrollToTop = () => {
  if (!containerRef.value) {return}
  containerRef.value.scrollTop = 0
}

const scrollToBottom = () => {
  if (!containerRef.value) {return}
  containerRef.value.scrollTop = totalHeight.value
}

// Watch for items changes and maintain scroll position
watch(() => props.items.length, (newLength, oldLength) => {
  if (newLength > oldLength && containerRef.value) {
    // If items were added, maintain relative scroll position
    const wasAtBottom = scrollTop.value + props.containerHeight >= totalHeight.value - 100
    if (wasAtBottom) {
      // Auto-scroll to bottom if user was near bottom
      setTimeout(() => scrollToBottom(), 0)
    }
  }
})

// Expose methods for parent component
defineExpose({
  scrollToIndex,
  scrollToTop,
  scrollToBottom
})
</script>

<style scoped>
.virtual-list-container {
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
}

.virtual-list-spacer {
  position: relative;
  width: 100%;
}

.virtual-list-items {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}

.virtual-list-item {
  width: 100%;
  overflow: hidden;
}

/* Custom scrollbar */
.virtual-list-container::-webkit-scrollbar {
  width: 6px;
}

.virtual-list-container::-webkit-scrollbar-track {
  background: var(--gray-100);
  border-radius: 3px;
}

.virtual-list-container::-webkit-scrollbar-thumb {
  background: var(--gray-300);
  border-radius: 3px;
}

.virtual-list-container::-webkit-scrollbar-thumb:hover {
  background: var(--gray-400);
}
</style>