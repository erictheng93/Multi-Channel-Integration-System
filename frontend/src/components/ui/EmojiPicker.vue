<template>
  <div class="emoji-picker">
    <div class="emoji-categories">
      <button
        v-for="category in categories"
        :key="category.name"
        :class="['category-btn', { active: activeCategory === category.name }]"
        @click="activeCategory = category.name"
      >
        {{ category.icon }}
      </button>
    </div>
    
    <div class="emoji-grid">
      <button
        v-for="emoji in currentEmojis"
        :key="emoji"
        class="emoji-btn"
        :title="emoji"
        @click="selectEmoji(emoji)"
      >
        {{ emoji }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface EmojiCategory {
  name: string
  icon: string
  emojis: string[]
}

const emit = defineEmits<{
  'emoji-select': [emoji: string]
}>()

// 表情符號分類數據
const categories = ref<EmojiCategory[]>([
  {
    name: 'smileys',
    icon: '😀',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥']
  },
  {
    name: 'gestures',
    icon: '👋',
    emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏']
  },
  {
    name: 'hearts',
    icon: '❤️',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟']
  },
  {
    name: 'objects',
    icon: '🎉',
    emojis: ['🎉', '🎊', '🎈', '🎁', '🎀', '🎃', '🎄', '🎆', '🎇', '✨', '🎋', '🎍', '🎎', '🎏', '🎐', '🎑', '🧧', '🎗️', '🎟️', '🎫', '🎖️', '🏆', '🏅', '🥇', '🥈', '🥉']
  }
])

const activeCategory = ref('smileys')

const currentEmojis = computed(() => {
  const category = categories.value.find(cat => cat.name === activeCategory.value)
  return category?.emojis || []
})

const selectEmoji = (emoji: string) => {
  emit('emoji-select', emoji)
}
</script>

<style scoped>
.emoji-picker {
  width: 320px;
  max-height: 300px;
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.emoji-categories {
  display: flex;
  border-bottom: 1px solid var(--gray-200);
  background: var(--gray-50);
}

.category-btn {
  flex: 1;
  padding: var(--space-2);
  border: none;
  background: none;
  cursor: pointer;
  font-size: 1.25rem;
  transition: background-color var(--transition-fast);
}

.category-btn:hover {
  background: var(--gray-100);
}

.category-btn.active {
  background: var(--primary-100);
  color: var(--primary-600);
}

.emoji-grid {
  padding: var(--space-2);
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: var(--space-1);
  max-height: 240px;
  overflow-y: auto;
}

.emoji-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 1.25rem;
  border-radius: var(--radius-sm);
  transition: background-color var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
}

.emoji-btn:hover {
  background: var(--gray-100);
}

.emoji-btn:active {
  background: var(--gray-200);
}

/* 自定義滾動條 */
.emoji-grid::-webkit-scrollbar {
  width: 6px;
}

.emoji-grid::-webkit-scrollbar-track {
  background: var(--gray-100);
  border-radius: 3px;
}

.emoji-grid::-webkit-scrollbar-thumb {
  background: var(--gray-300);
  border-radius: 3px;
}

.emoji-grid::-webkit-scrollbar-thumb:hover {
  background: var(--gray-400);
}
</style>