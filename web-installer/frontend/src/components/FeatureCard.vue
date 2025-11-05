<template>
  <div class="feature-card">
    <div class="feature-icon">{{ icon }}</div>
    <h3 class="feature-title">{{ title }}</h3>
    <p class="feature-description">{{ description }}</p>
  </div>
</template>

<script setup lang="ts">
// ========================================
// PROPS
// ========================================

interface Props {
  icon: string;
  title: string;
  description: string;
}

defineProps<Props>();
</script>

<style scoped>
.feature-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-xl);
  padding: var(--spacing-xl);
  text-align: center;
  transition: all var(--transition-base);
}

.feature-card:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-8px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}

.feature-icon {
  font-size: 3rem;
  margin-bottom: var(--spacing-md);
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1));
}

.feature-title {
  margin-bottom: var(--spacing-sm);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: white;
}

.feature-description {
  margin: 0;
  font-size: var(--font-size-base);
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.6;
}
</style>
