<template>
  <div class="empty-state">
    <div class="empty-icon">
      
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

<style scoped>
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: #64748b;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-state h3 {
  margin: 0 0 0.5rem 0;
  color: #374151;
  font-size: 1.25rem;
}

.empty-state p {
  margin: 0;
  font-size: 1rem;
}
</style>
