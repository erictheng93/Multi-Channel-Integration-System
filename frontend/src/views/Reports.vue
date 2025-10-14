<!-- 報表系統容器頁面 - 包裹 AppLayout -->
<template>
  <AppLayout>
    <div class="reports-main">
      <div class="reports-header">
        <h1 class="page-title">報表系統</h1>
        <nav class="sub-navigation">
          <router-link
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            class="sub-nav-item"
            :class="{ active: isActive(item.path) }"
          >
            <span class="nav-icon">{{ item.icon }}</span>
            <span class="nav-label">{{ item.label }}</span>
          </router-link>
        </nav>
      </div>
      <div class="reports-content">
        <router-view />
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import AppLayout from '@/components/ui/AppLayout.vue'

const route = useRoute()

const navItems = [
  { path: '/reports/dashboard', label: '儀表板', icon: '📊' },
  { path: '/reports/templates', label: '模板', icon: '📋' },
  { path: '/reports/generate', label: '生成報表', icon: '✨' }
]

const isActive = (path: string) => {
  return route.path === path || route.path.startsWith(path + '/')
}
</script>

<style scoped>
.reports-main {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 1rem;
}

.reports-header {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.page-title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 600;
  color: #1a202c;
}

.sub-navigation {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.sub-nav-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  text-decoration: none;
  color: #4a5568;
  transition: all 0.2s;
  font-size: 0.95rem;
}

.sub-nav-item:hover {
  background: #f7fafc;
  color: #2d3748;
}

.sub-nav-item.active {
  background: #4299e1;
  color: white;
  font-weight: 500;
}

.nav-icon {
  font-size: 1.1rem;
}

.reports-content {
  flex: 1;
  overflow: auto;
}
</style>
