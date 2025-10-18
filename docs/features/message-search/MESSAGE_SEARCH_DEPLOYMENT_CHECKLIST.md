


- [x] **TypeScript **
 ```bash
 cd frontend && npx vue-tsc --noEmit
 ```
 :

- [x] ****
 ```bash
 cd frontend && npm run build
 ```
 : 2.65

- [x] **ESLint **
 ```bash
 cd frontend && npm run lint:check
 ```
 :


#### Phase 1 -
- [x] Lunr.js (lunr@2.3.9)
- [x] @types/lunr (2.3.7)
- [x] MessageIndexService
- [x] Pinia Store
- [x] MessageSearch.vue

#### Phase 2 -
- [x] (AND, OR, NOT)
- [x] (*)
- [x] (content:, senderName:)
- [x] (searchHighlight.ts)
- [x] (searchHistoryService.ts)
- [x] HighlightedMessage
- [x]

#### Phase 3 -
- [x] Web Worker
- [x] IndexedDB
- [x]
- [x]
- [x]
- [x]


#### (13)
```
frontend/src/services/
 messageIndexService.ts (257 )
 searchHistoryService.ts (302 )
 indexedDBCache.ts (280 )
 searchPerformanceMonitor.ts (220 )

frontend/src/utils/
 searchHighlight.ts (324 )
 searchPagination.ts (270 )
 debounce.ts (240 )

frontend/src/workers/
 messageIndexWorker.ts (180 )

frontend/src/components/conversation/
 HighlightedMessage.vue (73 )
```

#### (3)
```
frontend/package.json ( lunr )
frontend/src/stores/messages.ts ()
frontend/src/components/conversation/MessageSearch.vue ()
```


```json
{
 "dependencies": {
 "lunr": "^2.3.9"
 },
 "devDependencies": {
 "@types/lunr": "^2.3.7"
 }
}
```

### Bundle

```
Phase 1 :
 MessageSearch.js: 4.13 KB (gzipped: 1.75 KB)

Phase 2 :
 MessageSearch.js: 7.98 KB (gzipped: 3.18 KB)
 : +3.85 KB (gzipped: +1.43 KB)

Phase 3 :
 MessageSearch.js: 11.48 KB (gzipped: 4.38 KB)
 : +3.5 KB (gzipped: +1.2 KB)

: +7.35 KB (gzipped: +2.63 KB)
: ()
```


- [ ] ****
 -
 -
 - (<20ms)

- [ ] ****
 -
 -

- [ ] ****
 -
 -


- [ ] ****
 ```
 :
 - " AND "
 - " OR "
 - " NOT "
 - "( OR ) AND "
 ```

- [ ] ****
 ```
 :
 - "*" ()
 - "*" ()
 ```

- [ ] ****
 ```
 :
 - "content:"
 - "senderName:"
 - "content: AND senderName:"
 ```


- [ ] ****
 -
 - localStorage

- [ ] ****
 -
 -

- [ ] ****
 -
 - (50)


- [ ] ****
 -
 -

- [ ] **HighlightedMessage **
 -
 -


- [ ] ****
 ```
 :
 - 100 : <5ms
 - 1,000 : <10ms
 - 10,000 : <25ms
 ```

- [ ] ****
 ```
 :
 - : <10ms
 - : <15ms
 - : <20ms
 ```

- [ ] ****
 ```
 :
 1. -
 2. -
 3. (<5ms)
 ```

### UI/UX

- [ ] ****
 - STD/ADV
 - Placeholder

- [ ] ****
 -
 -
 -

- [ ] ****
 -
 - 300ms


- [ ] ****
 -

- [ ] ****
 -

- [ ] ****
 -

- [ ] ****
 - +


### 1.

```bash
# Node.js >= 18
node --version

# npm >= 9
npm --version


cd frontend
```

### 2.

```bash

rm -rf node_modules package-lock.json


npm install

# lunr
npm list lunr
# : lunr@2.3.9
```

### 3.

```bash
# TypeScript
npm run type-check

# ESLint
npm run lint:check


npm run build
# dist/
```

### 4.

```bash

npm run dev

# http://localhost:3000

```

### 5.

```bash
# Cloudflare Pages
npm run deploy:pages


npm run build:pages
```

### 6.

- [ ] URL
- [ ]
- [ ]
- [ ]


```
:
 100 : <5ms
 1,000 : <10ms
 10,000 : <25ms

:
 : <10ms
 : <15ms
 : <20ms

:
 : ~20ms
 : ~5ms
 : 4x

:
 : 300ms
 UI :
 : 100%
```


```javascript
//
import { searchPerformanceMonitor } from '@/services/searchPerformanceMonitor'

const stats = searchPerformanceMonitor.getStats()
console.log(':', stats)

//
import { indexedDBCache } from '@/services/indexedDBCache'

const cacheStats = await indexedDBCache.getStats()
console.log(':', cacheStats)
```


#### 1.

****:
****:
```javascript
//
import { messageIndexService } from '@/services/messageIndexService'

const stats = messageIndexService.getStats()
console.log(':', stats)

//
messageIndexService.buildIndex(messages)
```

#### 2.

****:
****:
```javascript
//
import { indexedDBCache } from '@/services/indexedDBCache'

await indexedDBCache.clearCache()

//
messageIndexService.buildIndex(messages)
```

#### 3.

****: >50ms
****:
```javascript
//
import { searchPerformanceMonitor } from '@/services/searchPerformanceMonitor'

const slowQueries = searchPerformanceMonitor.getSlowQueries(50)
console.log(':', slowQueries)
```

#### 4. Worker

****:
****:
- Web Worker
- Worker
-


```bash
# 1. git commit
git revert HEAD

# 2.
cd frontend && npm run build

# 3.
npm run deploy:pages
```


1. ** Phase 3 ()**
 - WorkerIndexedDB
 - Phase 1 + 2

2. ** Phase 2 ()**
 -
 - Phase 1

3. ****
 -


- [ ]
- [ ]
- [ ]
- [ ]
- [ ]
- [ ]


- : CLAUDE.md
- Bug : GitHub Issues
- : MESSAGE_SEARCH_USER_GUIDE.md ()
