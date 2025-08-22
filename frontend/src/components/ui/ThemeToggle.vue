<template>
  <div class="theme-toggle-container">
    <button
      class="theme-toggle focus-ring"
      :title="`Switch to ${isDark ? 'light' : 'dark'} mode`"
      type="button"
      @click="toggleTheme"
    >
      <span class="sr-only">Toggle theme</span>
      <transition
        name="icon-transition"
        mode="out-in"
      >
        <SunIcon
          v-if="isDark"
          key="sun"
          class="theme-icon"
        />
        <MoonIcon
          v-else
          key="moon"
          class="theme-icon"
        />
      </transition>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'

const { isDark, toggleTheme } = useTheme()

// Icon components
const SunIcon = {
  template: `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="4"/>
      <path d="m12 2 0 2"/>
      <path d="m12 20 0 2"/>
      <path d="m4.93 4.93 1.41 1.41"/>
      <path d="m17.66 17.66 1.41 1.41"/>
      <path d="m2 12 2 0"/>
      <path d="m20 12 2 0"/>
      <path d="m6.34 17.66-1.41 1.41"/>
      <path d="m19.07 4.93-1.41 1.41"/>
    </svg>
  `
}

const MoonIcon = {
  template: `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  `
}
</script>

<style scoped>
.theme-toggle-container {
  display: flex;
  align-items: center;
}

.theme-toggle {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-lg);
  border: 1px solid rgb(var(--border));
  background: rgb(var(--card));
  color: rgb(var(--card-foreground));
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.theme-toggle:hover {
  background: rgb(var(--accent));
  border-color: rgb(var(--ring) / 0.3);
}

.theme-icon {
  width: 18px;
  height: 18px;
  color: currentColor;
}

/* Screen reader only text */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Icon transition animations */
.icon-transition-enter-active,
.icon-transition-leave-active {
  transition: all var(--transition-fast);
}

.icon-transition-enter-from {
  opacity: 0;
  transform: rotate(-90deg) scale(0.8);
}

.icon-transition-leave-to {
  opacity: 0;
  transform: rotate(90deg) scale(0.8);
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .icon-transition-enter-active,
  .icon-transition-leave-active,
  .theme-toggle {
    transition: none;
  }
  
  .icon-transition-enter-from,
  .icon-transition-leave-to {
    transform: none;
  }
}
</style>