<template>
  <div class="ui-empty empty-state">
    <div
      class="ui-empty-art empty-icon"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      ><circle
        cx="11"
        cy="11"
        r="7"
      /><path d="m21 21-4.3-4.3" /></svg>
    </div>
    <h3>{{ title }}</h3>
    <p>{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title?: string
  message?: string
}

withDefaults(defineProps<Props>(), {
  title: '未找到匹配的API',
  message: '請調整篩選條件或搜索關鍵詞'
})
</script>
