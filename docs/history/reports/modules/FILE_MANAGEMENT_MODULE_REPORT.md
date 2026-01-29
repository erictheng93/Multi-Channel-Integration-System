# File Management Module Refactoring Report


 Multi-Channel Integration System


- ****
- ****
- **** TypeScript
- **** API
- ****


```
src/modules/file-management/
 index.ts #
 types/ #
 index.ts
 file-types.ts #
 storage-types.ts #
 validation-types.ts #
 services/ #
 file-service.ts #
 storage-service.ts # R2
 validation-service.ts #
 metadata-service.ts #
 handlers/ # API
 file-handler.ts # API
 upload-handler.ts # API
 middleware/ #
 file-validation.ts #
 upload-limiter.ts #
 routes/ #
 file-routes.ts #
 utils/ #
 file-helpers.ts #
 mime-type-utils.ts # MIME
 constants/ #
 file-config.ts #
 error-codes.ts #
```


### 1. (File Services)

#### FileService -
-
-
-
-
-

#### ValidationService -
- (LINE, Facebook, System, Admin)
-
-
- ()

#### MetadataService -
-
-
-
-

#### StorageService -
- Cloudflare R2
- //
- URL
-

### 2. API (Handlers)

#### FileHandler - API
- RESTful API
-
-
-
- API

#### UploadHandler - API
-
-
-
-

### 3. (Middleware)


-
-
-
-


-
- (/)
-
-

### 4. (Routes)


- `/api/files/*` -
- `/api/files/upload/*` -
- `/api/conversations/:id/files/*` -
- `/api/messages/:id/files/*` -
- `/api/files/admin/*` -


 `attachment-refactored.ts` API

```typescript
// API
export const attachmentHandler = {
 upload: async (c) => { /* */ },
 get: async (c) => { /* */ },
 download: async (c) => { /* */ },
 delete: async (c) => { /* */ },
 list: async (c) => { /* */ }
};
```

### API
-
-
-


```typescript
//
interface ManagedFile {
 id: string;
 filename: string;
 mimeType: string;
 size: number;
 type: FileType;
 platform: PlatformType;
 processingStatus: FileProcessingStatus;
 // ...
}

//
type PlatformType = 'line' | 'facebook' | 'system' | 'admin';

//
type FileType = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';
```


```typescript
interface FileValidationRules {
 maxSize?: number;
 allowedMimeTypes?: string[];
 allowedExtensions?: string[];
 prohibitedExtensions?: string[];
 customValidators?: FileValidator[];
}
```


-
-
-
-


-
- MIME
-
-
-


- ****
- ****API
- ****
- ****
- ****


- [x]
- [x]
- [x] API
- [x]
- [x]
- [x]
- [x]
- [x]
- [x]


- [ ] (StorageService )
- [ ]
- [ ]
- [ ]
- [ ]
- [ ]


- ****
- **** TypeScript
- ****
- ****


- ****LINEFacebookSystemAdmin
- ****
- ****
- ****


- ****
- ****
- ****
- ****


```typescript
import { FileService, createFileHandler } from '@/modules/file-management';

//
const fileService = new FileService(env);
const result = await fileService.uploadFile(request);

//
const fileHandler = createFileHandler(env);
app.post('/api/files/upload', fileHandler.upload);
```


```typescript
import { createFileRoutes } from '@/modules/file-management';

const fileRoutes = createFileRoutes();
app.route('/api/files', fileRoutes);
```


1. **** R2
2. ****
3. ****
4. **** API
5. ****

---

****