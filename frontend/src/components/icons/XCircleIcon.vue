<template>
  <svg 
    :width="size" 
    :height="size" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    :stroke-width="strokeWidth"
  >
    <circle
      cx="12"
      cy="12"
      r="10"
    />
    <path d="m15 9-6 6" />
    <path d="m9 9 6 6" />
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