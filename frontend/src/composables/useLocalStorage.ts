// 現代化 LocalStorage Composable
import { ref, watch, type Ref } from 'vue'

export interface UseLocalStorageOptions<T> {
  defaultValue?: T
  serializer?: {
    read: (_value: string) => T
    write: (_value: T) => string
  }
  onError?: (_error: Error) => void
  syncAcrossTabs?: boolean
}

// 默認序列化器
const defaultSerializer = {
  read: (_value: string) => {
    try {
      return JSON.parse(_value)
    } catch {
      return _value
    }
  },
  write: (_value: unknown) => JSON.stringify(_value)
}

export function useLocalStorage<T>(
  key: string,
  defaultValue?: T,
  options: UseLocalStorageOptions<T> = {}
): [Ref<T>, (_value: T) => void, () => void] {
  const {
    serializer = defaultSerializer,
    onError = (_e) => console.error(_e),
    syncAcrossTabs = true
  } = options

  // 讀取初始值
  const read = (): T => {
    if (typeof window === 'undefined') {
      return defaultValue as T
    }

    try {
      const item = window.localStorage.getItem(key)
      if (item === null) {
        return defaultValue as T
      }
      return serializer.read(item)
    } catch (error) {
      onError(error as Error)
      return defaultValue as T
    }
  }

  // 寫入值
  const write = (value: T): void => {
    if (typeof window === 'undefined') {return}

    try {
      if (value === null || value === undefined) {
        window.localStorage.removeItem(key)
      } else {
        window.localStorage.setItem(key, serializer.write(value))
      }
    } catch (error) {
      onError(error as Error)
    }
  }

  // 創建響應式引用
  const storedValue: Ref<T> = ref(read()) as Ref<T>

  // 監聽值變化並同步到 localStorage
  watch(
    storedValue,
    (newValue) => {
      write(newValue)
    },
    { deep: true }
  )

  // 跨標籤頁同步
  if (syncAcrossTabs && typeof window !== 'undefined') {
    const handleStorageChange = (e: globalThis.StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          storedValue.value = serializer.read(e.newValue)
        } catch (error) {
          onError(error as Error)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)

    // 清理監聽器
    if (typeof window !== 'undefined') {
      const cleanup = () => {
        window.removeEventListener('storage', handleStorageChange)
      }
      
      // 在組件卸載時清理
      if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', cleanup)
      }
    }
  }

  // 設置值的方法
  const setValue = (value: T) => {
    storedValue.value = value
  }

  // 移除值的方法
  const removeValue = () => {
    storedValue.value = defaultValue as T
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key)
    }
  }

  return [storedValue, setValue, removeValue]
}

// 專門用於對象的 localStorage composable
export function useLocalStorageObject<T extends Record<string, unknown>>(
  key: string,
  defaultValue: T = {} as T
) {
  const [data, setData, removeData] = useLocalStorage(key, defaultValue)

  // 更新對象的某個屬性
  const updateProperty = <K extends keyof T>(property: K, value: T[K]) => {
    data.value = {
      ...data.value,
      [property]: value
    }
  }

  // 批量更新屬性
  const updateProperties = (updates: Partial<T>) => {
    data.value = {
      ...data.value,
      ...updates
    }
  }

  // 重置到默認值
  const reset = () => {
    setData(defaultValue)
  }

  return {
    data,
    setData,
    removeData,
    updateProperty,
    updateProperties,
    reset
  }
}

// 專門用於數組的 localStorage composable
export function useLocalStorageArray<T>(
  key: string,
  defaultValue: T[] = []
) {
  const [data, setData, removeData] = useLocalStorage(key, defaultValue)

  // 添加項目
  const addItem = (item: T) => {
    data.value = [...data.value, item]
  }

  // 移除項目
  const removeItem = (index: number) => {
    data.value = data.value.filter((_item, i) => i !== index)
  }

  // 根據條件移除項目
  const removeItemBy = (predicate: (_item: T) => boolean) => {
    data.value = data.value.filter(item => !predicate(item))
  }

  // 更新項目
  const updateItem = (index: number, item: T) => {
    const newData = [...data.value]
    newData[index] = item
    data.value = newData
  }

  // 清空數組
  const clear = () => {
    data.value = []
  }

  return {
    data,
    setData,
    removeData,
    addItem,
    removeItem,
    removeItemBy,
    updateItem,
    clear
  }
}