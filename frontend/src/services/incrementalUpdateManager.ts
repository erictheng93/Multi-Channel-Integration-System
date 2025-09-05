// 增量更新管理器 - 實現平滑的數據更新動畫
// 提供零突兀感的用戶體驗

import { ref, nextTick } from 'vue'
import type { Conversation } from '@/types'

// 數據差異類型
interface DataDiff<T = unknown> {
  added: Array<{ item: T; index: number }>
  updated: Array<{ item: T; index: number; changes: Partial<T> }>
  removed: Array<{ item: T; index: number }>
  moved: Array<{ item: T; fromIndex: number; toIndex: number }>
}

// 動畫配置
interface AnimationConfig {
  duration: number
  easing: string
  staggerDelay: number
  preserveScrollPosition: boolean
}

const DEFAULT_ANIMATION_CONFIG: AnimationConfig = {
  duration: 300,
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  staggerDelay: 50,
  preserveScrollPosition: true
}

// 動畫狀態
interface AnimationState {
  isAnimating: boolean
  currentAnimations: Set<string>
  queuedUpdates: Array<() => Promise<void>>
}

export class IncrementalUpdateManager<T = unknown> {
  private config: AnimationConfig
  private animationState: AnimationState
  private currentData: T[] = []
  private scrollPosition = { top: 0, left: 0 }
  
  // 響應式狀態
  public isUpdating = ref(false)
  public animationProgress = ref(0)
  public stats = ref({
    totalAnimations: 0,
    averageAnimationTime: 0,
    queuedUpdates: 0
  })

  constructor(config?: Partial<AnimationConfig>) {
    this.config = { ...DEFAULT_ANIMATION_CONFIG, ...config }
    this.animationState = {
      isAnimating: false,
      currentAnimations: new Set(),
      queuedUpdates: []
    }
  }

  // 計算數據差異
  private calculateDiff(oldData: T[], newData: T[], getKey: (item: T, index: number) => string | number = (_item, index) => index): DataDiff<T> {
    const oldMap = new Map(oldData.map((item, index) => [getKey(item, index), { item, index }]))
    const newMap = new Map(newData.map((item, index) => [getKey(item, index), { item, index }]))
    
    const diff: DataDiff<T> = {
      added: [],
      updated: [],
      removed: [],
      moved: []
    }

    // 找出新增的項目
    for (const [key, { item, index }] of newMap) {
      if (!oldMap.has(key)) {
        diff.added.push({ item, index })
      }
    }

    // 找出刪除的項目
    for (const [key, { item, index }] of oldMap) {
      if (!newMap.has(key)) {
        diff.removed.push({ item, index })
      }
    }

    // 找出更新和移動的項目
    for (const [key, { item: newItem, index: newIndex }] of newMap) {
      const oldEntry = oldMap.get(key)
      if (oldEntry) {
        const { item: oldItem, index: oldIndex } = oldEntry
        
        // 檢查位置是否改變
        if (oldIndex !== newIndex) {
          diff.moved.push({ item: newItem, fromIndex: oldIndex, toIndex: newIndex })
        }
        
        // 檢查內容是否改變
        const changes = this.getChanges(oldItem, newItem)
        if (Object.keys(changes).length > 0) {
          diff.updated.push({ item: newItem, index: newIndex, changes })
        }
      }
    }

    return diff
  }

  // 獲取對象變化
  private getChanges(oldItem: T, newItem: T): Partial<T> {
    const changes: Partial<T> = {}
    
    if (typeof oldItem === 'object' && typeof newItem === 'object' && oldItem && newItem) {
      for (const key in newItem) {
        if (oldItem[key] !== newItem[key]) {
          changes[key] = newItem[key]
        }
      }
    }
    
    return changes
  }

  // 保存滾動位置
  private saveScrollPosition(container?: HTMLElement) {
    if (!this.config.preserveScrollPosition) {return}
    
    if (container) {
      this.scrollPosition = {
        top: container.scrollTop,
        left: container.scrollLeft
      }
    } else if (typeof window !== 'undefined') {
      this.scrollPosition = {
        top: window.scrollY,
        left: window.scrollX
      }
    }
  }

  // 恢復滾動位置
  private restoreScrollPosition(container?: HTMLElement) {
    if (!this.config.preserveScrollPosition) {return}

    nextTick(() => {
      if (container) {
        container.scrollTo({
          top: this.scrollPosition.top,
          left: this.scrollPosition.left,
          behavior: 'instant' as ScrollBehavior
        })
      } else if (typeof window !== 'undefined') {
        window.scrollTo({
          top: this.scrollPosition.top,
          left: this.scrollPosition.left,
          behavior: 'instant' as ScrollBehavior
        })
      }
    })
  }

  // 動畫新增項目
  private async animateNewItems(items: Array<{ item: T; index: number }>, _container?: HTMLElement): Promise<void> {
    if (items.length === 0) {return}

    const promises = items.map(({ index }, i) => 
      this.animateItemEnter(index, i * this.config.staggerDelay)
    )

    await Promise.all(promises)
  }

  // 動畫更新項目
  private async animateUpdatedItems(items: Array<{ item: T; index: number; changes: Partial<T> }>): Promise<void> {
    if (items.length === 0) {return}

    const promises = items.map(({ index, changes }, i) => 
      this.animateItemUpdate(index, changes, i * this.config.staggerDelay)
    )

    await Promise.all(promises)
  }

  // 動畫刪除項目
  private async animateRemovedItems(items: Array<{ item: T; index: number }>): Promise<void> {
    if (items.length === 0) {return}

    const promises = items.map(({ index }, i) => 
      this.animateItemExit(index, i * this.config.staggerDelay)
    )

    await Promise.all(promises)
  }

  // 動畫移動項目
  private async animateMovedItems(items: Array<{ item: T; fromIndex: number; toIndex: number }>): Promise<void> {
    if (items.length === 0) {return}

    const promises = items.map(({ fromIndex, toIndex }, i) => 
      this.animateItemMove(fromIndex, toIndex, i * this.config.staggerDelay)
    )

    await Promise.all(promises)
  }

  // 單個項目進入動畫
  private animateItemEnter(index: number, delay: number = 0): Promise<void> {
    return new Promise((resolve) => {
      const animationId = `enter-${index}-${Date.now()}`
      this.animationState.currentAnimations.add(animationId)

      setTimeout(() => {
        const element = this.getElementByIndex(index)
        if (!element) {
          this.animationState.currentAnimations.delete(animationId)
          resolve()
          return
        }

        // 設置初始狀態
        element.style.opacity = '0'
        element.style.transform = 'translateX(20px) scale(0.95)'
        element.style.transition = `all ${this.config.duration}ms ${this.config.easing}`

        // 觸發動畫
        requestAnimationFrame(() => {
          element.style.opacity = '1'
          element.style.transform = 'translateX(0) scale(1)'

          setTimeout(() => {
            element.style.transition = ''
            this.animationState.currentAnimations.delete(animationId)
            resolve()
          }, this.config.duration)
        })
      }, delay)
    })
  }

  // 單個項目更新動畫
  private animateItemUpdate(index: number, _changes: Partial<T>, delay: number = 0): Promise<void> {
    return new Promise((resolve) => {
      const animationId = `update-${index}-${Date.now()}`
      this.animationState.currentAnimations.add(animationId)

      setTimeout(() => {
        const element = this.getElementByIndex(index)
        if (!element) {
          this.animationState.currentAnimations.delete(animationId)
          resolve()
          return
        }

        // 輕微的高亮動畫
        element.style.transition = `all ${this.config.duration}ms ${this.config.easing}`
        element.style.backgroundColor = 'rgba(59, 130, 246, 0.1)'
        element.style.transform = 'scale(1.02)'

        setTimeout(() => {
          element.style.backgroundColor = ''
          element.style.transform = 'scale(1)'

          setTimeout(() => {
            element.style.transition = ''
            this.animationState.currentAnimations.delete(animationId)
            resolve()
          }, this.config.duration)
        }, this.config.duration / 2)
      }, delay)
    })
  }

  // 單個項目退出動畫
  private animateItemExit(index: number, delay: number = 0): Promise<void> {
    return new Promise((resolve) => {
      const animationId = `exit-${index}-${Date.now()}`
      this.animationState.currentAnimations.add(animationId)

      setTimeout(() => {
        const element = this.getElementByIndex(index)
        if (!element) {
          this.animationState.currentAnimations.delete(animationId)
          resolve()
          return
        }

        element.style.transition = `all ${this.config.duration}ms ${this.config.easing}`
        element.style.opacity = '0'
        element.style.transform = 'translateX(-20px) scale(0.95)'
        element.style.maxHeight = '0'
        element.style.margin = '0'
        element.style.padding = '0'

        setTimeout(() => {
          this.animationState.currentAnimations.delete(animationId)
          resolve()
        }, this.config.duration)
      }, delay)
    })
  }

  // 單個項目移動動畫
  private animateItemMove(fromIndex: number, toIndex: number, delay: number = 0): Promise<void> {
    return new Promise((resolve) => {
      const animationId = `move-${fromIndex}-${toIndex}-${Date.now()}`
      this.animationState.currentAnimations.add(animationId)

      setTimeout(() => {
        const element = this.getElementByIndex(fromIndex)
        if (!element) {
          this.animationState.currentAnimations.delete(animationId)
          resolve()
          return
        }

        // 計算移動距離（簡化版）
        const moveDistance = (toIndex - fromIndex) * 100 // 假設每項100px高度
        
        element.style.transition = `transform ${this.config.duration}ms ${this.config.easing}`
        element.style.transform = `translateY(${moveDistance}px)`
        element.style.zIndex = '10'

        setTimeout(() => {
          element.style.transform = ''
          element.style.zIndex = ''
          element.style.transition = ''
          this.animationState.currentAnimations.delete(animationId)
          resolve()
        }, this.config.duration)
      }, delay)
    })
  }

  // 根據索引獲取DOM元素
  private getElementByIndex(index: number): HTMLElement | null {
    return document.querySelector(`[data-index="${index}"]`) as HTMLElement
  }

  // 主要的更新方法
  async updateWithAnimation(
    newData: T[],
    getKey: (item: T, index: number) => string | number = (_item, index) => index,
    container?: HTMLElement
  ): Promise<void> {
    // 如果正在動畫中，加入隊列
    if (this.animationState.isAnimating) {
      return new Promise((resolve) => {
        this.animationState.queuedUpdates.push(async () => {
          await this.updateWithAnimation(newData, getKey, container)
          resolve()
        })
        this.stats.value.queuedUpdates = this.animationState.queuedUpdates.length
      })
    }

    const startTime = Date.now()
    this.animationState.isAnimating = true
    this.isUpdating.value = true

    try {
      // 保存滾動位置
      this.saveScrollPosition(container)

      // 計算差異
      const diff = this.calculateDiff(this.currentData, newData, getKey)

      // 按順序執行動畫
      await this.animateRemovedItems(diff.removed)
      await this.animateMovedItems(diff.moved)
      await this.animateUpdatedItems(diff.updated)
      await this.animateNewItems(diff.added)

      // 更新數據
      this.currentData = [...newData]

      // 恢復滾動位置
      this.restoreScrollPosition(container)

      // 更新統計
      const animationTime = Date.now() - startTime
      this.stats.value.totalAnimations++
      this.stats.value.averageAnimationTime = 
        (this.stats.value.averageAnimationTime * (this.stats.value.totalAnimations - 1) + animationTime) / 
        this.stats.value.totalAnimations

    } finally {
      this.animationState.isAnimating = false
      this.isUpdating.value = false
      this.animationProgress.value = 100

      // 處理隊列中的更新
      if (this.animationState.queuedUpdates.length > 0) {
        const nextUpdate = this.animationState.queuedUpdates.shift()
        this.stats.value.queuedUpdates = this.animationState.queuedUpdates.length
        if (nextUpdate) {
          await nextUpdate()
        }
      }
    }
  }

  // 立即更新（不含動畫）
  updateImmediately(newData: T[]): void {
    this.currentData = [...newData]
  }

  // 取消所有動畫
  cancelAllAnimations(): void {
    this.animationState.currentAnimations.clear()
    this.animationState.queuedUpdates.length = 0
    this.animationState.isAnimating = false
    this.isUpdating.value = false
    this.stats.value.queuedUpdates = 0

    // 清除所有動畫樣式
    document.querySelectorAll('[data-index]').forEach((element) => {
      const el = element as HTMLElement
      el.style.transition = ''
      el.style.transform = ''
      el.style.opacity = ''
      el.style.backgroundColor = ''
      el.style.maxHeight = ''
      el.style.margin = ''
      el.style.padding = ''
      el.style.zIndex = ''
    })
  }

  // 獲取當前數據
  getCurrentData(): T[] {
    return [...this.currentData]
  }

  // 獲取統計信息
  getStats() {
    return {
      ...this.stats.value,
      isAnimating: this.animationState.isAnimating,
      activeAnimations: this.animationState.currentAnimations.size,
      config: this.config
    }
  }

  // 更新配置
  updateConfig(newConfig: Partial<AnimationConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }
}

// 專門用於對話的增量更新管理器
export const conversationUpdateManager = new IncrementalUpdateManager<Conversation>({
  duration: 250,
  staggerDelay: 30,
  preserveScrollPosition: true
})

// 工具函數：獲取對話的唯一鍵
export const getConversationKey = (conversation: Conversation): string => conversation.id

// 工具函數：批量更新對話
export async function updateConversationsWithAnimation(
  newConversations: Conversation[],
  container?: HTMLElement
): Promise<void> {
  return conversationUpdateManager.updateWithAnimation(
    newConversations,
    getConversationKey,
    container
  )
}