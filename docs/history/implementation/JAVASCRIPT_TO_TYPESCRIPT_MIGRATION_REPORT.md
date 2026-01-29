# JavaScript TypeScript


 ** JavaScript TypeScript**
 ****
 ****


### 1.
- `frontend/scripts/build-analysis.js` `frontend/scripts/build-analysis.ts`
 -
 -
 - `tsx`

### 2.

#### package.json
```diff
- "build:report": "node scripts/build-analysis.js"
+ "build:report": "npx tsx scripts/build-analysis.ts"

- "db:migrate:attachments": "node database/migrate-file-attachments.js"
+ "db:migrate:attachments": "npx tsx database/migrate-file-attachments.ts"

- "db:migrate:attachments:verify": "node database/migrate-file-attachments.js --verify"
+ "db:migrate:attachments:verify": "npx tsx database/migrate-file-attachments.ts --verify"

- "setup:r2": "node scripts/setup-r2-storage.js"
+ "setup:r2": "npx tsx scripts/setup-r2-storage.ts"

- "setup:r2:prod": "node scripts/setup-r2-storage.js --prod"
+ "setup:r2:prod": "npx tsx scripts/setup-r2-storage.ts --prod"
```


```diff
- $distFiles = @("dist/_redirects", "dist/functions/_middleware.js")
+ $distFiles = @("dist/_redirects", "dist/functions/_middleware.ts")
```

### 3.

#### PowerShell
- `scripts/create-test-users.ps1`
 ```diff
 - $hashScript | Out-File -FilePath "temp-hash.js"
 - $passwordHashes = node temp-hash.js
 - Remove-Item "temp-hash.js"
 + $hashScript | Out-File -FilePath "temp-hash.ts"
 + $passwordHashes = npx tsx temp-hash.ts
 + Remove-Item "temp-hash.ts"
 ```

- `scripts/setup-delayed-messaging.ps1`
 ```diff
 - $testScript | Out-File -FilePath "test-delayed-message.js"
 + $testScript | Out-File -FilePath "test-delayed-message.ts"
 ```

### 4.

#### TypeScript
```diff
- import { CONFIG } from '../config.js';
+ import { CONFIG } from '../config';
```


### 1. build-analysis.ts
```typescript
//
const statsPath: string = resolve('dist/bundle-analysis.html')
const distPath: string = resolve('dist')

//
const errorMessage = error instanceof Error ? error.message : 'Unknown error'
```

### 2.


```typescript
function hashPassword(password: string): string {
 return crypto.createHash('sha256').update(password).digest('hex');
}

const passwords: Record<string, string> = {
 'admin123': hashPassword('admin123'),
 // ...
};
```


```typescript
interface DelayedMessageRequest {
 conversationId: number;
 content: string;
 delaySeconds: number;
}

const testDelayedMessage = async (): Promise<void> => {
 //
};
```


### Node.js tsx
 TypeScript `tsx`
- TypeScript
-
-
-


- `main.tf` - `dist/index.js`
- `package-lock.json` - `.js`
- `.js`


- `frontend/scripts/build-analysis.js`


- [x] JavaScript
- [x] package.json
- [x] PowerShell
- [x]
- [x]
- [x]
- [x] tsx


### 1.
- TypeScript
- `tsx` TypeScript
-

### 2.
- `tsx` `npm install -g tsx`
-
-

### 3.
- TypeScript
-
-


- ****: 1
- ****: 8
- ****: 3 PowerShell
- ****:
- ****: 2


****:
****: 100%
**JavaScript **: 0
****: 2025-08-14

---

****: TypeScript