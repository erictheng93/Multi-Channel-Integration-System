# /


- **** (Oldest Message)
- **** (Latest Message)


### 1. **useMessages.ts** -

```typescript
//
const messageOrderUtils = {
 //
 ensureChronologicalOrder: (messages: Message[]) => Message[]

 //
 getOldestMessage: (messages: Message[]) => Message | null

 //
 getLatestMessage: (messages: Message[]) => Message | null
}
```

### 2. ****

```typescript
// useMessages
{
 oldestMessage, //
 latestMessage, //
 messageUtils: {
 getOldest: () => Message | null,
 getLatest: () => Message | null,
 isOldest: (message: Message) => boolean,
 isLatest: (message: Message) => boolean
 }
}
```

### 3. **MessageIndicator ** -


-
-
-
-

## UI


- ****
- ****
- ****


- flexbox
-
- top


```vue
<script setup>
const {
 messages,
 oldestMessage,
 latestMessage,
 messageUtils
} = useMessages()

// /
const isOldest = messageUtils.isOldest(someMessage)
const isLatest = messageUtils.isLatest(someMessage)
</script>

<template>
 <!-- -->
 <MessageIndicator
 :oldest-message="oldestMessage"
 :latest-message="latestMessage"
 :total-messages="messages.length"
 :show-stats="messages.length > 5"
 />
</template>
```


### 1. ****
-
-
-

### 2. ****
-
-
- /

### 3. ****
-
-
-


- [ ]
- [ ]
- [ ]
- [ ]


- [ ]
- [ ]
- [ ]


- [ ] >100
- [ ]
- [ ]


```
 [useMessages] Processing messages array: X items

 : 2024-01-01 10:00:00
 : 2024-01-02 15:30:00
```


-
-
-


- [ ] API ASC
- [ ]
- [ ] MessageIndicator
- [ ]
- [ ]


-
-
-
- 