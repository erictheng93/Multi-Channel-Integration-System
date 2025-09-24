// Simplified Error Handler - Reduces complexity across WebSocket services
// 專案名稱：Multi-Channel Support MVP - Unified Error Handling

export interface SimpleError {
  message: string
  code?: string
  context?: Record<string, unknown>
}

export interface ErrorResult<T> {
  success: boolean
  data?: T
  error?: SimpleError
}

/**
 * Simplified error handling wrapper for async operations
 * Eliminates repetitive try-catch blocks and standardizes error responses
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  context?: string
): Promise<ErrorResult<T>> {
  try {
    const data = await operation()
    return { success: true, data }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorContext = context ? { operation: context } : undefined

    console.error(`❌ [${context || 'Unknown'}] Error:`, errorMessage)

    return {
      success: false,
      error: {
        message: errorMessage,
        ...(errorContext && { context: errorContext })
      }
    }
  }
}

/**
 * Simplified error handling for sync operations
 */
export function safeSync<T>(
  operation: () => T,
  context?: string
): ErrorResult<T> {
  try {
    const data = operation()
    return { success: true, data }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorContext = context ? { operation: context } : undefined

    console.error(`❌ [${context || 'Unknown'}] Error:`, errorMessage)

    return {
      success: false,
      error: {
        message: errorMessage,
        ...(errorContext && { context: errorContext })
      }
    }
  }
}

/**
 * Simplified WebSocket error response helper
 */
export function createErrorResponse(
  error: SimpleError,
  status: number = 500
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: error.message,
      code: error.code
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}

/**
 * Simplified success response helper
 */
export function createSuccessResponse<T>(
  data: T,
  status: number = 200
): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}