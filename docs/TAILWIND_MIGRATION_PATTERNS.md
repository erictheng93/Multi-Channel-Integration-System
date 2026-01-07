# Tailwind CSS Migration Patterns Guide

**Purpose**: Detailed guide for migrating Vue components from traditional CSS to Tailwind CSS
**Audience**: Frontend developers working on component migrations
**Last Updated**: 2026-01-07

---

## 📚 Table of Contents

1. [When to Use Each Pattern](#when-to-use-each-pattern)
2. [Pattern 1: Full Tailwind Conversion](#pattern-1-full-tailwind-conversion)
3. [Pattern 2: Hybrid @apply Approach](#pattern-2-hybrid-apply-approach)
4. [Pattern 3: Responsive Migration](#pattern-3-responsive-migration)
5. [Pattern 4: Dark Mode Support](#pattern-4-dark-mode-support)
6. [Pattern 5: Animation Preservation](#pattern-5-animation-preservation)
7. [Common Pitfalls & Solutions](#common-pitfalls--solutions)
8. [Decision Tree](#decision-tree)

---

## When to Use Each Pattern

### Quick Reference Table

| CSS Feature | Recommended Pattern | Example Component |
|-------------|-------------------|-------------------|
| Simple layout (flex, grid) | **Full Tailwind** | DateSeparator.vue |
| Responsive breakpoints | **Full Tailwind** (`md:`, `sm:`) | ConversationFilters.vue |
| Dark mode | **Full Tailwind** (`dark:`) | MessageIndicator.vue |
| Animations (`@keyframes`) | **Hybrid @apply** | TypingIndicator.vue |
| Gradients (multi-stop) | **Hybrid @apply** | CacheStatusIndicator.vue |
| Complex hover effects | **Hybrid @apply** | QuickAssignActions.vue |
| Performance optimizations | **Preserve in CSS** | ConversationList.vue |

---

## Pattern 1: Full Tailwind Conversion

**Use When**: Component has simple CSS with no animations, gradients, or complex transforms

### ✅ Good Candidates
- Layout containers (flex, grid, positioning)
- Text styling (font-size, font-weight, color)
- Spacing (padding, margin, gap)
- Borders and shadows (standard values)
- Basic responsive design

### Step-by-Step Process

#### Step 1: Identify Tailwind Equivalents

```css
/* BEFORE - Traditional CSS */
.container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  gap: 12px;
}
```

#### Step 2: Convert to Tailwind Utilities

```vue
<!-- AFTER - Tailwind Utilities -->
<div class="flex items-center justify-between py-4 px-6 bg-white border border-gray-200 rounded-lg gap-3">
```

**Mapping Table**:
| CSS Property | Tailwind Class |
|-------------|----------------|
| `display: flex` | `flex` |
| `align-items: center` | `items-center` |
| `justify-content: space-between` | `justify-between` |
| `padding: 16px 24px` | `py-4 px-6` |
| `background: white` | `bg-white` |
| `border: 1px solid #e5e7eb` | `border border-gray-200` |
| `border-radius: 8px` | `rounded-lg` |
| `gap: 12px` | `gap-3` |

#### Step 3: Remove CSS Block

```vue
<style scoped>
/* All styles converted to Tailwind utilities */
</style>
```

### Complete Example: DateSeparator.vue

```vue
<template>
  <!-- Before: class="date-separator" -->
  <div class="flex items-center my-6 mb-4 gap-3 md:my-4 md:mb-3 md:gap-2">
    <!-- Before: class="separator-line" -->
    <div class="flex-1 h-px bg-gray-300 dark:bg-gray-600" />

    <!-- Before: class="separator-label" -->
    <div class="py-2 px-4 bg-gray-100 border border-gray-300 rounded-full text-xs font-semibold text-gray-600 whitespace-nowrap text-center min-w-[80px] md:py-1 md:px-3 md:text-[0.7rem] md:min-w-[60px] dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300">
      {{ formattedDate }}
    </div>

    <div class="flex-1 h-px bg-gray-300 dark:bg-gray-600" />
  </div>
</template>

<script setup lang="ts">
// Script remains unchanged
</script>

<style scoped>
/* All styles converted to Tailwind utilities */
</style>
```

**Result**:
- CSS: 53 lines → 0 lines (100% reduction)
- Total: 103 lines → 51 lines (50% reduction)
- Build: ✅ SUCCESS

---

## Pattern 2: Hybrid @apply Approach

**Use When**: Component has animations, gradients, or complex CSS that cannot be represented in Tailwind

### ✅ Good Candidates
- Components with `@keyframes` animations
- Multi-stop linear gradients
- Complex `:hover`, `:focus`, `:active` states
- Custom shadows or filters
- Nested selectors (`:nth-child`, `:before`, `:after`)

### Step-by-Step Process

#### Step 1: Identify What to Preserve

```css
/* BEFORE - Mixed CSS */
.typing-indicator {
  display: flex;          /* ← Convert to Tailwind */
  align-items: center;    /* ← Convert to Tailwind */
  opacity: 0;             /* ← Convert to Tailwind */
  transform: translateY(4px);  /* ← PRESERVE (complex transform) */
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);  /* ← PRESERVE */
  pointer-events: none;   /* ← Convert to Tailwind */
}

.typing-dot {
  width: 3px;             /* ← Convert to Tailwind */
  height: 3px;            /* ← Convert to Tailwind */
  background: blue;       /* ← Convert to Tailwind */
  border-radius: 50%;     /* ← Convert to Tailwind */
  animation: pulse 1.4s infinite;  /* ← PRESERVE (@keyframes) */
}

@keyframes pulse {        /* ← PRESERVE (animation definition) */
  0% { transform: scale(1); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}
```

#### Step 2: Apply Hybrid Approach

```vue
<style scoped>
/* Hybrid: Tailwind @apply + Preserved CSS */
.typing-indicator {
  @apply flex items-center opacity-0 pointer-events-none;
  /* Preserve complex CSS */
  transform: translateY(4px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.typing-dot {
  @apply w-[3px] h-[3px] bg-blue-500 rounded-full;
  /* Preserve animation */
  animation: pulse 1.4s infinite ease-in-out;
}

/* Preserve @keyframes */
@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.2); opacity: 1; }
}
</style>
```

### Complete Example: TypingIndicator.vue

```vue
<template>
  <div class="typing-indicator" :class="{ 'typing-active': isActive }">
    <div class="typing-content">
      <!-- Tailwind utilities in template -->
      <div class="flex items-center gap-0.5">
        <div class="typing-dot" />
        <div class="typing-dot" />
        <div class="typing-dot" />
      </div>
      <div class="font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px] md:max-w-[120px]">
        {{ typingText }}
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Hybrid approach */
.typing-indicator {
  @apply flex items-center opacity-0 pointer-events-none;
  transform: translateY(4px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.typing-active {
  @apply opacity-100 pointer-events-auto;
  transform: translateY(0);
}

.typing-content {
  @apply flex items-center gap-2 py-1 px-2 rounded-full text-xs text-blue-700;
  @apply md:py-0.5 md:px-1 md:text-[0.625rem] md:gap-1;
  @apply dark:text-blue-300;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.typing-dot {
  @apply w-[3px] h-[3px] bg-blue-500 rounded-full md:w-0.5 md:h-0.5 dark:bg-blue-400;
  animation: typing-pulse 1.4s infinite ease-in-out;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.4s;
}

/* Preserved animation */
@keyframes typing-pulse {
  0%, 60%, 100% { transform: scale(1); opacity: 0.5; }
  30% { transform: scale(1.2); opacity: 1; }
}
</style>
```

**Result**:
- CSS: 121 lines → 71 lines (41.3% reduction)
- Total: 199 lines → 150 lines (24.6% reduction)
- Build: ✅ SUCCESS
- Functionality: 100% preserved

---

## Pattern 3: Responsive Migration

**Use When**: Component has media queries for different screen sizes

### Tailwind Breakpoints

| Breakpoint | CSS | Tailwind Prefix | Screen Size |
|-----------|-----|-----------------|-------------|
| Mobile | Default | (none) | < 640px |
| Tablet | `@media (min-width: 640px)` | `sm:` | ≥ 640px |
| Desktop | `@media (min-width: 768px)` | `md:` | ≥ 768px |
| Large | `@media (min-width: 1024px)` | `lg:` | ≥ 1024px |
| XL | `@media (min-width: 1280px)` | `xl:` | ≥ 1280px |

### Step-by-Step Process

#### Step 1: Identify Media Queries

```css
/* BEFORE - Media Queries */
.container {
  display: flex;
  flex-direction: row;
  gap: 24px;
  padding: 24px;
}

@media (max-width: 768px) {
  .container {
    flex-direction: column;
    gap: 12px;
    padding: 12px;
  }
}

@media (max-width: 640px) {
  .container {
    gap: 8px;
    padding: 8px;
  }
}
```

#### Step 2: Convert to Tailwind Responsive Utilities

```vue
<!-- AFTER - Tailwind Responsive -->
<div class="flex flex-row gap-6 p-6 md:flex-col md:gap-3 md:p-3 sm:gap-2 sm:p-2">
```

**Mobile-First Approach**:
1. Base classes apply to mobile (default)
2. `md:` classes apply from 768px up
3. `sm:` classes apply from 640px up

### Complete Example: ConversationFilters.vue

```vue
<template>
  <!-- Desktop → Tablet → Mobile progression -->
  <div class="flex items-center justify-between gap-6 mt-6 lg:flex-col lg:items-stretch lg:gap-4">

    <!-- Filter controls - horizontal on desktop, vertical on tablet -->
    <div class="flex gap-4 md:flex-col md:gap-3">
      <div class="flex flex-col gap-1 md:w-full">
        <label class="text-xs font-medium text-gray-700 uppercase tracking-wider">
          狀態篩選
        </label>
        <select class="form-select">
          <!-- options -->
        </select>
      </div>
    </div>

    <!-- Stats - horizontal on desktop, vertical on mobile -->
    <div class="flex gap-6 lg:justify-center sm:flex-col sm:gap-3">
      <div class="flex flex-col items-center text-center sm:flex-row sm:justify-between sm:p-3 sm:bg-gray-50 sm:rounded-lg">
        <span class="text-2xl font-bold text-primary-600 leading-none">
          {{ totalConversations }}
        </span>
        <span class="text-xs text-gray-600 font-medium mt-1 sm:mt-0">
          總對話
        </span>
      </div>
    </div>
  </div>
</template>
```

**Responsive Behavior**:
- **Desktop** (≥1024px): Horizontal layout, centered stats
- **Tablet** (768-1023px): Vertical filters, horizontal stats
- **Mobile** (< 768px): Vertical filters, vertical stats with background

---

## Pattern 4: Dark Mode Support

**Use When**: Component should adapt to user's color scheme preference

### Tailwind Dark Mode Utilities

#### Method 1: Inline `dark:` Utilities (Recommended)

```vue
<template>
  <div class="bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100">
    <h1 class="text-gray-700 dark:text-gray-300">Title</h1>
    <div class="border-gray-200 dark:border-gray-700">
      <!-- content -->
    </div>
  </div>
</template>
```

#### Method 2: Hybrid with @apply

```vue
<style scoped>
.component {
  @apply bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100;
}

/* OR use media query for complex cases */
@media (prefers-color-scheme: dark) {
  .component {
    background: rgba(31, 41, 55, 0.9);
    border-color: rgba(55, 65, 81, 0.8);
  }
}
</style>
```

### Complete Example: DateSeparator.vue

```vue
<template>
  <div class="flex items-center my-6 mb-4 gap-3 md:my-4 md:mb-3 md:gap-2">
    <!-- Dark mode: bg-gray-300 → bg-gray-600 -->
    <div class="flex-1 h-px bg-gray-300 dark:bg-gray-600" />

    <!-- Dark mode: multiple properties -->
    <div class="py-2 px-4 bg-gray-100 border border-gray-300 rounded-full text-xs font-semibold text-gray-600 whitespace-nowrap text-center min-w-[80px] md:py-1 md:px-3 md:text-[0.7rem] md:min-w-[60px] dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300">
      {{ formattedDate }}
    </div>

    <div class="flex-1 h-px bg-gray-300 dark:bg-gray-600" />
  </div>
</template>
```

**Dark Mode Mapping**:
| Light Mode | Dark Mode |
|------------|-----------|
| `bg-white` | `dark:bg-gray-900` |
| `bg-gray-100` | `dark:bg-gray-800` |
| `bg-gray-200` | `dark:bg-gray-700` |
| `text-gray-900` | `dark:text-gray-100` |
| `text-gray-700` | `dark:text-gray-300` |
| `border-gray-200` | `dark:border-gray-700` |

---

## Pattern 5: Animation Preservation

**Use When**: Component uses `@keyframes` animations

### What to Preserve

✅ **Always Preserve**:
- `@keyframes` animation definitions
- `animation` property (name, duration, timing)
- `transition` with custom cubic-bezier
- Complex `transform` sequences

⚠️ **Can Convert to Tailwind**:
- Simple `transition: all 0.3s ease`
  - Use: `transition-all duration-300 ease-in-out`
- Basic transforms (`rotate`, `scale`, `translate`)
  - Use: `rotate-180`, `scale-110`, `translate-x-4`

### Complete Example: CacheStatusIndicator.vue

```vue
<template>
  <div class="cache-status-indicator" :title="`快取命中率: ${hitRate.toFixed(1)}%`">
    <div class="cache-icon text-sm">⚡</div>
    <span class="font-bold tracking-wider">{{ hitRate.toFixed(0) }}%</span>
  </div>
</template>

<style scoped>
/* Hybrid: @apply + preserved gradient/animation */
.cache-status-indicator {
  @apply flex items-center gap-1 py-1 px-2 text-white rounded-full text-xs font-semibold;
  /* Preserved gradient (multi-stop) */
  background: linear-gradient(135deg, #10b981, #059669);
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
  transition: all 0.3s ease;
}

.cache-status-indicator:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
}

.cache-icon {
  /* Preserved animation */
  animation: cache-pulse 2s ease-in-out infinite;
}

/* Preserved @keyframes */
@keyframes cache-pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.1);
  }
}
</style>
```

---

## Common Pitfalls & Solutions

### Pitfall 1: TypeScript Class Binding Errors

**Problem**:
```vue
<!-- ❌ TypeScript Error: Type mismatch -->
<ChevronDownIcon :class="{ 'rotate-180': showMenu }" />
```

**Solution**:
```vue
<!-- ✅ Use string template -->
<ChevronDownIcon :class="`w-4 h-4 transition-transform ${showMenu ? 'rotate-180' : ''}`" />
```

---

### Pitfall 2: Arbitrary Values Not Working

**Problem**:
```vue
<!-- ❌ Class not generated -->
<div class="min-w-80px">
```

**Solution**:
```vue
<!-- ✅ Use square brackets -->
<div class="min-w-[80px]">

<!-- ✅ For exact pixel values -->
<div class="text-[0.7rem] w-[3px] h-[3px]">
```

---

### Pitfall 3: Missing Dark Mode Classes

**Problem**:
```css
/* ❌ No dark mode support */
<div class="bg-gray-100 text-gray-700">
```

**Solution**:
```vue
<!-- ✅ Add dark: variants -->
<div class="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
```

---

### Pitfall 4: Overusing @apply

**Problem**:
```css
/* ❌ Defeats purpose of Tailwind */
.button {
  @apply flex items-center justify-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 transition-all duration-200;
}
```

**Solution**:
```vue
<!-- ✅ Use utilities directly in template -->
<button class="flex items-center justify-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 transition-all duration-200">
```

**When to Use @apply**:
- Component has complex CSS that's repeated
- Animation keyframes need to be preserved
- Gradients or shadows are used

---

### Pitfall 5: Losing Performance Optimizations

**Problem**:
```css
/* ❌ Don't remove these */
.virtual-list {
  transform: translateZ(0);  /* GPU acceleration */
  will-change: transform;     /* Performance hint */
  backface-visibility: hidden; /* Rendering optimization */
}
```

**Solution**:
```css
/* ✅ Preserve in hybrid approach */
.virtual-list {
  @apply overflow-hidden;
  /* Preserve performance optimizations */
  transform: translateZ(0);
  will-change: transform;
  backface-visibility: hidden;
}
```

---

## Decision Tree

```
START: Should I migrate this component?
│
├─ Does it have 10+ @keyframes animations?
│  └─ YES → ❌ SKIP (too complex, minimal ROI)
│  └─ NO → Continue
│
├─ Is CSS > 300 lines?
│  └─ YES → ⚠️ ASSESS ROI (might be complex)
│  └─ NO → ✅ Good candidate
│
├─ Does it use complex gradients (5+ variants)?
│  └─ YES → Use Hybrid @apply
│  └─ NO → Continue
│
├─ Does it have @keyframes animations?
│  └─ YES → Use Hybrid @apply (preserve animations)
│  └─ NO → Continue
│
├─ Does it have responsive media queries?
│  └─ YES → Use Full Tailwind (md:, sm: utilities)
│  └─ NO → Continue
│
├─ Does it need dark mode?
│  └─ YES → Use Full Tailwind (dark: utilities)
│  └─ NO → Continue
│
└─ Default → ✅ Use Full Tailwind Conversion
```

---

## Quick Reference: Tailwind Class Mappings

### Layout
| CSS | Tailwind |
|-----|----------|
| `display: flex` | `flex` |
| `flex-direction: column` | `flex-col` |
| `align-items: center` | `items-center` |
| `justify-content: space-between` | `justify-between` |
| `gap: 12px` | `gap-3` |
| `position: relative` | `relative` |
| `position: absolute` | `absolute` |

### Spacing
| CSS | Tailwind |
|-----|----------|
| `padding: 8px` | `p-2` |
| `padding: 16px 24px` | `py-4 px-6` |
| `margin: 24px 0` | `my-6` |
| `gap: 12px` | `gap-3` |

### Typography
| CSS | Tailwind |
|-----|----------|
| `font-size: 12px` | `text-xs` |
| `font-size: 14px` | `text-sm` |
| `font-weight: 500` | `font-medium` |
| `font-weight: 600` | `font-semibold` |
| `color: #374151` | `text-gray-700` |

### Borders & Radius
| CSS | Tailwind |
|-----|----------|
| `border: 1px solid #e5e7eb` | `border border-gray-200` |
| `border-radius: 4px` | `rounded` |
| `border-radius: 8px` | `rounded-lg` |
| `border-radius: 9999px` | `rounded-full` |

### Colors
| CSS | Tailwind |
|-----|----------|
| `background: white` | `bg-white` |
| `background: #f3f4f6` | `bg-gray-100` |
| `color: #111827` | `text-gray-900` |
| `color: #6b7280` | `text-gray-500` |

---

**Document Version**: 1.0
**Last Updated**: 2026-01-07
**Author**: Senior Developer & Tech Lead
