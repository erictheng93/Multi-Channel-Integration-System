# FileUpload

 Vue 3


FileUpload

- ****
- ****
- ****
- ****
- ****
- ****
- ****

## (v2.1.0)


- ****
- ****
- **** 5
- **** MIME
- **** ARIA


-
-
-
-

## (Props)

| | | | |
|------|------|--------|------|
| `modelValue` | `FileUploadItem[]` | `[]` | (v-model ) |
| `multiple` | `boolean` | `false` | |
| `maxSize` | `number` | `10485760` | 10MB |
| `maxFiles` | `number` | `5` | |
| `acceptedTypes` | `string` | `''` | |
| `disabled` | `boolean` | `false` | |
| `showDropZone` | `boolean` | `true` | |
| `buttonText` | `string` | `''` | |
| `uploadFunction` | `Function` | `undefined` | |

## (Events)

| | | |
|------|------|------|
| `update:modelValue` | `FileUploadItem[]` | (v-model) |
| `upload-complete` | `FileUploadItem` | |
| `upload-error` | `FileUploadItem, string` | |
| `file-select` | `File[]` | |

## FileUploadItem

```typescript
interface FileUploadItem {
 id?: string; //
 name: string; //
 size?: number; //
 type?: string; // MIME
 file?: File; // File
 url?: string; // URL
 progress?: number; // (0-100)
 uploading?: boolean; //
 uploaded?: boolean; //
 error?: string; //
 retryCount?: number; //
}
```


```vue
<template>
 <FileUpload
 v-model="files"
 @upload-complete="handleUploadComplete"
 @upload-error="handleUploadError"
 />
</template>

<script setup>
import { ref } from 'vue'
import FileUpload from '@/components/ui/FileUpload.vue'

const files = ref([])

const handleUploadComplete = (file) => {
 console.log(':', file)
}

const handleUploadError = (file, error) => {
 console.error(':', file, error)
}
</script>
```


```vue
<template>
 <FileUpload
 v-model="files"
 :upload-function="customUpload"
 :max-size="5 * 1024 * 1024"
 accepted-types=".jpg,.png,.pdf"
 multiple
 />
</template>

<script setup>
import { ref } from 'vue'

const files = ref([])

const customUpload = async (file) => {
 const formData = new FormData()
 formData.append('file', file)

 const response = await fetch('/api/upload', {
 method: 'POST',
 body: formData
 })

 if (!response.ok) {
 throw new Error('')
 }

 const result = await response.json()
 return {
 url: result.url,
 filename: result.filename
 }
}
</script>
```


```vue
<template>
 <FileUpload
 v-model="files"
 :show-drop-zone="false"
 button-text=""
 accepted-types=".jpg,.jpeg,.png,.gif"
 :max-size="2 * 1024 * 1024"
 />
</template>
```


- ****
- **** MIME
- ****
- ****


- ****
- ****
- ****
- ****


- ****
- ****
- ****
- **** 5


- ****
- **** ARIA
- **** Tab
- ****


 CSS

```css
.file-upload {
 --primary-color: #3b82f6;
 --success-color: #10b981;
 --error-color: #ef4444;
 --warning-color: #f59e0b;
 --gray-color: #6b7280;

 --space-1: 0.25rem;
 --space-2: 0.5rem;
 --space-3: 0.75rem;
 --space-4: 1rem;

 --radius-sm: 0.25rem;
 --radius-md: 0.375rem;
 --radius-lg: 0.5rem;
 --radius-xl: 0.75rem;

 --transition-fast: 150ms ease;
 --transition-normal: 300ms ease;
}
```


- **39 **
- **100% **
- ****
- ****


```bash
bun run test -- src/components/ui/FileUpload.test.ts
```


- ****
- ****
- ****
- ****


- ****Chrome 90+Firefox 88+Safari 14+
- ****iOS Safari 14+Chrome Mobile 90+
- ****
- **File API** File API

---

*202518*
*2.1.0*
*39/39 *