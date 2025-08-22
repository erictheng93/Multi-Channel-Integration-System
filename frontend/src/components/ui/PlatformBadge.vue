<template>
  <div 
    class="platform-badge"
    :class="[
      `platform-${platform}`,
      platform,
      size || 'medium',
      {
        'clickable': clickable
      }
    ]"
    @click="handleClick"
  >
    <component 
      :is="platformIcon" 
      v-if="showIcon" 
      :size="16" 
      class="platform-icon"
    />
    <span class="platform-text">{{ displayText }}</span>
    
    <!-- Status indicator -->
    <div 
      v-if="status" 
      class="status-indicator"
      :class="status"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Platform } from '@/types'
import { LineIcon, FacebookIcon, MessageCircleIcon } from '@/components/icons'

interface Props {
  platform: Platform | string
  showIcon?: boolean
  size?: 'small' | 'medium' | 'large'
  clickable?: boolean
  status?: 'connected' | 'disconnected' | 'error' | undefined
  text?: string
}

const props = withDefaults(defineProps<Props>(), {
  showIcon: false,
  size: 'medium',
  clickable: false,
  status: undefined,
  text: ''
})

const emit = defineEmits<{
  click: [platform: string]
}>()

const platformConfig: Record<string, { text: string; icon: unknown; color: string }> = {
  line: {
    text: 'LINE',
    icon: LineIcon,
    color: 'green'
  },
  facebook: {
    text: 'Facebook',
    icon: FacebookIcon,
    color: 'blue'
  },
  instagram: {
    text: 'Instagram',
    icon: MessageCircleIcon,
    color: 'purple'
  },
  whatsapp: {
    text: 'WhatsApp',
    icon: MessageCircleIcon,
    color: 'green'
  },
  telegram: {
    text: 'Telegram',
    icon: MessageCircleIcon,
    color: 'blue'
  }
}

const displayText = computed(() => {
  if (props.text) {return props.text}
  
  const config = platformConfig[props.platform]
  if (config) {return config.text}
  
  if (props.platform === 'unknown' || !props.platform) {return 'Unknown'}
  
  return props.platform.toUpperCase()
})

const platformIcon = computed(() => {
  return platformConfig[props.platform]?.icon || MessageCircleIcon
})

const handleClick = () => {
  if (props.clickable) {
    emit('click', props.platform)
  }
  // Don't emit click when not clickable
}
</script>

<style scoped>
.platform-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  position: relative;
}

.platform-badge.small {
  padding: 1px 6px;
  font-size: 0.625rem;
}

.platform-badge.medium {
  padding: 2px 8px;
  font-size: 0.75rem;
}

.platform-badge.large {
  padding: 4px 12px;
  font-size: 0.875rem;
}

.platform-badge.clickable {
  cursor: pointer;
  transition: all var(--transition-fast);
}

.platform-badge.clickable:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.platform-icon {
  flex-shrink: 0;
}

.platform-text {
  line-height: 1;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-left: var(--space-1);
  flex-shrink: 0;
}

.status-indicator.connected {
  background: var(--green-500);
}

.status-indicator.disconnected {
  background: var(--gray-400);
}

.status-indicator.error {
  background: var(--red-500);
}

/* Platform-specific colors */
.platform-line {
  background: #00c300;
  color: white;
}

.platform-facebook {
  background: #1877f2;
  color: white;
}

.platform-instagram {
  background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);
  color: white;
}

.platform-whatsapp {
  background: #25d366;
  color: white;
}

.platform-telegram {
  background: #0088cc;
  color: white;
}

.platform-unknown {
  background: var(--gray-100);
  color: var(--gray-700);
}

/* Fallback for unknown platforms */
.platform-badge:not(.platform-line):not(.platform-facebook):not(.platform-instagram):not(.platform-whatsapp):not(.platform-telegram):not(.platform-unknown) {
  background: var(--gray-100);
  color: var(--gray-700);
}
</style>