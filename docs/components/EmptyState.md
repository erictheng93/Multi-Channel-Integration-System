# EmptyState


`EmptyState` Vue 3

## (2025-01-08)


1. ****
 - `loading`
 - `loadingText`
 -

2. ****
 - `actionText`
 -
 - `action`

3. ****
 - `title` `description`
 -
 -
 - `small``medium``large`

4. ****
 -
 -

## (Props)

| | | | |
|------|------|--------|------|
| `title` | `string` | `undefined` | |
| `description` | `string` | `undefined` | |
| `actionText` | `string` | `undefined` | |
| `loading` | `boolean` | `false` | true |
| `loadingText` | `string` | `undefined` | |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | |

## (Events)

| | | |
|------|------|------|
| `action` | `[]` | |

## (Slots)

| | |
|------|------|
| `default` | |
| `icon` | |
| `action` | |


```vue
<template>
 <EmptyState
 title=""
 description=""
 />
</template>
```


```vue
<template>
 <EmptyState
 title=""
 description=""
 actionText=""
 @action="handleNewConversation"
 />
</template>
```


```vue
<template>
 <EmptyState
 title=""
 :loading="isLoading"
 loadingText="..."
 />
</template>
```


```vue
<template>
 <EmptyState title="">
 <div class="custom-content">
 <p></p>
 <button @click="doSomething"></button>
 </div>
 </EmptyState>
</template>
```


```vue
<template>
 <EmptyState title="">
 <template #icon>
 <FileIcon />
 </template>

 <template #action>
 <button class="primary-btn" @click="uploadFile">

 </button>
 <button class="secondary-btn" @click="createFile">

 </button>
 </template>
 </EmptyState>
</template>
```


```vue
<template>
 <!-- -->
 <EmptyState
 size="small"
 title=""
 description=""
 />

 <!-- -->
 <EmptyState
 title=""
 description=""
 />

 <!-- -->
 <EmptyState
 size="large"
 title=""
 description=""
 />
</template>
```


 CSS

- `.empty-state` -
- `.empty-state.small` -
- `.empty-state.medium` -
- `.empty-state.large` -
- `.loading-spinner` -
- `.empty-icon` -
- `.empty-content` -
- `.empty-title` -
- `.empty-description` -
- `.empty-custom` -
- `.empty-actions` -
- `.empty-action` -
- `.loading-text` -


- HTML
- ARIA
-
-


-
-
-
-
-
-


```bash
npm test -- src/components/ui/EmptyState.test.ts
```


 EmptyState

1. ****`title` `description`
2. **** `actionText` `action`
3. **** `loading`
4. **** `size` CSS


- -
-


- Vue 3 Composition API
-
- DOM
- CSS


- Vue 3
- IE11+ Vue 3 polyfills
- iOS SafariChrome Mobile