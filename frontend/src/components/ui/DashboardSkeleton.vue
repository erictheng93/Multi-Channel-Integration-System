<template>
  <div class="dashboard-skeleton">
    <!-- Welcome Section Skeleton -->
    <div class="welcome-skeleton">
      <div class="welcome-content-skeleton">
        <div class="welcome-greeting-skeleton">
          <BaseSkeleton
            variant="text"
            width="60%"
            height="36px"
          />
          <BaseSkeleton
            variant="text"
            width="200px"
            height="20px"
            style="margin-top: 8px;"
          />
        </div>
        <div class="welcome-actions-skeleton">
          <BaseSkeleton
            variant="button"
            width="120px"
            height="40px"
          />
          <BaseSkeleton
            variant="circle"
            width="40px"
            height="40px"
          />
        </div>
      </div>
    </div>

    <!-- Stats Grid Skeleton -->
    <div class="stats-skeleton">
      <div class="stats-grid-skeleton">
        <div
          v-for="i in 4"
          :key="`stat-${i}`"
          class="stat-card-skeleton"
          :style="{ animationDelay: `${i * 0.1}s` }"
        >
          <div class="stat-content-skeleton">
            <BaseSkeleton
              variant="text"
              width="80px"
              height="40px"
            />
            <BaseSkeleton
              variant="text"
              width="100px"
              height="16px"
              style="margin-top: 8px;"
            />
          </div>
          <BaseSkeleton
            variant="rect"
            width="56px"
            height="56px"
            border-radius="12px"
          />
        </div>
      </div>
    </div>

    <!-- Content Grid Skeleton -->
    <div class="content-grid-skeleton">
      <!-- Main Card Skeleton (Conversations) -->
      <div class="main-card-skeleton">
        <div class="card-header-skeleton">
          <div class="card-title-skeleton">
            <BaseSkeleton
              variant="text"
              width="120px"
              height="24px"
            />
            <BaseSkeleton
              variant="text"
              width="180px"
              height="16px"
              style="margin-top: 4px;"
            />
          </div>
          <BaseSkeleton
            variant="text"
            width="80px"
            height="16px"
          />
        </div>
        <div class="card-body-skeleton">
          <!-- Conversation List Skeleton -->
          <div
            v-for="i in 5"
            :key="`conv-${i}`"
            class="conversation-item-skeleton"
            :style="{ animationDelay: `${i * 0.08}s` }"
          >
            <BaseSkeleton
              variant="avatar"
              width="48px"
              height="48px"
            />
            <div class="conversation-content-skeleton">
              <div class="conversation-header-skeleton">
                <BaseSkeleton
                  variant="text"
                  :width="`${getRandomWidth(60, 80)}%`"
                  height="18px"
                />
                <BaseSkeleton
                  variant="text"
                  :width="`${getRandomWidth(40, 60)}px`"
                  height="14px"
                />
              </div>
              <BaseSkeleton
                variant="text"
                :width="`${getRandomWidth(70, 95)}%`"
                height="14px"
                style="margin-top: 6px;"
              />
              <div class="conversation-tags-skeleton">
                <BaseSkeleton
                  variant="text"
                  :width="`${getRandomWidth(40, 60)}px`"
                  height="20px"
                  border-radius="10px"
                />
                <BaseSkeleton
                  v-if="Math.random() > 0.5"
                  variant="text"
                  :width="`${getRandomWidth(30, 50)}px`"
                  height="20px"
                  border-radius="10px"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Side Card Skeleton (Activity) -->
      <div class="side-card-skeleton">
        <div class="card-header-skeleton">
          <div class="card-title-skeleton">
            <BaseSkeleton
              variant="text"
              width="100px"
              height="24px"
            />
            <BaseSkeleton
              variant="text"
              width="120px"
              height="16px"
              style="margin-top: 4px;"
            />
          </div>
          <BaseSkeleton
            variant="text"
            width="80px"
            height="16px"
          />
        </div>
        <div class="card-body-skeleton">
          <!-- Activity List Skeleton -->
          <div
            v-for="i in 4"
            :key="`activity-${i}`"
            class="activity-item-skeleton"
            :style="{ animationDelay: `${i * 0.08}s` }"
          >
            <BaseSkeleton
              variant="rect"
              width="36px"
              height="36px"
              border-radius="8px"
            />
            <div class="activity-content-skeleton">
              <BaseSkeleton
                variant="text"
                :width="`${getRandomWidth(60, 85)}%`"
                height="16px"
              />
              <BaseSkeleton
                variant="text"
                :width="`${getRandomWidth(80, 100)}%`"
                height="13px"
                style="margin-top: 4px;"
              />
              <BaseSkeleton
                variant="text"
                width="60px"
                height="12px"
                style="margin-top: 6px;"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Performance Section Skeleton -->
    <div class="performance-skeleton">
      <div class="section-header-skeleton">
        <BaseSkeleton
          variant="text"
          width="120px"
          height="24px"
          style="margin: 0 auto;"
        />
        <BaseSkeleton
          variant="text"
          width="200px"
          height="16px"
          style="margin: 8px auto 0;"
        />
      </div>
      <div class="performance-grid-skeleton">
        <div
          v-for="i in 3"
          :key="`perf-${i}`"
          class="performance-card-skeleton"
          :style="{ animationDelay: `${i * 0.1}s` }"
        >
          <BaseSkeleton
            variant="rect"
            width="64px"
            height="64px"
            border-radius="12px"
          />
          <div class="performance-content-skeleton">
            <BaseSkeleton
              variant="text"
              width="80px"
              height="32px"
            />
            <BaseSkeleton
              variant="text"
              width="100px"
              height="14px"
              style="margin-top: 4px;"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import BaseSkeleton from './BaseSkeleton.vue'

// 生成隨機寬度避免過於統一的感覺
const getRandomWidth = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
</script>

<style scoped>
.dashboard-skeleton {
  max-width: clamp(1200px, 85vw, 1650px);
  margin: 0 auto;
  padding: clamp(1rem, 2vw, 2rem) clamp(0.5rem, 2vw, 1.5rem);
}

/* Welcome Section */
.welcome-skeleton {
  margin-bottom: 3rem;
  padding: 2rem 0;
}

.welcome-content-skeleton {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.welcome-greeting-skeleton {
  flex: 1;
}

.welcome-actions-skeleton {
  display: flex;
  gap: 1rem;
  align-items: center;
}

/* Stats Grid */
.stats-skeleton {
  margin-bottom: 3rem;
}

.stats-grid-skeleton {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(clamp(240px, 20vw, 300px), 1fr));
  gap: clamp(1rem, 2vw, 2rem);
}

.stat-card-skeleton {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
  border: 1px solid #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  animation: skeleton-fade-in 0.5s ease-out forwards;
  opacity: 0;
}

.stat-content-skeleton {
  flex: 1;
}

/* Content Grid */
.content-grid-skeleton {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 2rem;
  margin-bottom: 3rem;
}

.main-card-skeleton,
.side-card-skeleton {
  background: white;
  border-radius: 16px;
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
  border: 1px solid #f3f4f6;
  overflow: hidden;
}

.card-header-skeleton {
  padding: 2rem;
  border-bottom: 1px solid #f3f4f6;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.card-title-skeleton {
  flex: 1;
}

.card-body-skeleton {
  padding: 0 2rem 2rem 2rem;
}

/* Conversation Items */
.conversation-item-skeleton {
  display: flex;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  animation: skeleton-fade-in 0.5s ease-out forwards;
  opacity: 0;
}

.conversation-content-skeleton {
  flex: 1;
  min-width: 0;
}

.conversation-header-skeleton {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.conversation-tags-skeleton {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

/* Activity Items */
.activity-item-skeleton {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border-radius: 12px;
  animation: skeleton-fade-in 0.5s ease-out forwards;
  opacity: 0;
}

.activity-content-skeleton {
  flex: 1;
  min-width: 0;
}

/* Performance Section */
.performance-skeleton {
  margin-top: 3rem;
}

.section-header-skeleton {
  margin-bottom: 2rem;
  text-align: center;
}

.performance-grid-skeleton {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.performance-card-skeleton {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
  border: 1px solid #f3f4f6;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  animation: skeleton-fade-in 0.5s ease-out forwards;
  opacity: 0;
}

.performance-content-skeleton {
  flex: 1;
}

/* Animations */
@keyframes skeleton-fade-in {
  to {
    opacity: 1;
  }
}

/* Responsive */
@media (max-width: 1024px) {
  .content-grid-skeleton {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .welcome-content-skeleton {
    flex-direction: column;
    text-align: center;
    gap: 1.5rem;
  }

  .stats-grid-skeleton {
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  }
}

@media (max-width: 640px) {
  .welcome-actions-skeleton {
    flex-direction: column;
    width: 100%;
  }

  .stats-grid-skeleton {
    grid-template-columns: 1fr;
  }

  .performance-grid-skeleton {
    grid-template-columns: 1fr;
  }

  .card-header-skeleton {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
}

/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  .stat-card-skeleton,
  .conversation-item-skeleton,
  .activity-item-skeleton,
  .performance-card-skeleton {
    animation: none;
    opacity: 1;
  }
}

/* Dark Mode */
@media (prefers-color-scheme: dark) {
  .stat-card-skeleton,
  .main-card-skeleton,
  .side-card-skeleton,
  .performance-card-skeleton {
    background: #1f2937;
    border-color: #374151;
  }
}
</style>
