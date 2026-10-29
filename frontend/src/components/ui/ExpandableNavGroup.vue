<template>
  <div class="nav-item-group">
    <button
      type="button"
      class="nav-item expandable"
      :class="{ active: isRouteActive, 'nav-item--collapsed': !showText }"
      :aria-expanded="expanded"
      :title="showText ? undefined : label"
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
      <svg
        v-if="showText"
        class="expand-icon"
        :class="{ expanded: expanded }"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>

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
    items: readonly SubmenuItem[]
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
    margin-bottom: 1px;
  }

  .nav-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    height: 32px;
    padding: 0 10px;
    border: none;
    border-radius: 9px;
    background: transparent;
    color: var(--ui-ink-2);
    font: inherit;
    font-size: 13.5px;
    font-weight: 500;
    text-align: left;
    text-decoration: none;
    overflow: hidden;
    transition:
      background-color var(--ui-dur) var(--ui-ease),
      color var(--ui-dur) var(--ui-ease);
  }

  .nav-item.expandable {
    cursor: pointer;
  }

  .nav-item--collapsed {
    justify-content: center;
    padding: 0;
  }

  .nav-item:hover {
    background-color: var(--ui-fill);
  }

  /* A group holds no page of its own, so the active state is quiet: ink + weight, no pill */
  .nav-item.active {
    color: var(--ui-ink);
    font-weight: 500;
  }

  .nav-icon {
    flex-shrink: 0;
    width: 17px;
    height: 17px;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
    color: var(--ui-muted);
    transition: color var(--ui-dur) var(--ui-ease);
  }

  .nav-item.active .nav-icon {
    color: var(--ui-accent);
  }

  .nav-text {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .expand-icon {
    flex-shrink: 0;
    width: 14px;
    height: 14px;
    color: var(--ui-faint);
    transition: transform var(--ui-dur) var(--ui-ease);
  }

  .expand-icon.expanded {
    transform: rotate(90deg);
  }

  .submenu {
    display: grid;
    gap: 1px;
    padding: 2px 0 3px 37px;
    overflow: hidden;
  }

  .submenu-item {
    display: block;
    padding: 5px 10px;
    border-radius: 8px;
    color: var(--ui-muted);
    font-size: 13px;
    text-decoration: none;
    transition:
      background-color var(--ui-dur) var(--ui-ease),
      color var(--ui-dur) var(--ui-ease);
  }

  .submenu-item:hover {
    background: var(--ui-fill);
    color: var(--ui-ink-2);
  }

  .submenu-item.active {
    background: var(--ui-accent-soft);
    color: var(--ui-accent);
    font-weight: 500;
  }

  /* Submenu Animation */
  .submenu-enter-active,
  .submenu-leave-active {
    transition:
      max-height var(--ui-dur) var(--ui-ease),
      opacity var(--ui-dur) var(--ui-ease);
    max-height: 300px;
  }

  .submenu-enter-from,
  .submenu-leave-to {
    max-height: 0;
    opacity: 0;
  }

  /* Medium screens: the rail shows icons only */
  @media (min-width: 769px) and (max-width: 1024px) {
    .nav-text,
    .expand-icon,
    .submenu {
      display: none;
    }

    .nav-item {
      justify-content: center;
      padding: 0;
    }
  }
</style>
