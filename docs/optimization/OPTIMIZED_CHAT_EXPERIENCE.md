


1. ****
2. ****
3. ****


### 1. ****
```typescript
// ASC
.orderBy(messages.createdAt) //

//
ensureChronologicalOrder: (messages) => {
 return messages.sort((a, b) =>
 new Date(a.createdAt) - new Date(b.createdAt)
 )
}
```

### 2. ****
```typescript
//
onMounted(async () => {
 await setConversationId(conversationId.value) // 1.
 await loadConversation() // 2.
 await loadMessages() // 3.
 isInitialLoad.value = false // 4.
 startPolling() // 5.
})
```

### 3. ****
```typescript
//
const threshold = 150 //
const nearTop = scrollTop < threshold

if (nearTop && hasMore.value && !loadingHistory.value) {
 //
 const currentScrollHeight = messagesContainer.value.scrollHeight

 await loadMoreMessages()

 //
 const newScrollHeight = messagesContainer.value.scrollHeight
 const heightDiff = newScrollHeight - currentScrollHeight
 messagesContainer.value.scrollTop = scrollTop + heightDiff
}
```

### 4. ****
```typescript
//
function scrollToBottom(force = false) {
 const isNearBottom = (scrollHeight - scrollTop - clientHeight) < 200

 if (isNearBottom || force) {
 //
 messagesContainer.scrollTo({ top: scrollHeight, behavior: 'smooth' })
 } else {
 //
 console.log('')
 }
}
```


### 1. ****
```vue
<!-- -->
<div class="history-loading-wrapper" v-if="loadingHistory">
 <LoadingSpinner />
 <span>...</span>
 <div class="loading-progress-bar"></div> <!-- -->
</div>
```

### 2. ****
- ****
- ****
- **Sticky **

### 3. ****
```typescript
pageSize: 20 // 50 20
```


### ****
1. 20
2.
3.

### ****
1. 150px
2.
3.
4.

### ****
1.
2.

### ****
1.
2.
3.


### ****
```typescript
//
await setConversationId() // rawMessages
// loadMessages() smoothMessages
// UI

//
await setConversationId()
await loadMessages() //
```

### ****
```typescript
//
//
const heightDiff = newScrollHeight - currentScrollHeight
messagesContainer.scrollTop = scrollTop + heightDiff
```


### ****
 ****
 ****
 ****
 ****

### ****
 20
 150px


1. ****
 - [ ]
 - [ ]
 - [ ]
 - [ ]

2. ****
 - [ ]
 - [ ]
 - [ ]
 - [ ]

3. ****
 - [ ]
 - [ ]
 - [ ]
 - [ ]


1. ****
2. ****
3. ****
4. ****150px
5. ****

