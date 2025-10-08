# Manual Fix Instructions - Infinite Recursion

## Problem
File watchers are preventing automatic application of the fix. Please apply manually.

## Steps

### 1. Open the file in your editor
```
D:/Code/Multi_Channel_Integration_System/frontend/src/views/ConversationDetail.vue
```

### 2. Find lines 1129-1149
Look for this code in the `onMounted()` lifecycle hook:

```typescript
  // Load conversation data asynchronously (don't await in onMounted)
  loadConversation().then(() => {
    // Mark initial loading as complete once WebSocket is set up
    if (isWebSocketEnabled.value) {
      // WebSocket will handle message loading
      hasLoadedInitially.value = true
      isInitialLoading.value = false
    }

    // 🚀 智能預加載相鄰對話
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
})
```

### 3. Replace with this shorter version:

```typescript
  // CRITICAL FIX: Do NOT call loadConversation() here!
  // The route watcher with immediate: true (line 1185-1211) already handles initial load
  // Calling it twice causes race conditions and infinite reactive updates in AppLayout

  // Simply mark mount complete - the route watcher will handle loading
  measure('component-mount', 'component-mount-start')
  console.log('✅ ConversationDetail mounted, route watcher will load conversation')
})
```

### 4. Save the file

### 5. Start Vite dev server
```bash
cd frontend
npm run dev
```

### 6. Clear browser cache
- Open DevTools (F12)
- Right-click refresh → "Empty Cache and Hard Reload"

### 7. Test
Navigate to: `http://localhost:3000/conversations/2f11b76c-672b-461f-9eca-e799cd54f0aa`

**Expected result:** No more "Maximum recursive updates" error!

---

## Alternative: Apply patch file

If you have Git Bash or similar:
```bash
cd D:/Code/Multi_Channel_Integration_System
git apply conversation-detail-fix.patch
```

---

## What This Fix Does

**Before:** `loadConversation()` is called TWICE (in `onMounted` AND in route watcher)
→ Race condition → Infinite recursion

**After:** `loadConversation()` is only called ONCE (in route watcher with `immediate: true`)
→ No race condition → No recursion

The route watcher with `immediate: true` automatically runs when the component mounts, so there's no need to call it again in `onMounted`.
