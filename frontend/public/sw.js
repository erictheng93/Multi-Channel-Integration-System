// Service Worker - 企業級PWA支援
// 提供離線功能、背景同步、推送通知
// Note: ServiceWorker globals (self, clients, caches, importScripts) are
// declared in frontend/eslint.config.js under `languageOptions.globals`.

// Bump this version on every deploy that needs to invalidate caches. The
// activate handler deletes any cache whose name is not in the current set, so
// bumping the version auto-purges stale/poisoned caches for ALL users on their
// next navigation (no manual hard refresh required).
const CACHE_VERSION = 'v1.3.0'
const CACHE_NAME = `multi-channel-support-${CACHE_VERSION}`
const STATIC_CACHE = `static-cache-${CACHE_VERSION}`
const DYNAMIC_CACHE = `dynamic-cache-${CACHE_VERSION}`
const API_CACHE = `api-cache-${CACHE_VERSION}`

// 需要快取的靜態資源
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html', // 離線頁面
  // 會由構建工具自動添加其他資源
]

// API路由的快取策略配置
const CACHE_STRATEGIES = {
  // 對話數據 - 網路優先，快取備份
  conversations: {
    pattern: /\/api\/conversations/,
    strategy: 'networkFirst',
    maxAge: 5 * 60 * 1000, // 5分鐘
    maxEntries: 50
  },
  
  // 訊息數據 - 快取優先，長期存儲
  messages: {
    pattern: /\/api\/messages/,
    strategy: 'cacheFirst',
    maxAge: 30 * 60 * 1000, // 30分鐘
    maxEntries: 200
  },
  
  // 用戶和團隊數據 - 網路優先
  userData: {
    pattern: /\/api\/(users|teams|auth)/,
    strategy: 'networkFirst',
    maxAge: 15 * 60 * 1000, // 15分鐘
    maxEntries: 20
  },
  
  // 靜態資源 - 快取優先
  static: {
    pattern: /\.(js|css|png|jpg|jpeg|gif|svg|woff2|woff)$/,
    strategy: 'cacheFirst',
    maxAge: 24 * 60 * 60 * 1000, // 24小時
    maxEntries: 100
  }
}

// 離線同步隊列
const syncQueue = []
const MAX_SYNC_RETRIES = 3

// Service Worker 安裝事件
self.addEventListener('install', (event) => {
  console.log('🔧 [SW] Installing service worker...')
  
  event.waitUntil(
    (async () => {
      try {
        // 快取靜態資源
        const staticCache = await caches.open(STATIC_CACHE)
        await staticCache.addAll(STATIC_ASSETS)
        
        console.log('✅ [SW] Static assets cached successfully')
        
        // 立即激活新的Service Worker
        self.skipWaiting()
      } catch (error) {
        console.error('❌ [SW] Installation failed:', error)
      }
    })()
  )
})

// Service Worker 激活事件
self.addEventListener('activate', (event) => {
  console.log('🚀 [SW] Activating service worker...')
  
  event.waitUntil(
    (async () => {
      try {
        // 清理舊快取
        const cacheNames = await caches.keys()
        const oldCaches = cacheNames.filter(name => 
          name !== CACHE_NAME && 
          name !== STATIC_CACHE && 
          name !== DYNAMIC_CACHE && 
          name !== API_CACHE
        )
        
        await Promise.all(
          oldCaches.map(name => caches.delete(name))
        )
        
        console.log(`🧹 [SW] Cleaned up ${oldCaches.length} old caches`)
        
        // 接管所有頁面
        await self.clients.claim()
        
        console.log('✅ [SW] Service worker activated successfully')
      } catch (error) {
        console.error('❌ [SW] Activation failed:', error)
      }
    })()
  )
})

// 網路請求攔截
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  
  // 跳過非同源請求和某些特殊請求
  if (
    !url.origin.includes(self.location.origin) || 
    request.method !== 'GET' ||
    url.pathname.includes('hot-update') // 開發模式熱更新
  ) {
    return
  }
  
  // 根據URL類型選擇快取策略
  const strategy = getRequestStrategy(request)
  
  event.respondWith(
    handleRequest(request, strategy)
  )
})

// 來自頁面的訊息（由 serviceWorkerManager 發送）
self.addEventListener('message', (event) => {
  const data = event.data || {}

  if (data.type === 'SKIP_WAITING') {
    // Apply a pending update immediately when the user accepts it.
    self.skipWaiting()
    return
  }

  if (data.type === 'CLEAR_CACHE') {
    event.waitUntil((async () => {
      const names = Array.isArray(data.cacheNames) && data.cacheNames.length
        ? data.cacheNames
        : await caches.keys()
      await Promise.all(names.map(name => caches.delete(name)))
    })())
  }
})

// 背景同步事件
self.addEventListener('sync', (event) => {
  console.log('🔄 [SW] Background sync triggered:', event.tag)
  
  switch (event.tag) {
    case 'conversation-sync':
      event.waitUntil(syncConversations())
      break
    case 'message-sync':
      event.waitUntil(syncMessages())
      break
    case 'offline-actions':
      event.waitUntil(processOfflineActions())
      break
  }
})

// 推送通知事件
self.addEventListener('push', (event) => {
  if (!event.data) {return}
  
  try {
    const data = event.data.json()
    const options = {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: data.tag || 'default',
      data: data.data || {},
      actions: [
        {
          action: 'view',
          title: '查看',
          icon: '/icon-view.png'
        },
        {
          action: 'dismiss',
          title: '忽略',
          icon: '/icon-dismiss.png'
        }
      ],
      requireInteraction: data.requireInteraction || false
    }
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    )
    
    console.log('📢 [SW] Push notification displayed:', data.title)
  } catch (error) {
    console.error('❌ [SW] Push notification error:', error)
  }
})

// 通知點擊事件
self.addEventListener('notificationclick', (event) => {
  console.log('👆 [SW] Notification clicked:', event.action)
  
  event.notification.close()
  
  if (event.action === 'view') {
    const data = event.notification.data
    const url = data.url || '/'
    
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        // 嘗試聚焦現有窗口
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus()
          }
        }
        
        // 開啟新窗口
        if (clients.openWindow) {
          return clients.openWindow(url)
        }
      })
    )
  }
})

// 判斷請求是否預期非 HTML 的靜態資源（JS/CSS/字型等）
// Used to detect the deploy-propagation poisoning case: a hashed asset request
// (/assets/index-*.js) that gets answered with the SPA fallback HTML.
function expectsNonHtmlAsset(request) {
  const dest = request.destination
  if (dest === 'script' || dest === 'style' || dest === 'font') {return true}
  return /\.(js|mjs|css|json|woff2?|ttf|map)$/i.test(new URL(request.url).pathname)
}

function responseIsHtml(response) {
  const contentType = response.headers.get('content-type') || ''
  return contentType.includes('text/html')
}

// A poisoned asset response: an HTML body served for a JS/CSS/font request.
// Never cache it, and never serve it from cache.
function isPoisonedAssetResponse(request, response) {
  return expectsNonHtmlAsset(request) && responseIsHtml(response)
}

// Decide whether a network response is safe to cache.
function shouldCacheResponse(request, response) {
  if (!response || !response.ok || response.status !== 200) {return false}
  // Opaque / redirected responses must not be cached under an asset URL.
  if (response.type === 'opaqueredirect' || response.redirected) {return false}
  // Never cache the SPA fallback HTML under a hashed asset URL.
  if (isPoisonedAssetResponse(request, response)) {return false}
  return true
}

// 根據請求類型獲取快取策略
function getRequestStrategy(request) {
  const url = new URL(request.url)
  
  // API請求策略
  for (const [key, config] of Object.entries(CACHE_STRATEGIES)) {
    if (config.pattern.test(url.pathname)) {
      return { ...config, type: key }
    }
  }
  
  // 默認策略
  return {
    strategy: 'networkFirst',
    maxAge: 5 * 60 * 1000,
    maxEntries: 20,
    type: 'default'
  }
}

// 處理網路請求
async function handleRequest(request, strategy) {
  const cacheName = getCacheName(strategy.type)
  
  switch (strategy.strategy) {
    case 'cacheFirst':
      return cacheFirst(request, cacheName, strategy)
    case 'networkFirst':
      return networkFirst(request, cacheName, strategy)
    case 'staleWhileRevalidate':
      return staleWhileRevalidate(request, cacheName, strategy)
    default:
      return networkFirst(request, cacheName, strategy)
  }
}

// Cache First 策略
async function cacheFirst(request, cacheName, strategy) {
  try {
    const cache = await caches.open(cacheName)
    const cachedResponse = await cache.match(request)

    // Ignore a poisoned cached entry (HTML stored under a JS/CSS asset URL) so
    // we fall through to the network and self-heal.
    if (
      cachedResponse &&
      !isExpired(cachedResponse, strategy.maxAge) &&
      !isPoisonedAssetResponse(request, cachedResponse)
    ) {
      console.log('💾 [SW] Cache hit:', request.url)
      return cachedResponse
    }

    const networkResponse = await fetch(request)

    if (shouldCacheResponse(request, networkResponse)) {
      await cache.put(request, networkResponse.clone())
      await cleanupCache(cache, strategy.maxEntries)
      console.log('🌐 [SW] Network response cached:', request.url)
    }

    return networkResponse
  } catch {
    console.log('💾 [SW] Serving from cache (network failed):', request.url)
    const cache = await caches.open(cacheName)
    return await cache.match(request) || createOfflineResponse(request)
  }
}

// Network First 策略
async function networkFirst(request, cacheName, strategy) {
  try {
    const networkResponse = await Promise.race([
      fetch(request),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Network timeout')), 3000)
      )
    ])
    
    if (shouldCacheResponse(request, networkResponse)) {
      const cache = await caches.open(cacheName)
      await cache.put(request, networkResponse.clone())
      await cleanupCache(cache, strategy.maxEntries)
      console.log('🌐 [SW] Network response cached:', request.url)
    }

    return networkResponse
  } catch {
    console.log('💾 [SW] Network failed, serving from cache:', request.url)
    const cache = await caches.open(cacheName)
    const cachedResponse = await cache.match(request)

    if (cachedResponse && !isPoisonedAssetResponse(request, cachedResponse)) {
      return cachedResponse
    }

    return createOfflineResponse(request)
  }
}

// Stale While Revalidate 策略
async function staleWhileRevalidate(request, cacheName, strategy) {
  const cache = await caches.open(cacheName)
  const cachedResponse = await cache.match(request)
  
  // 背景更新
  const fetchPromise = fetch(request).then(networkResponse => {
    if (shouldCacheResponse(request, networkResponse)) {
      cache.put(request, networkResponse.clone())
      cleanupCache(cache, strategy.maxEntries)
    }
    return networkResponse
  }).catch(error => {
    console.warn('🌐 [SW] Background update failed:', error)
    return null
  })
  
  // 立即返回快取或等待網路（poisoned 條目則忽略，改走網路）
  if (cachedResponse && !isPoisonedAssetResponse(request, cachedResponse)) {
    return cachedResponse
  }
  return fetchPromise
}

// 檢查回應是否過期
function isExpired(response, maxAge) {
  const dateHeader = response.headers.get('date')
  if (!dateHeader) {return false}
  
  const responseTime = new Date(dateHeader).getTime()
  return Date.now() - responseTime > maxAge
}

// 清理快取以維持大小限制
async function cleanupCache(cache, maxEntries) {
  const keys = await cache.keys()
  
  if (keys.length > maxEntries) {
    const entriesToDelete = keys.length - maxEntries
    const keysToDelete = keys.slice(0, entriesToDelete)
    
    await Promise.all(
      keysToDelete.map(key => cache.delete(key))
    )
    
    console.log(`🧹 [SW] Cleaned up ${entriesToDelete} cache entries`)
  }
}

// 獲取快取名稱
function getCacheName(type) {
  switch (type) {
    case 'static':
      return STATIC_CACHE
    case 'conversations':
    case 'messages':
    case 'userData':
      return API_CACHE
    default:
      return DYNAMIC_CACHE
  }
}

// 創建離線回應
function createOfflineResponse(request) {
  const url = new URL(request.url)
  
  // API請求返回離線數據結構
  if (url.pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Offline mode - data unavailable',
      offline: true,
      timestamp: Date.now()
    }), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
  
  // 頁面請求返回離線頁面
  return caches.match('/offline.html') || new Response('Offline', {
    status: 503,
    statusText: 'Service Unavailable'
  })
}

// 背景同步功能
async function syncConversations() {
  console.log('🔄 [SW] Syncing conversations in background...')
  
  try {
    // 這裡會實際調用API同步最新對話數據
    const response = await fetch('/api/conversations?sync=true')
    
    if (response.ok) {
      // 更新快取
      const cache = await caches.open(API_CACHE)
      await cache.put('/api/conversations', response.clone())
      
      console.log('✅ [SW] Conversations synced successfully')
      
      // 通知所有客戶端
      const clients = await self.clients.matchAll()
      clients.forEach(client => {
        client.postMessage({
          type: 'CONVERSATIONS_SYNCED',
          timestamp: Date.now()
        })
      })
    }
  } catch (error) {
    console.error('❌ [SW] Conversation sync failed:', error)
  }
}

async function syncMessages() {
  console.log('🔄 [SW] Syncing messages in background...')
  // 實現訊息同步邏輯
}

async function processOfflineActions() {
  console.log('🔄 [SW] Processing offline actions...')
  
  // 處理離線時積累的操作
  for (const action of syncQueue) {
    try {
      await processAction(action)
      console.log('✅ [SW] Offline action processed:', action.type)
    } catch (error) {
      console.error('❌ [SW] Offline action failed:', action.type, error)
      
      if (action.retries < MAX_SYNC_RETRIES) {
        action.retries++
      } else {
        // 移除失敗的操作
        const index = syncQueue.indexOf(action)
        syncQueue.splice(index, 1)
      }
    }
  }
}

async function processAction(action) {
  // 處理具體的離線操作
  switch (action.type) {
    case 'SEND_MESSAGE':
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action.data)
      })
      break
    case 'UPDATE_CONVERSATION':
      await fetch(`/api/conversations/${action.data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action.data.updates)
      })
      break
  }
}