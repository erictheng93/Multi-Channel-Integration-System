// 剪貼板 Composable
import { ref } from 'vue'
import { useError } from './useError'

export function useClipboard() {
  const { error, handleError, clearError } = useError()
  const isSupported = ref(!!navigator?.clipboard)

  const copy = async (text: string) => {
    clearError()
    
    if (!isSupported.value) {
      handleError(new Error('瀏覽器不支援剪貼板功能'))
      return false
    }

    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (err) {
      handleError(err)
      return false
    }
  }

  const read = async () => {
    clearError()
    
    if (!isSupported.value) {
      handleError(new Error('瀏覽器不支援剪貼板功能'))
      return null
    }

    try {
      const text = await navigator.clipboard.readText()
      return text
    } catch (err) {
      handleError(err)
      return null
    }
  }

  return {
    isSupported,
    error,
    copy,
    read,
    clearError
  }
}