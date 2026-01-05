<template>
  <button
    type="button"
    class="theme-toggle"
    :aria-label="isLightMode ? '切換至深色模式' : '切換至淺色模式'"
    @click="$emit('toggle')"
  >
    <span class="toggle-icon sun-icon">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      >
        <circle
          cx="12"
          cy="12"
          r="5"
        />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    </span>
    <span class="toggle-icon moon-icon">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </span>
  </button>
</template>

<script setup lang="ts">
interface Props {
  isLightMode: boolean
}

defineProps<Props>()

defineEmits<Emits>()

interface Emits {
  (_e: 'toggle'): void
}

</script>

<style scoped>
.theme-toggle {
  position: fixed;
  top: var(--space-lg, 24px);
  right: var(--space-lg, 24px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: var(--glass-bg, rgba(255, 255, 255, 0.05));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.1));
  border-radius: 50%;
  cursor: pointer;
  transition: all 200ms ease;
  overflow: hidden;
}

.theme-toggle:hover {
  background: var(--glass-hover, rgba(255, 255, 255, 0.08));
  transform: scale(1.05);
}

.theme-toggle:active {
  transform: scale(0.95);
}

.toggle-icon {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary, #86868b);
  transition: all 400ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* Dark mode: show moon, hide sun */
.sun-icon {
  opacity: 0;
  transform: rotate(-90deg) scale(0.5);
}

.moon-icon {
  opacity: 1;
  transform: rotate(0deg) scale(1);
}

/* Parent component with .light-mode class changes icon visibility */
:global(.light-mode) .sun-icon {
  opacity: 1;
  transform: rotate(0deg) scale(1);
}

:global(.light-mode) .moon-icon {
  opacity: 0;
  transform: rotate(90deg) scale(0.5);
}

@media (max-width: 480px) {
  .theme-toggle {
    top: var(--space-md, 16px);
    right: var(--space-md, 16px);
    width: 44px;
    height: 44px;
  }
}
</style>
