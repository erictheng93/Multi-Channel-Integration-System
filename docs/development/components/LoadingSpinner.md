# LoadingSpinner


## (Props)

| | | | |
|------|------|--------|------|
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg'` | `'md'` | |
| `variant` | `'primary' \| 'secondary' \| 'white'` | `'primary'` | |
| `text` | `string` | `''` | |


```vue
<template>
 <LoadingSpinner />
</template>
```


```vue
<template>
 <LoadingSpinner
 size="lg"
 variant="secondary"
 />
</template>
```


```vue
<template>
 <LoadingSpinner
 size="md"
 variant="primary"
 text="..."
 />
</template>
```


```vue
<template>
 <button
 type="submit"
 :disabled="loading"
 >
 <LoadingSpinner
 v-if="loading"
 size="sm"
 variant="white"
 />
 <span v-else></span>
 </button>
</template>
```


- `xs`: 12px × 12px1px
- `sm`: 16px × 16px2px
- `md`: 24px × 24px2px -
- `lg`: 32px × 32px3px


- `primary`:
- `secondary`:
- `white`:


- **** `prefers-reduced-motion`
- **** `text`
- **** HTML


### v2.1.0 (2025-01-08)
- `text`
-
- **** `prefers-reduced-motion`
-
- 