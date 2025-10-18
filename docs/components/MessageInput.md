# MessageInput


`MessageInput` MVP


-
-
-
-
-
-
-


```vue
<template>
 <MessageInput
 :conversation-id="conversationId"
 @message-sent="handleMessageSent"
 @attachment-upload="handleAttachmentUpload"
 />
</template>

<script setup>
import MessageInput from '@/components/conversation/MessageInput.vue'

const conversationId = ref('conv-123')

const handleMessageSent = (data) => {
 console.log(':', data.content)
 console.log(':', data.attachments)
}

const handleAttachmentUpload = (attachment) => {
 console.log(':', attachment.name)
}
</script>
```


```vue
<MessageInput
 :conversation-id="conversationId"
 :disabled="isConversationClosed"
 @message-sent="handleMessageSent"
/>
```

## (Props)

| | | | | |
|------|------|------|--------|------|
| `conversationId` | `string` | | - | ID |
| `disabled` | `boolean` | | `false` | true |

## (Events)

### `message-sent`


**:**
```typescript
{
 content: string //
 attachments: Attachment[] //
}
```

**:**
```vue
<MessageInput @message-sent="onMessageSent" />

<script setup>
const onMessageSent = ({ content, attachments }) => {
 console.log(`: "${content}" ${attachments.length} `)
}
</script>
```

### `attachment-upload`


**:**
```typescript
{
 name: string //
 size: number //
 file: File //
}
```

**:**
```vue
<MessageInput @attachment-upload="onAttachmentUpload" />

<script setup>
const onAttachmentUpload = (attachment) => {
 console.log(`: ${attachment.name} (${attachment.size} )`)
}
</script>
```


| | |
|----------|------|
| `Enter` | |
| `Shift + Enter` | |


- ****: `image/*` (JPGPNGGIF )
- ****: `application/pdf``.doc``.docx`


- ****: 10MB
- ****:
- ****:


- `1024 bytes` `1 KB`
- `1048576 bytes` `1 MB`
- `1073741824 bytes` `1 GB`


```

```


```
 filename.pdf 10MB
```

### API
 API


-
- 3


### CSS

 CSS

```css
/* */
--space-1, --space-2, --space-3, --space-4, --space-6

/* */
--gray-50, --gray-100, --gray-200, --gray-300, --gray-400, --gray-500, --gray-600, --gray-700, --gray-900
--primary-400, --primary-500, --primary-600
--red-50, --red-100, --red-200, --red-600, --red-700

/* */
--radius-sm, --radius-md, --radius-lg, --radius-xl, --radius-full

/* */
--shadow-sm

/* */
--transition-fast
```


```css
/* */
@media (max-width: 768px) {
 /* */
}
```


### ARIA
-
-
- HTML


-
- Tab
- Enter/Shift+Enter


-
-
-

## API


 `messageApi`

```typescript
import { messageApi } from '@/api/message'

// API
const response = await messageApi.send(conversationId, {
 content: messageText,
 messageType: 'text',
 platform: 'line'
})
```

### API

```typescript
//
{
 success: true,
 data: {
 id: 'msg-123',
 content: '',
 // ...
 }
}

//
{
 success: false,
 error: {
 message: ''
 }
}
```


```typescript
const messageText = ref('') //
const attachments = ref([]) //
const sending = ref(false) //
const error = ref('') //
```


```typescript
const canSend = computed(() => {
 return (messageText.value.trim().length > 0 || attachments.value.length > 0) && !props.disabled
})
```


-
- 120px
- DOM


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


```bash

npm run test -- MessageInput.test.ts


npm run test:coverage -- MessageInput.test.ts
```


1. `conversationId`
2. API
3.
4.


1. 10MB
2.
3.
4. API


1. CSS
2.
3.


```javascript
//
localStorage.setItem('debug', 'MessageInput')
```


1. ****: `conversationId`
2. ****: `message-sent``attachment-upload`
3. ****: CSS
4. ** API**: messageApi


- `send` `message-sent`
-
- CSS


1. : `npm install`
2. : `npm run dev`
3. : `npm run test`
4. : `npm run type-check`


- Vue 3 Composition API
- TypeScript
- CSS
-
- JSDoc

### Pull Request

- [ ]
- [ ] TypeScript
- [ ]
- [ ]
- [ ]
- [ ]


- `MessageBubble` -
- `ConversationDetail` - MessageInput
- `FileIcon``SendIcon` - UI


- `@/api/message` - API
- `@/components/icons` -
- `vue` - Vue 3
- File API - 