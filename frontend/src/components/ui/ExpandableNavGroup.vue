<template>
  <div class="nav-item-group">
    <div
      class="nav-item expandable"
      :class="{ active: isRouteActive }"
      @click="$emit('toggle')"
    >
      <component
        :is="icon"
        class="nav-icon"
      />
      <span
        v-if="showText"
        class="nav-text"
      >{{ label }}</span>
      <span
        v-if="showText"
        class="expand-icon"
        :class="{ expanded: expanded }"
      >
        &#9654;
      </span>
    </div>

    <!-- Submenu -->
    <transition name="submenu">
      <div
        v-show="expanded && showText"
        class="submenu"
      >
        <router-link
          v-for="item in items"
          :key="item.path"
          :to="item.path"
          class="submenu-item"
          :class="{ active: currentPath === item.path }"
        >
          <span>{{ item.label }}</span>
        </router-link>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
  import { computed, type Component } from 'vue'
  import { useRoute } from 'vue-router'

  interface SubmenuItem {
    path: string
    label: string
  }

  const props = defineProps<{
    icon: Component
    label: string
    routePrefix: string
    expanded: boolean
    sidebarCollapsed: boolean
    isMobile: boolean
    items: SubmenuItem[]
  }>()

  defineEmits<{
    toggle: []
  }>()

  const route = useRoute()
  const currentPath = computed(() => route.path)
  const isRouteActive = computed(() => currentPath.value.startsWith(props.routePrefix))
  const showText = computed(() => !props.sidebarCollapsed || props.isMobile)
</script>

<style scoped>
  .nav-item-group {
    margin-bottom: var(--space-2);
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    margin-bottom: var(--space-1);
    color: var(--gray-600);
    text-decoration: none;
    border-radius: var(--radius-lg);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-weight: 500;
    position: relative;
    overflow: hidden;
  }

  .nav-item.expandable {
    cursor: pointer;
    justify-content: space-between;
  }

  .nav-item:hover {
    background-color: var(--gray-100);
    color: var(--gray-900);
  }

  .nav-item.active {
    background-color: var(--primary-50);
    color: var(--primary-700);
  }

  .nav-icon {
    flex-shrink: 0;
  }

  .nav-text {
    white-space: nowrap;
    opacity: 1;
    transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    flex: 1;
  }

  .expand-icon {
    font-size: 0.75rem;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    color: var(--gray-500);
  }

  .expand-icon.expanded {
    transform: rotate(90deg);
  }

  .submenu {
    margin-left: var(--space-6);
    margin-top: var(--space-2);
    padding-left: var(--space-4);
    border-left: 2px solid var(--gray-200);
    overflow: hidden;
  }

  .submenu-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    margin-bottom: var(--space-1);
    border-radius: var(--radius-md);
    text-decoration: none;
    color: var(--gray-700);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    font-size: 0.9rem;
  }

  .submenu-item:hover {
    background: var(--gray-50);
    color: var(--gray-900);
    transform: translateX(2px);
  }

  .submenu-item.active {
    background: var(--primary-100);
    color: var(--primary-700);
    font-weight: 600;
  }

  /* Submenu Animation */
  .submenu-enter-active,
  .submenu-leave-active {
    transition: all 0.3s ease;
    max-height: 300px;
  }

  .submenu-enter-from,
  .submenu-leave-to {
    max-height: 0;
    opacity: 0;
    margin-top: 0;
  }
</style>
