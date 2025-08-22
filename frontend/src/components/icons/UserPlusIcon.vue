<template>
  <svg 
    :width="size" 
    :height="size" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    :stroke-width="strokeWidth"
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle
      cx="9"
      cy="7"
      r="4"
    />
    <line
      x1="22"
      y1="11"
      x2="16"
      y2="11"
    />
    <line
      x1="19"
      y1="8"
      x2="19"
      y2="14"
    />
  </svg>
</template>

<script setup lang="ts">
interface Props {
  size?: number | string
  strokeWidth?: number | string
}

withDefaults(defineProps<Props>(), {
  size: 20,
  strokeWidth: 2
})
</script>