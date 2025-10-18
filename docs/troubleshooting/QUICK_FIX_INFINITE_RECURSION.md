# Quick Fix: AppLayout Infinite Recursion

## Problem
`loadConversation()` is called **TWICE simultaneously** in ConversationDetail.vue:
1. In `onMounted()` (Line 1130)
2. In route watcher with `immediate: true` (Line 1201)

This creates a race condition cascade of reactive updates infinite recursion in AppLayout.

---

## Solution
Remove the duplicate call from `onMounted()`. The route watcher with `immediate: true` already handles initial load.

---

## Steps to Fix

### 1. Stop Vite Dev Server
In your terminal where `npm run dev` is running:
```bash
Press Ctrl+C
```

### 2. Apply the Fix
Open: `frontend/src/views/ConversationDetail.vue`

Find lines 1129-1149:
```typescript
 // Load conversation data asynchronously (don't await in onMounted)
 loadConversation().then(() => {
 // Mark initial loading as complete once WebSocket is set up
 if (isWebSocketEnabled.value) {
 // WebSocket will handle message loading
 hasLoadedInitially.value = true
 isInitialLoading.value = false
 }

 //
 if (conversationId.value) {
 conversationsStore.preloadAdjacentConversationMessages(conversationId.value)
 }

 measure('component-mount', 'component-mount-start')
 }).catch(error => {
 console.error('Failed to initialize ConversationDetail component:', error)
 // Handle critical initialization errors
 isInitialLoading.value = false
 router.push('/conversations')
 })
```

**Replace with:**
```typescript
 // CRITICAL FIX: Do NOT call loadConversation() here!
 // The route watcher with immediate: true (line 1185-1211) already handles initial load
 // Calling it twice causes race conditions and infinite reactive updates in AppLayout

 // Simply mark mount complete - the route watcher will handle loading
 measure('component-mount', 'component-mount-start')
 console.log(' ConversationDetail mounted, route watcher will load conversation')
```

### 3. Restart Vite
```bash
cd frontend
npm run dev
```

### 4. Clear Browser Cache
- Open DevTools (F12)
- Right-click refresh button
- Select "Empty Cache and Hard Reload"

### 5. Test
Navigate to: `http://localhost:3000/conversations/2f11b76c-672b-461f-9eca-e799cd54f0aa`

**Success indicators:**
- No "Maximum recursive updates" error
- Page loads normally
- Console shows: " ConversationDetail mounted, route watcher will load conversation"

---

## Why This Works

**Before:** Two simultaneous calls to `loadConversation()` store updates twice AppLayout reacts cascade of updates infinite loop

**After:** Single call via route watcher controlled store update no race condition no recursion

---

See `INFINITE_RECURSION_ROOT_CAUSE_ANALYSIS.md` for detailed technical analysis.
