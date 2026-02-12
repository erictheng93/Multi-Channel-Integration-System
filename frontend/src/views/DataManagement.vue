<!-- 資料管理容器 - 純 passthrough，導航由 Sidebar 處理 -->
<template>
  <AppLayout>
    <router-view />
  </AppLayout>
</template>

<script setup lang="ts">
import AppLayout from '@/components/ui/AppLayout.vue'
</script>
