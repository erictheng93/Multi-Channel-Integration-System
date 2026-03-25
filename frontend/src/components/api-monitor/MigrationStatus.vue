<template>
  <div class="migration-status">
    <div class="migration-card">
      <div class="migration-header">
        <h2>WebSocket Migration Status</h2>
        <span class="migration-badge">Completed</span>
      </div>

      <div class="migration-progress">
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: '100%' }"
          />
        </div>
        <div class="progress-info">
          <span>Rollout: 100%</span>
          <span>Durable Objects: Active</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// MigrationStatus is now a static display component.
// WebSocket migration is complete; no dynamic props needed.
</script>

<style scoped>
.migration-status {
  margin-bottom: 2rem;
}

.migration-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.15);
  color: white;
}

.migration-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.migration-header h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
}

.migration-badge {
  background: rgba(255, 255, 255, 0.25);
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 600;
  backdrop-filter: blur(10px);
}

.migration-progress {
  margin-bottom: 1.5rem;
}

.progress-bar {
  background: rgba(255, 255, 255, 0.2);
  height: 12px;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 0.75rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%);
  transition: width 0.5s ease-in-out;
  box-shadow: 0 2px 8px rgba(34, 197, 94, 0.4);
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  opacity: 0.9;
}

/* Responsive */
@media (max-width: 768px) {
  .migration-card {
    padding: 1.5rem;
  }

  .migration-header {
    flex-direction: column;
    gap: 0.75rem;
    align-items: stretch;
    text-align: center;
  }

  .migration-header h2 {
    font-size: 1.25rem;
  }
}
</style>
