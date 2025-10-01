<!-- 報表系統容器頁面 - 包裹 AppLayout -->
<template>
  <AppLayout>
    <router-view />
  </AppLayout>
</template>

<script setup lang="ts">
import AppLayout from '@/components/ui/AppLayout.vue'

// 報表系統容器：包裹 AppLayout 以顯示 Sidebar
// 子路由（ReportDashboard、ReportTemplates 等）直接渲染內容
</script>
