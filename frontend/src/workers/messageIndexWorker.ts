/**
 * Message Index Web Worker
 * 在後台線程中構建 Lunr.js 索引，避免阻塞主線程
 */

import lunr from 'lunr'
import { createLogger } from '@/utils/logger'

const frontendLogger = createLogger('messageIndexWorker')

interface IndexDocument {
  id: string
  content: string
  senderName: string
  attachments: string
  messageType: string
}

interface Message {
  id: string | number
  content: string
  senderName?: string
  attachments?: Array<{ name?: string }>
  messageType?: string
}

interface WorkerRequest {
  type: 'BUILD_INDEX' | 'SEARCH' | 'ADVANCED_SEARCH'
  payload: {
    messages?: Message[]
    query?: string
  }
}

interface WorkerResponse {
  type: 'INDEX_BUILT' | 'SEARCH_RESULTS' | 'ERROR'
  payload: {
    serializedIndex?: string
    documents?: Record<string, Message>
    results?: string[]
    error?: string
    buildTime?: number
    searchTime?: number
  }
}

let index: lunr.Index | null = null
const documents = new Map<string, Message>()

/**
 * 構建索引
 */
function buildIndex(messages: Message[]): WorkerResponse {
  const startTime = performance.now()

  try {
    // 清空舊數據
    documents.clear()

    // 建立文檔映射
    messages.forEach(msg => {
      documents.set(msg.id.toString(), msg)
    })

    // 構建 Lunr 索引
    index = lunr(function() {
      this.ref('id')
      this.field('content', { boost: 3 })
      this.field('senderName', { boost: 2 })
      this.field('attachments', { boost: 1.5 })
      this.field('messageType', { boost: 1 })

      messages.forEach(msg => {
        const doc: IndexDocument = {
          id: msg.id.toString(),
          content: msg.content || '',
          senderName: msg.senderName || '',
          attachments: msg.attachments?.map(a => a.name || '').join(' ') || '',
          messageType: msg.messageType || 'text'
        }

        this.add(doc)
      })
    })

    const endTime = performance.now()
    const buildTime = endTime - startTime

    // 序列化索引以便傳回主線程
    const serializedIndex = JSON.stringify(index)

    // 轉換 Map 為普通對象
    const documentsObj: Record<string, Message> = {}
    documents.forEach((value, key) => {
      documentsObj[key] = value
    })

    frontendLogger.debug(`[Worker] 索引構建完成: ${messages.length} 條消息，耗時 ${buildTime.toFixed(2)}ms`)

    return {
      type: 'INDEX_BUILT',
      payload: {
        serializedIndex,
        documents: documentsObj,
        buildTime
      }
    }
  } catch (error) {
    console.error('[Worker] 索引構建失敗:', error)
    return {
      type: 'ERROR',
      payload: {
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}

/**
 * 搜索
 */
function search(query: string): WorkerResponse {
  if (!index) {
    return {
      type: 'ERROR',
      payload: {
        error: '索引未構建'
      }
    }
  }

  const startTime = performance.now()

  try {
    const results = index.search(query)
    const resultIds = results.map(result => result.ref)

    const searchTime = performance.now() - startTime

    frontendLogger.debug(`[Worker] 搜索完成: "${query}" -> ${resultIds.length} 條結果，耗時 ${searchTime.toFixed(2)}ms`)

    return {
      type: 'SEARCH_RESULTS',
      payload: {
        results: resultIds,
        searchTime
      }
    }
  } catch (error) {
    console.error('[Worker] 搜索失敗:', error)
    return {
      type: 'ERROR',
      payload: {
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}

/**
 * 處理來自主線程的消息
 */
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { type, payload } = event.data

  let response: WorkerResponse

  switch (type) {
    case 'BUILD_INDEX':
      if (payload.messages) {
        response = buildIndex(payload.messages)
      } else {
        response = {
          type: 'ERROR',
          payload: { error: '缺少 messages 參數' }
        }
      }
      break

    case 'SEARCH':
    case 'ADVANCED_SEARCH':
      if (payload.query) {
        response = search(payload.query)
      } else {
        response = {
          type: 'ERROR',
          payload: { error: '缺少 query 參數' }
        }
      }
      break

    default:
      response = {
        type: 'ERROR',
        payload: { error: `未知的請求類型: ${type}` }
      }
  }

  self.postMessage(response)
}

// 導出類型供主線程使用
export type { WorkerRequest, WorkerResponse, Message }
