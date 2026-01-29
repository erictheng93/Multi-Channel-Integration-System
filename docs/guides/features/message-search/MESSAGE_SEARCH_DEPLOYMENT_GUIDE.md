

- [](#)
- [](#)
- [](#)
- [](#)
- [](#)
- [](#)

---


### 1.

**Node.js **:
```bash
node --version # >= 18.0.0
npm --version # >= 9.0.0
```

****:
- Chrome 120+
- Firefox 120+
- Safari 17+
- Edge 120+

****:
- Web Worker
- IndexedDB
- localStorage

### 2.

```bash
cd frontend

# lunr
npm list lunr
# : lunr@2.3.9


npm list @types/lunr
# : @types/lunr@2.3.7
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

---


### Step 1:

```bash
cd frontend


rm -rf dist node_modules/.vite

# :
rm -rf node_modules package-lock.json
npm install
```

### Step 2:

```bash
npm run dev
```

: http://localhost:3000

### Step 3:


```javascript
// 1.
import { messageIndexService } from '@/services/messageIndexService'
console.log(':', messageIndexService.getStats())

// 2.
import { indexedDBCache } from '@/services/indexedDBCache'
indexedDBCache.getStats().then(stats => console.log(':', stats))

// 3.
import { searchPerformanceMonitor } from '@/services/searchPerformanceMonitor'
console.log(':', searchPerformanceMonitor.getStats())

// 4.
import { searchHistoryService } from '@/services/searchHistoryService'
console.log(':', searchHistoryService.getStats())
```

### Step 4:

 `MESSAGE_SEARCH_TEST_CASES.md`

- [ ]
- [ ]
- [ ]
- [ ] UI/UX

---


### Step 1:

```bash
cd frontend


npm run build


npx vite build
```

****:
```
dist/
 index.html
 assets/
 MessageSearch-*.js (11.48 KB, gzipped: 4.38 KB)
 MessageSearch-*.css (5.99 KB, gzipped: 1.24 KB)
 ... ()
```

### Step 2: Cloudflare Pages

#### A:

```bash
npm run build:pages
npm run deploy:pages
```

#### B:

```bash
# 1.
npm run build

# 2.
npm run copy-pages-config

# 3.
npx wrangler pages deploy dist --project-name=multi-channel-frontend
```

#### C: Git

```bash
git add .
git commit -m "feat: add message search optimization (Phase 1-3)"
git push origin main

# Cloudflare Pages
```

### Step 3:


```env
# .env.production
VITE_API_BASE_URL=https://your-api.workers.dev
VITE_ENABLE_SEARCH_CACHE=true
VITE_SEARCH_DEBUG=false
```

---


### 1. Smoke Test

 URL

- [ ]
- [ ]
- [ ]
- [ ]

### 2.

```javascript
//

// bundle
console.log('Lunr loaded:', typeof lunr !== 'undefined')

//
console.log('Services:', {
 indexService: !!messageIndexService,
 cacheService: !!indexedDBCache,
 perfMonitor: !!searchPerformanceMonitor,
 historyService: !!searchHistoryService
})
```

### 3.


```
:
- (1000): <10ms
- : <10ms
- : <15ms
- : <5ms
```

### 4.


- [ ] Chrome ( + )
- [ ] Firefox
- [ ] Safari ( + iOS)
- [ ] Edge

---


```javascript
//
const report = searchPerformanceMonitor.getPerformanceReport()
console.log(report)

//
const metricsJSON = searchPerformanceMonitor.exportMetrics()
console.log(metricsJSON)
```


```javascript
const stats = await indexedDBCache.getStats()
console.log(':', {
 hasCache: stats.hasCache,
 messageCount: stats.messageCount,
 cacheAge: Math.floor(stats.cacheAge / 1000) + '',
 cacheSize: Math.floor(stats.cacheSize / 1024) + 'KB'
})
```


#### :
```javascript
//
await indexedDBCache.clearCache()

//
searchPerformanceMonitor.clearMetrics()
```

#### :
-
-
-

---


### 1:

****:

****:
```javascript
// 1.
const stats = messageIndexService.getStats()
console.log(':', stats.isReady)
console.log(':', stats.messageCount)

// 2.
messageIndexService.clearIndex()
messageIndexService.buildIndex(messages)

// 3.
const results = messageIndexService.search('')
console.log(':', results.length)
```

### 2:

****: (>50ms)

****:
```javascript
// 1.
const slowQueries = searchPerformanceMonitor.getSlowQueries()
console.log(':', slowQueries)

// 2.
const cacheStats = await indexedDBCache.getStats()
if (!cacheStats.hasCache) {
 console.warn('')
}

// 3.
await indexedDBCache.clearCache()
location.reload()
```

### 3: Worker

****: Worker

****:
```javascript
//
if (typeof Worker === 'undefined') {
 console.error(' Web Worker')
 //
}

// Worker
fetch('/workers/messageIndexWorker.js')
 .then(r => console.log('Worker :', r.ok))
 .catch(e => console.error('Worker :', e))
```

### 4: IndexedDB

****: /

****:
```javascript
// 1. IndexedDB
if ('indexedDB' in window) {
 console.log('IndexedDB ')
} else {
 console.error('IndexedDB ')
}

// 2.
indexedDB.deleteDatabase('MessageIndexCache')

// 3.
location.reload()
```

---


### A: Git

```bash
# 1. commit
git revert HEAD

# 2.
git push origin main

# 3. Cloudflare Pages
```

### B: Cloudflare Pages

1. Cloudflare Dashboard
2. Pages
3. Deployments
4. Rollback

### C:


```javascript
//
const ENABLE_ADVANCED_SEARCH = false
const ENABLE_CACHE = false
const ENABLE_WORKER = false
```

---


- [ ] TypeScript
- [ ] ESLint
- [ ]
- [ ]
- [ ]


- [ ]
- [ ]
- [ ] /CDN
- [ ]


- [ ]
- [ ]
- [ ]
- [ ]
- [ ]

---


****:
- : `MESSAGE_SEARCH_DEPLOYMENT_CHECKLIST.md`
- : `MESSAGE_SEARCH_TEST_CASES.md`
- : `MESSAGE_SEARCH_USER_GUIDE.md` ()

****:
- GitHub Issues: []
- : `CLAUDE.md`

****:
- : <25ms (10k )
- : <15ms
- : <5ms
- UI : (<100ms)

---


 ****
- TypeScript 0
- ESLint
-

 ****
- 14
- >90%
- Bug

 ****
- <25ms
- <15ms
- UI

 ****
-
-
-
-

 ****
-
-
-

---

****: _______________
****: _______________
****: Phase 1-3 Complete
****: _______________
