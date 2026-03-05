<!--
  SettingsSidebar.vue

  Apple-inspired vertical sidebar navigation for System Settings.
  Features expandable categories, active route highlighting, and responsive layout.
  Desktop: 240px sidebar | Tablet: 64px icon-only | Mobile: horizontal scrollable bar
-->

<template>
  <nav
    class="settings-sidebar"
    role="navigation"
    aria-label="Settings navigation"
    @keydown="handleKeydown"
  >
    <ul class="sidebar-list">
      <li
        v-for="item in navItems"
        :key="item.path"
        class="sidebar-item"
        :class="{ 'has-children': item.children }"
      >
        <!-- Top-level item (no children) -->
        <router-link
          v-if="!item.children"
          :to="item.path"
          class="sidebar-link"
          :class="{ active: isActive(item.path) }"
          :aria-current="isActive(item.path) ? 'page' : undefined"
        >
          <span class="sidebar-icon">{{ item.icon }}</span>
          <span class="sidebar-label">{{ item.label }}</span>
        </router-link>

        <!-- Expandable category -->
        <template v-else>
          <button
            class="sidebar-category"
            :class="{ expanded: isExpanded(item.path) }"
            :aria-expanded="isExpanded(item.path)"
            @click="toggleCategory(item.path)"
          >
            <span class="sidebar-icon">{{ item.icon }}</span>
            <span class="sidebar-label">{{ item.label }}</span>
            <span class="sidebar-chevron">
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 2L8 6L4 10"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
          </button>

          <Transition name="expand">
            <ul
              v-show="isExpanded(item.path)"
              class="sidebar-children"
            >
              <li
                v-for="child in item.children"
                :key="child.path"
                class="sidebar-child-item"
              >
                <router-link
                  :to="child.path"
                  class="sidebar-link child-link"
                  :class="{ active: isActive(child.path) }"
                  :aria-current="isActive(child.path) ? 'page' : undefined"
                >
                  <span class="sidebar-icon child-icon">{{ child.icon }}</span>
                  <span class="sidebar-label">{{ child.label }}</span>
                </router-link>
              </li>
            </ul>
          </Transition>
        </template>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'

interface NavChild {
  path: string
  label: string
  icon: string
}

interface NavItem {
  path: string
  label: string
  icon: string
  children?: NavChild[]
}

const route = useRoute()

const navItems: NavItem[] = [
  {
    path: '/settings/general',
    label: '\u4E00\u822C\u8A2D\u5B9A',
    icon: '\u2699'
  },
  {
    path: '/settings/integrations',
    label: '\u6574\u5408',
    icon: '\uD83D\uDD17',
    children: [
      { path: '/settings/integrations/line', label: 'LINE OA', icon: '\uD83D\uDCAC' },
      { path: '/settings/integrations/facebook', label: 'Facebook', icon: '\uD83D\uDCD8' }
    ]
  },
  {
    path: '/settings/advanced',
    label: '\u9032\u968E\u8A2D\u5B9A',
    icon: '\uD83D\uDD27'
  },
  {
    path: '/settings/maintenance',
    label: '\u7CFB\u7D71\u7DAD\u8B77',
    icon: '\uD83D\uDEE0',
    children: [
      { path: '/settings/maintenance/backup', label: '\u5099\u4EFD\u7BA1\u7406', icon: '\uD83D\uDCBE' },
      { path: '/settings/maintenance/health', label: '\u5065\u5EB7\u6AA2\u67E5', icon: '\uD83C\uDFE5' }
    ]
  }
]

// Track expanded categories
const expandedCategories = ref<Set<string>>(new Set())

/**
 * Check if a path is currently active
 */
function isActive(path: string): boolean {
  return route.path === path
}

/**
 * Check if a category is expanded
 */
function isExpanded(path: string): boolean {
  return expandedCategories.value.has(path)
}

/**
 * Toggle category expansion
 */
function toggleCategory(path: string): void {
  const next = new Set(expandedCategories.value)
  if (next.has(path)) {
    next.delete(path)
  } else {
    next.add(path)
  }
  expandedCategories.value = next
}

/**
 * Auto-expand categories whose children match the current route
 */
function autoExpandForRoute(): void {
  const next = new Set(expandedCategories.value)
  for (const item of navItems) {
    if (item.children) {
      const hasActiveChild = item.children.some(child => route.path === child.path)
      if (hasActiveChild) {
        next.add(item.path)
      }
    }
  }
  expandedCategories.value = next
}

/**
 * Keyboard navigation for accessibility
 */
function handleKeydown(event: KeyboardEvent): void {
  const focusable = Array.from(
    (event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(
      'a.sidebar-link, button.sidebar-category'
    )
  )
  const current = document.activeElement as HTMLElement
  const index = focusable.indexOf(current)

  if (index === -1) { return }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    const next = focusable[index + 1]
    next?.focus()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    const prev = focusable[index - 1]
    prev?.focus()
  }
}

// Auto-expand on mount and route changes
onMounted(autoExpandForRoute)
watch(() => route.path, autoExpandForRoute)
</script>

<style scoped>
.settings-sidebar {
  width: 240px;
  min-width: 240px;
  background: #f9fafb;
  border-right: 1px solid #e5e7eb;
  border-radius: 12px 0 0 12px;
  padding: 0.75rem 0;
  overflow-y: auto;
}

.sidebar-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.sidebar-item {
  margin: 0;
}

.sidebar-link,
.sidebar-category {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.625rem 1rem;
  margin: 1px 0.5rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #4b5563;
  font-size: 0.875rem;
  font-weight: 450;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.15s ease;
  box-sizing: border-box;
  width: calc(100% - 1rem);
  text-align: left;
  line-height: 1.4;
}

.sidebar-link:hover,
.sidebar-category:hover {
  background: #f3f4f6;
  color: #1f2937;
}

.sidebar-link:focus-visible,
.sidebar-category:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: -2px;
}

.sidebar-link.active {
  background: #eff6ff;
  color: #1d4ed8;
  font-weight: 550;
  position: relative;
}

.sidebar-link.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 3px;
  background: #3b82f6;
  border-radius: 0 3px 3px 0;
}

.sidebar-icon {
  font-size: 1rem;
  width: 1.25rem;
  text-align: center;
  flex-shrink: 0;
}

.sidebar-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-chevron {
  display: flex;
  align-items: center;
  color: #9ca3af;
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.sidebar-category.expanded .sidebar-chevron {
  transform: rotate(90deg);
}

/* Children list */
.sidebar-children {
  list-style: none;
  margin: 0;
  padding: 0 0 0 0.5rem;
  overflow: hidden;
}

.sidebar-child-item {
  margin: 0;
}

.child-link {
  padding-left: 2.25rem;
  font-size: 0.8125rem;
}

.child-icon {
  font-size: 0.875rem;
}

/* Expand transition */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
  max-height: 200px;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

/* ============================================
   Tablet: icon-only sidebar (769px - 1024px)
   ============================================ */
@media (min-width: 769px) and (max-width: 1024px) {
  .settings-sidebar {
    width: 64px;
    min-width: 64px;
    padding: 0.5rem 0;
  }

  .sidebar-link,
  .sidebar-category {
    justify-content: center;
    padding: 0.625rem 0;
    margin: 1px 0.375rem;
    width: calc(100% - 0.75rem);
  }

  .sidebar-label,
  .sidebar-chevron {
    display: none;
  }

  .sidebar-icon {
    font-size: 1.25rem;
    width: auto;
  }

  .sidebar-children {
    padding-left: 0;
  }

  .child-link {
    padding-left: 0;
    justify-content: center;
  }

  .sidebar-link.active::before {
    top: 8px;
    bottom: 8px;
  }
}

/* ============================================
   Mobile: horizontal scrollable bar (<769px)
   ============================================ */
@media (max-width: 768px) {
  .settings-sidebar {
    width: 100%;
    min-width: 100%;
    border-right: none;
    border-bottom: 1px solid #e5e7eb;
    border-radius: 12px 12px 0 0;
    padding: 0.5rem;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
  }

  .sidebar-list {
    display: flex;
    gap: 0.25rem;
    flex-wrap: nowrap;
  }

  .sidebar-item {
    flex-shrink: 0;
  }

  .sidebar-item.has-children {
    display: flex;
    align-items: center;
    gap: 0.125rem;
  }

  .sidebar-link,
  .sidebar-category {
    margin: 0;
    padding: 0.5rem 0.75rem;
    border-radius: 20px;
    white-space: nowrap;
    width: auto;
    font-size: 0.8125rem;
    gap: 0.375rem;
  }

  .sidebar-category {
    display: none;
  }

  .sidebar-children {
    display: flex;
    gap: 0.25rem;
    padding: 0;
  }

  .sidebar-child-item {
    flex-shrink: 0;
  }

  .child-link {
    padding-left: 0.75rem;
  }

  .sidebar-chevron {
    display: none;
  }

  .sidebar-link.active {
    background: #dbeafe;
  }

  .sidebar-link.active::before {
    display: none;
  }

  /* Expand transitions disabled on mobile */
  .expand-enter-active,
  .expand-leave-active {
    transition: none;
  }
}
</style>
