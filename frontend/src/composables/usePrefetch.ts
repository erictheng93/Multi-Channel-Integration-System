// 第五階段：簡化版預載入 - 利用瀏覽器原生能力
import { ref } from 'vue'

const prefetchedUrls = new Set<string>()
const prefetchQueue = new Set<string>()

export function usePrefetch() {
  const isPrefetching = ref(false)
  
  // 簡單的 hover 預載入
  const prefetchOnHover = (url: string) => {
    if (prefetchedUrls.has(url) || prefetchQueue.has(url)) {return}
    
    prefetchQueue.add(url)
    
    // 使用 globalThis.requestIdleCallback 在瀏覽器空閒時預載入
    const prefetchFn = () => {
      if (prefetchedUrls.has(url)) {return}
      
      // 利用瀏覽器原生 prefetch
      const link = document.createElement('link')
      link.rel = 'prefetch'
      link.href = url
      link.onload = () => {
        prefetchedUrls.add(url)
        prefetchQueue.delete(url)
      }
      link.onerror = () => {
        prefetchQueue.delete(url)
      }
      
      document.head.appendChild(link)
    }
    
    // 使用瀏覽器空閒時間或降級到 setTimeout
    if ('globalThis.requestIdleCallback' in window) {
      globalThis.requestIdleCallback(prefetchFn)
    } else {
      setTimeout(prefetchFn, 100)
    }
  }
  
  // 預載入 API 數據
  const prefetchApiData = async (endpoint: string) => {
    if (prefetchedUrls.has(endpoint)) {return}
    
    isPrefetching.value = true
    
    try {
      // 使用低優先級 fetch
      const response = await fetch(endpoint, {
        priority: 'low' as globalThis.RequestPriority,
        cache: 'force-cache' // 利用瀏覽器快取
      })
      
      if (response.ok) {
        prefetchedUrls.add(endpoint)
      }
    } catch (error) {
      // 靜默處理預載入錯誤
      console.debug('Prefetch failed:', endpoint, error)
    } finally {
      isPrefetching.value = false
    }
  }
  
  return {
    prefetchOnHover,
    prefetchApiData,
    isPrefetching: isPrefetching.value
  }
}