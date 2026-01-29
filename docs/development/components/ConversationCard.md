# ConversationCard


`ConversationCard`


- **** ID
- ****
- ****
- ****
- ****
- ****
- ****
- ****

## (Props)

### `conversation` ()
- ****: `Conversation`
- ****:
- ****:
 - `id`:
 - `user`/`customer`:
 - `assignedAgent`:
 - `status`: 'open''assigned''closed'
 - `platform`: 'line''facebook'
 - `lastMessage`:
 - `unreadCount`:
 - `updatedAt`:

### `selected` ()
- ****: `boolean`
- ****: `false`
- ****:

## (Events)

### `select`
- ****: `Conversation`
- ****:
- ****: `@select="handleConversationSelect"`


### `customerInitials`
- 2
- 'U'
-

### `lastMessageText`
-
- 50
-


### `formatTime(date)`
- ****: `date` (Date | string | number)
- ****:
- ****:
 - < 1 : "X"
 - < 24 : "X"
 - :


-
-


-
-


-
-


-
-


- `PlatformBadge`:
- `StatusBadge`:
- `UserIcon`:


```vue
<ConversationCard
 :conversation="conversation"
 @select="handleSelect"
/>
```


```vue
<ConversationCard
 :conversation="conversation"
 :selected="selectedConversationId === conversation.id"
 @select="handleSelect"
/>
```


```vue
<div class="conversation-list">
 <ConversationCard
 v-for="conversation in conversations"
 :key="conversation.id"
 :conversation="conversation"
 :selected="selectedId === conversation.id"
 @select="selectConversation"
 />
</div>
```


- HTML
- `<time>`
-
-


 CSS
- `--primary-*`:
- `--gray-*`:
- `--space-*`:
- `--radius-*`:
- `--shadow-*`:
- `--transition-*`:


- CSS Grid Flexbox
-
-


-
- Vue DOM
-


-
-
-
-
-
-
-


- `user` `customer`
-
-


- TypeScript
-
- 