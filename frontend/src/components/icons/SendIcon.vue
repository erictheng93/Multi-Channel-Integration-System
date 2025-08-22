<template>
  <svg 
    :width="size" 
    :height="size" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    :stroke-width="strokeWidth"
  >
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
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