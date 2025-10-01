<!-- 報表系統主頁面 -->
<!-- Main Reports System Page with sub-navigation -->

<template>
  <div class="reports-main">
    <!-- 報表系統標題和導航 -->
    <div class="reports-header">
      <div class="header-content">
        <div class="title-section">
          <h1 class="page-title">
            <i class="title-icon">📊</i>
            報表系統
          </h1>
          <p class="page-description">
            全方位的報表生成、管理和分析工具
          </p>
        </div>

        <!-- 子頁面導航 -->
        <nav class="sub-navigation">
          <router-link
            v-for="navItem in subNavItems"
            :key="navItem.path"
            :to="navItem.path"
            class="sub-nav-item"
            :class="{ active: isActive(navItem.path) }"
          >
            <i class="nav-icon">{{ navItem.icon }}</i>
            <span class="nav-label">{{ navItem.label }}</span>
            <!-- badge removed as property doesn't exist -->
          </router-link>
        </nav>
      </div>
    </div>

    <!-- 子頁面內容 -->
    <div class="reports-content">
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
// computed removed as it was not used
import { useRoute } from 'vue-router';

const route = useRoute();

// 子導航項目
const subNavItems = [
  {
    path: '/reports/dashboard',
    label: '儀表板',
    icon: '📊',
    description: '報表總覽和統計'
  },
  {
    path: '/reports/templates',
    label: '模板',
    icon: '📋',
    description: '快速報表模板'
  },
  {
    path: '/reports/generate',
    label: '生成報表',
    icon: '⚙️',
    description: '自定義報表生成'
  }
];

// 檢查當前路由是否為活動狀態
const isActive = (path: string): boolean => {
  return route.path === path || route.path.startsWith(`${path  }/`);
};
</script>

<style scoped>
.reports-main {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

/* 報表系統標題區 */
.reports-header {
  background: white;
  border-bottom: 1px solid #e1e5e9;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
  position: sticky;
  top: 0;
  z-index: 10;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem 2rem 0;
}

.title-section {
  margin-bottom: 1.5rem;
}

.page-title {
  font-size: 2.5rem;
  color: #1a1a1a;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  font-weight: 700;
}

.title-icon {
  font-size: 2.2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
}

.page-description {
  font-size: 1.1rem;
  color: #666;
  margin: 0;
  max-width: 600px;
}

/* 子導航 */
.sub-navigation {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 1rem;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.sub-navigation::-webkit-scrollbar {
  display: none;
}

.sub-nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-radius: 12px 12px 0 0;
  text-decoration: none;
  color: #666;
  background: #f8f9fa;
  border: 2px solid transparent;
  transition: all 0.3s ease;
  white-space: nowrap;
  position: relative;
  font-weight: 500;
  min-width: fit-content;
}

.sub-nav-item:hover {
  background: #e9ecef;
  color: #333;
  transform: translateY(-2px);
}

.sub-nav-item.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.sub-nav-item.active::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 2px 2px 0 0;
}

.nav-icon {
  font-size: 1.2rem;
  flex-shrink: 0;
}

.nav-label {
  font-size: 1rem;
  font-weight: 500;
}

.nav-badge {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  min-width: 1.5rem;
  text-align: center;
}

.sub-nav-item:not(.active) .nav-badge {
  background: #dee2e6;
  color: #666;
}

/* 內容區域 */
.reports-content {
  flex: 1;
  padding: 0;
  background: transparent;
}

/* 響應式設計 */
@media (max-width: 768px) {
  .reports-main {
    background: white;
  }

  .header-content {
    padding: 1.5rem 1rem 0;
  }

  .page-title {
    font-size: 2rem;
  }

  .sub-navigation {
    gap: 0.25rem;
    padding-bottom: 0.75rem;
  }

  .sub-nav-item {
    padding: 0.75rem 1rem;
    flex-direction: column;
    gap: 0.25rem;
    text-align: center;
    min-width: 80px;
  }

  .nav-icon {
    font-size: 1.5rem;
  }

  .nav-label {
    font-size: 0.875rem;
  }

  .nav-badge {
    position: absolute;
    top: 0.25rem;
    right: 0.25rem;
    min-width: 1.25rem;
    height: 1.25rem;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
  }
}

@media (max-width: 480px) {
  .page-title {
    font-size: 1.75rem;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .page-description {
    font-size: 1rem;
  }

  .sub-nav-item {
    min-width: 70px;
    padding: 0.5rem;
  }

  .nav-label {
    font-size: 0.8rem;
  }
}

/* 動畫效果 */
@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.reports-content {
  animation: slideInUp 0.3s ease-out;
}

/* 深色模式支援 */
@media (prefers-color-scheme: dark) {
  .reports-main {
    background: linear-gradient(135deg, #1a1a1a 0%, #2d3748 100%);
  }

  .reports-header {
    background: #2d3748;
    border-bottom-color: #4a5568;
  }

  .page-title {
    color: white;
  }

  .page-description {
    color: #a0aec0;
  }

  .sub-nav-item {
    background: #4a5568;
    color: #a0aec0;
  }

  .sub-nav-item:hover {
    background: #2d3748;
    color: white;
  }

  .sub-nav-item:not(.active) .nav-badge {
    background: #2d3748;
    color: #a0aec0;
  }
}
</style>