import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useError } from './useError'

describe('useError composable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock console to avoid noise in tests
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('should initialize with empty error state', () => {
    const { error, loading } = useError()
    
    expect(error.value).toBe(null)
    expect(loading.value).toBe(false)
  })

  it('should handle string errors', () => {
    const { error, setError } = useError()
    
    setError('Something went wrong')
    
    expect(error.value).toBe('Something went wrong')
  })

  it('should handle Error objects', () => {
    const { error, handleError } = useError()
    const testError = new Error('Test error')
    
    handleError(testError)
    
    expect(error.value).toBe('Test error')
    expect(console.error).toHaveBeenCalledWith('Error occurred:', testError)
  })

  it('should handle objects without message property', () => {
    const { error, handleError } = useError()
    const unknownError = { someProperty: 'value' }
    
    handleError(unknownError)
    
    expect(error.value).toBe('發生未知錯誤')
    expect(console.error).toHaveBeenCalledWith('Error occurred:', unknownError)
  })

  it('should clear errors', () => {
    const { error, setError, clearError } = useError()
    
    setError('Test error')
    expect(error.value).toBe('Test error')
    
    clearError()
    expect(error.value).toBe(null)
  })

  it('should handle null/undefined errors', () => {
    const { error, handleError, clearError } = useError()
    
    handleError(null)
    expect(error.value).toBe('發生未知錯誤')
    
    clearError()
    
    handleError(undefined)  
    expect(error.value).toBe('發生未知錯誤')
    
    clearError()
    
    handleError({})  // Empty object without message property
    expect(error.value).toBe('發生未知錯誤')
  })

  it('should handle string errors directly', () => {
    const { error, handleError } = useError()
    
    handleError('Direct string error')
    expect(error.value).toBe('Direct string error')
  })

  it('should handle error objects with error property', () => {
    const { error, handleError } = useError()
    
    handleError({ error: 'API Error Response' })
    expect(error.value).toBe('API Error Response')
  })

  it('should prioritize message over error property', () => {
    const { error, handleError } = useError()
    
    handleError({ message: 'Error message', error: 'Error property' })
    expect(error.value).toBe('Error message')
  })

  it('should set error using setError method', () => {
    const { error, setError } = useError()
    
    setError('Direct error message')
    
    expect(error.value).toBe('Direct error message')
  })
})