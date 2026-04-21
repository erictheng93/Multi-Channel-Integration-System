// 高性能監控 Composable - 實時跟踪應用性能指標
/* eslint-disable no-undef */
import { ref, onUnmounted } from 'vue'
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('usePerformanceMonitor')

interface PerformanceMetrics {
  // Core Web Vitals
  lcp?: number // Largest Contentful Paint
  fid?: number // First Input Delay
  cls?: number // Cumulative Layout Shift
  
  // Custom metrics
  timeToInteractive?: number
  initialRenderTime?: number
  messageLoadTime?: number
  scrollPerformance?: {
    averageFps: number
    frameDrops: number
  }
  
  // Memory usage
  memoryUsage?: {
    usedJSSize: number
    totalJSSize: number
    jsLimit: number
  }
  
  // Network performance
  networkTiming?: {
    dns: number
    tcp: number
    request: number
    response: number
  }
}

interface PerformanceMark {
  name: string
  startTime: number
  duration?: number
}

export function usePerformanceMonitor() {
  const metrics = ref<PerformanceMetrics>({})
  const marks = ref<PerformanceMark[]>([])
  const isMonitoring = ref(false)
  
  // Performance observers
  let performanceObserver: PerformanceObserver | null = null
  let frameRateMonitor: number | null = null
  let memoryMonitor: NodeJS.Timeout | null = null
  
  // FPS monitoring
  const fpsData = {
    frames: [] as number[],
    lastTime: 0,
    frameDrops: 0
  }
  
  // Start monitoring
  const startMonitoring = () => {
    if (isMonitoring.value || !window.performance) {return}
    
    isMonitoring.value = true
    frontendLogger.debug('[Performance Monitor] Starting performance monitoring')
    
    // Core Web Vitals monitoring
    if ('PerformanceObserver' in window) {
      try {
        // LCP (Largest Contentful Paint)
        const lcpObserver = new window.PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1] as PerformanceEntry & { renderTime?: number; loadTime?: number }
          if (lastEntry) {
            metrics.value.lcp = lastEntry.renderTime || lastEntry.loadTime
            frontendLogger.debug(`[Performance] LCP: ${metrics.value.lcp?.toFixed(2)}ms`)
          }
        })
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })
        
        // FID (First Input Delay)
        const fidObserver = new window.PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach((entry: PerformanceEntry & { processingStart?: number }) => {
            if (entry.processingStart !== undefined) {
              metrics.value.fid = entry.processingStart - entry.startTime
              frontendLogger.debug(`[Performance] FID: ${metrics.value.fid.toFixed(2)}ms`)
            }
          })
        })
        fidObserver.observe({ type: 'first-input', buffered: true })
        
        // CLS (Cumulative Layout Shift)
        let clsValue = 0
        const clsObserver = new window.PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach((entry: PerformanceEntry & { hadRecentInput?: boolean; value?: number }) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value || 0
            }
          })
          metrics.value.cls = clsValue
        })
        clsObserver.observe({ type: 'layout-shift', buffered: true })
        
        performanceObserver = lcpObserver // Keep reference for cleanup
        
      } catch (error) {
        console.warn('Failed to setup Core Web Vitals monitoring:', error)
      }
    }
    
    // FPS monitoring
    startFpsMonitoring()
    
    // Memory monitoring
    startMemoryMonitoring()
    
    // Network timing
    measureNetworkTiming()
    
    // Initial render time
    measureInitialRenderTime()
  }
  
  // Stop monitoring
  const stopMonitoring = () => {
    if (!isMonitoring.value) {return}
    
    isMonitoring.value = false
    frontendLogger.debug('[Performance Monitor] Stopping performance monitoring')
    
    if (performanceObserver) {
      performanceObserver?.disconnect()
      performanceObserver = null
    }
    
    if (frameRateMonitor) {
      window.cancelAnimationFrame(frameRateMonitor)
      frameRateMonitor = null
    }
    
    if (memoryMonitor) {
      clearInterval(memoryMonitor)
      memoryMonitor = null
    }
  }
  
  // FPS monitoring
  const startFpsMonitoring = () => {
    let _frameCount = 0
    let startTime = performance.now()
    
    const measureFrame = (timestamp: number) => {
      _frameCount++
      
      const delta = timestamp - fpsData.lastTime
      if (fpsData.lastTime > 0) {
        fpsData.frames.push(1000 / delta)
        
        // Detect frame drops (< 30 FPS)
        if (delta > 33.33) {
          fpsData.frameDrops++
        }
      }
      fpsData.lastTime = timestamp
      
      // Calculate average FPS every second
      if (timestamp - startTime >= 1000) {
        const avgFps = fpsData.frames.reduce((a, b) => a + b, 0) / fpsData.frames.length
        
        metrics.value.scrollPerformance = {
          averageFps: Math.round(avgFps),
          frameDrops: fpsData.frameDrops
        }
        
        // Reset for next measurement
        fpsData.frames = []
        fpsData.frameDrops = 0
        startTime = timestamp
      }
      
      frameRateMonitor = window.requestAnimationFrame(measureFrame)
    }
    
    frameRateMonitor = window.requestAnimationFrame(measureFrame)
  }
  
  // Memory monitoring
  const startMemoryMonitoring = () => {
    if (!('memory' in performance)) {return}
    
    const measureMemory = () => {
      const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory
      if (memory) {
        metrics.value.memoryUsage = {
          usedJSSize: Math.round(memory.usedJSHeapSize / 1024 / 1024), // MB
          totalJSSize: Math.round(memory.totalJSHeapSize / 1024 / 1024), // MB
          jsLimit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024) // MB
        }
      }
    }
    
    measureMemory()
    memoryMonitor = setInterval(measureMemory, 5000) // Every 5 seconds
  }
  
  // Network timing
  const measureNetworkTiming = () => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (navigation) {
      metrics.value.networkTiming = {
        dns: navigation.domainLookupEnd - navigation.domainLookupStart,
        tcp: navigation.connectEnd - navigation.connectStart,
        request: navigation.responseStart - navigation.requestStart,
        response: navigation.responseEnd - navigation.responseStart
      }
    }
  }
  
  // Initial render time
  const measureInitialRenderTime = () => {
    // Use paint timing if available
    const paintEntries = performance.getEntriesByType('paint')
    const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint')
    
    if (fcp) {
      metrics.value.initialRenderTime = fcp.startTime
      frontendLogger.debug(`[Performance] First Contentful Paint: ${fcp.startTime.toFixed(2)}ms`)
    }
    
    // Measure Time to Interactive (TTI) - simplified version
    setTimeout(() => {
      metrics.value.timeToInteractive = performance.now()
      frontendLogger.debug(`[Performance] Time to Interactive: ${metrics.value.timeToInteractive.toFixed(2)}ms`)
    }, 0)
  }
  
  // Custom performance marks
  const mark = (name: string) => {
    const startTime = performance.now()
    performance.mark(name)
    
    marks.value.push({
      name,
      startTime
    })
    
    frontendLogger.debug(`[Performance Mark] ${name}: ${startTime.toFixed(2)}ms`)
  }
  
  // Measure duration between marks
  const measure = (name: string, startMark: string, endMark?: string) => {
    try {
      const endTime = performance.now()
      const startMarkEntry = marks.value.find(m => m.name === startMark)
      
      if (startMarkEntry) {
        const duration = endTime - startMarkEntry.startTime
        
        // Update mark with duration
        const markIndex = marks.value.findIndex(m => m.name === startMark)
        if (markIndex >= 0) {
          const mark = marks.value[markIndex]
          if (mark) {
            mark.duration = duration
          }
        }
        
        performance.measure(name, startMark, endMark)
        frontendLogger.debug(`[Performance Measure] ${name}: ${duration.toFixed(2)}ms`)
        
        return duration
      }
    } catch (error) {
      console.warn(`Failed to measure ${name}:`, error)
    }
    return 0
  }
  
  // Measure message loading performance
  const measureMessageLoad = async (loadFunction: () => Promise<unknown>) => {
    const startTime = performance.now()
    mark('message-load-start')
    
    try {
      await loadFunction()
      const endTime = performance.now()
      const duration = endTime - startTime
      
      metrics.value.messageLoadTime = duration
      measure('message-load', 'message-load-start')
      
      frontendLogger.debug(`[Performance] Message Load Time: ${duration.toFixed(2)}ms`)
      return duration
    } catch (error) {
      console.error('Message load failed:', error)
      throw error
    }
  }
  
  // Get performance report
  const getPerformanceReport = () => {
    return {
      metrics: metrics.value,
      marks: marks.value,
      recommendations: getPerformanceRecommendations()
    }
  }
  
  // Performance recommendations based on metrics
  const getPerformanceRecommendations = () => {
    const recommendations: string[] = []
    
    if (metrics.value.lcp && metrics.value.lcp > 2500) {
      recommendations.push('LCP is slow (>2.5s). Consider optimizing image loading and reducing server response time.')
    }
    
    if (metrics.value.fid && metrics.value.fid > 100) {
      recommendations.push('FID is poor (>100ms). Consider reducing JavaScript execution time.')
    }
    
    if (metrics.value.cls && metrics.value.cls > 0.1) {
      recommendations.push('CLS is poor (>0.1). Consider setting dimensions for images and avoiding inserting content above existing content.')
    }
    
    if (metrics.value.scrollPerformance?.averageFps && metrics.value.scrollPerformance.averageFps < 50) {
      recommendations.push('Scroll performance is poor (<50 FPS). Consider using virtual scrolling or reducing DOM complexity.')
    }
    
    if (metrics.value.memoryUsage) {
      const memoryUsagePercent = (metrics.value.memoryUsage.usedJSSize / metrics.value.memoryUsage.jsLimit) * 100
      if (memoryUsagePercent > 70) {
        recommendations.push('High memory usage detected. Consider implementing memory cleanup and avoiding memory leaks.')
      }
    }
    
    return recommendations
  }
  
  // Log performance summary
  const logPerformanceSummary = () => {
    frontendLogger.debug(' Performance Summary')
    frontendLogger.debug('Metrics:', metrics.value)
    frontendLogger.debug('Custom Marks:', marks.value)
    frontendLogger.debug('Recommendations:', getPerformanceRecommendations())  }
  
  // Cleanup
  onUnmounted(() => {
    stopMonitoring()
  })
  
  return {
    // State
    metrics,
    marks,
    isMonitoring,
    
    // Control
    startMonitoring,
    stopMonitoring,
    
    // Measurement
    mark,
    measure,
    measureMessageLoad,
    
    // Reporting
    getPerformanceReport,
    getPerformanceRecommendations,
    logPerformanceSummary
  }
}

// Global performance utilities
export const performanceUtils = {
  // Debounce function with performance tracking
  debounce<T extends (..._args: unknown[]) => unknown>(
    func: T,
    delay: number,
    trackPerformance = false
  ): T {
    let timeoutId: NodeJS.Timeout
    let callCount = 0
    
    return ((...args: Parameters<T>) => {
      clearTimeout(timeoutId)
      callCount++
      
      timeoutId = setTimeout(() => {
        const start = trackPerformance ? performance.now() : 0
        func.apply(null, args)
        
        if (trackPerformance) {
          const duration = performance.now() - start
          frontendLogger.debug(`[Debounced Function] Executed after ${callCount} calls, took ${duration.toFixed(2)}ms`)
        }
        callCount = 0
      }, delay)
    }) as T
  },
  
  // Throttle function with performance tracking
  throttle<T extends (..._args: unknown[]) => unknown>(
    func: T,
    delay: number,
    trackPerformance = false
  ): T {
    let isThrottled = false
    let lastCallTime = 0
    
    return ((...args: Parameters<T>) => {
      const now = Date.now()
      
      if (!isThrottled || (now - lastCallTime) >= delay) {
        const start = trackPerformance ? performance.now() : 0
        func.apply(null, args)
        
        if (trackPerformance) {
          const duration = performance.now() - start
          frontendLogger.debug(`[Throttled Function] Executed, took ${duration.toFixed(2)}ms`)
        }
        
        lastCallTime = now
        isThrottled = true
        
        setTimeout(() => {
          isThrottled = false
        }, delay)
      }
    }) as T
  },
  
  // Measure function execution time
  async measureAsync<T>(
    name: string,
    func: () => Promise<T>
  ): Promise<T> {
    const start = performance.now()
    performance.mark(`${name}-start`)
    
    try {
      const result = await func()
      const duration = performance.now() - start
      
      performance.mark(`${name}-end`)
      performance.measure(name, `${name}-start`, `${name}-end`)
      
      frontendLogger.debug(`[${name}] Completed in ${duration.toFixed(2)}ms`)
      return result
    } catch (error) {
      const duration = performance.now() - start
      console.error(`[${name}] Failed after ${duration.toFixed(2)}ms:`, error)
      throw error
    }
  }
}