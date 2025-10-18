# Dashboard


****: Dashboard
****: 2025-01-14
****:
****: Dashboard


1. **** -
2. **** -
3. **** -
4. **** -


- **** -
- **** -
- **** -
- **** -


### 1. (Welcome Section)

-
-
-
-


```vue
<!-- -->
<div class="welcome-section">
 <div class="welcome-content">
 <div class="welcome-greeting">
 <h1 class="welcome-title">{{ currentAgent?.name }}</h1>
 <p class="welcome-subtitle">{{ currentDate }}</p>
 </div>
 <div class="welcome-actions">
 <router-link to="/conversations" class="btn btn-primary btn-lg">
 <ChatIcon />
 </router-link>
 <button class="btn btn-ghost" @click="refreshData">
 <RefreshIcon />
 </button>
 </div>
 </div>
</div>
```


- ****:
- ****: 2.5rem
- ****:
- ****:

### 2. (Stats Grid)

-
-
-
-


```vue
<div class="stats-grid">
 <div class="stat-card pending">
 <div class="stat-content">
 <div class="stat-number">{{ openConversations.length }}</div>
 <div class="stat-label"></div>
 </div>
 <div class="stat-icon">
 <ChatIcon />
 </div>
 </div>
 <!-- ... -->
</div>
```


- ****:
 - ()
 - ()
 - ()
 - ()
- ****:
- ****:
- ****:

### 3. (Content Grid)

-
-
-
-


```vue
<div class="main-card conversations-card">
 <div class="card-header">
 <div class="card-title-group">
 <h2 class="card-title"></h2>
 <p class="card-subtitle"></p>
 </div>
 <router-link to="/conversations" class="view-all-link">

 </router-link>
 </div>
 <!-- ... -->
</div>
```


- ****:
- ****: var(--radius-2xl)
- ****:
- ****:

### 4. (Activity Feed)

-
-
-
-


```vue
<div class="activity-list">
 <div class="activity-item">
 <div class="activity-icon message">
 <component :is="getActivityIcon(activity.type)" />
 </div>
 <div class="activity-content">
 <div class="activity-title">{{ activity.title }}</div>
 <div class="activity-description">{{ activity.description }}</div>
 <div class="activity-time">{{ formatTime(activity.createdAt) }}</div>
 </div>
 </div>
</div>
```


- ****:
- ****:
- ****:
- ****:

### 5. (Performance Metrics)

```vue
<div class="performance-section">
 <div class="section-header">
 <h3 class="section-title"></h3>
 <p class="section-subtitle"></p>
 </div>
 <div class="performance-grid">
 <div class="performance-card">
 <div class="performance-icon response-time">
 <!-- SVG -->
 </div>
 <div class="performance-content">
 <div class="performance-value">{{ responseTime }}</div>
 <div class="performance-label"></div>
 </div>
 </div>
 <!-- ... -->
 </div>
</div>
```


- ** SVG **:
- ****:
- ****:
- ****:


```css
/* */
.stat-card.pending::before {
 background: linear-gradient(180deg, #f59e0b, #d97706); /* */
}
.stat-card.active::before {
 background: linear-gradient(180deg, #3b82f6, #2563eb); /* */
}
.stat-card.messages::before {
 background: linear-gradient(180deg, #10b981, #059669); /* */
}
.stat-card.agents::before {
 background: linear-gradient(180deg, #8b5cf6, #7c3aed); /* */
}
```


```css
/* */
.welcome-title {
 font-size: 2.5rem;
 font-weight: 800;
 letter-spacing: -0.025em; /* */
}

.card-title {
 font-size: 1.375rem;
 font-weight: 700;
 letter-spacing: -0.025em;
}

.stat-label {
 font-size: 0.875rem;
 font-weight: 500;
 text-transform: uppercase;
 letter-spacing: 0.05em; /* */
}
```


```css
/* */
.dashboard {
 padding: var(--space-6) var(--space-4);
}

.welcome-section {
 margin-bottom: var(--space-12);
}

.stats-overview {
 margin-bottom: var(--space-12);
}

.content-grid {
 gap: var(--space-8);
 margin-bottom: var(--space-12);
}
```


```css
@media (max-width: 640px) {
 .welcome-actions {
 flex-direction: column;
 width: 100%;
 gap: var(--space-3);
 }

 .stats-grid {
 grid-template-columns: 1fr;
 }

 .card-header {
 flex-direction: column;
 align-items: flex-start;
 gap: var(--space-3);
 }
}
```


```css
@media (max-width: 1024px) {
 .content-grid {
 grid-template-columns: 1fr;
 }

 .welcome-content {
 flex-direction: column;
 text-align: center;
 gap: var(--space-6);
 }
}
```


### CSS
- ****: CSS
- ** CSS **:
- ****: transform opacity
- ****: layout CSS


- ** CSS **:
- ****:
- ****: SVG


| | | | |
|------|--------|--------|----------|
| **** | | | +85% |
| **** | | | +90% |
| **** | | | +80% |
| **** | | | +70% |


- ****: 60%
- ****: 75%
- ****: 80%
- ****: 70%


- **CSS **: 15%
- ****: 10%
- ****: 20%
- ****: 50%


```
Dashboard.vue
 WelcomeSection ()
 StatsOverview ()
 StatCard () × 4
 ContentGrid ()
 ConversationsCard ()
 ActivityCard ()
 PerformanceSection ()
 PerformanceCard () × 3
```

### CSS
```css
:root {
 /* */
 --space-1: 0.25rem;
 --space-12: 3rem;

 /* */
 --radius-xl: 0.75rem;
 --radius-2xl: 1rem;

 /* */
 --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
 --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}
```


-
-
-
-


-
-
-
-


-
-
-
-


-
-
-
-


-
-
-
-


-
- CSS
-
-


### (1-2 )
1. ****:
2. ****:
3. ****:
4. ****:

### (1-2 )
1. ****:
2. ****: Dashboard
3. ****: WebSocket
4. ****:


- [x]
- [x]
- [x]
- [x]
- [x]
- [x]


- [x] Vue 3
- [x] TypeScript
- [x] CSS
- [x]
- [x]
- [x]


- [x]
- [x]
- [x]
- [x]
- [x]
- [x]


- ****: 95/100
- ****: 100%
- ****: 15%
- ****: 80%


- ****:
- ****:
- ****:
- ****: Vue 3 + TypeScript


Dashboard

1. **** -
2. **** -
3. **** - Vue 3 + TypeScript
4. **** -

 Dashboard

---

****: 2025-01-14
****: v2.1.0
****: 