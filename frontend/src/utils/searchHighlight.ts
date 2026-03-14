/**
 * 搜索結果高亮工具
 * 用於在文本中高亮顯示搜索關鍵詞
 */

export interface HighlightOptions {
  /**
   * 高亮 CSS 類名
   * @default 'search-highlight'
   */
  className?: string

  /**
   * 是否區分大小寫
   * @default false
   */
  caseSensitive?: boolean

  /**
   * 最大高亮數量（避免性能問題）
   * @default 100
   */
  maxHighlights?: number

  /**
   * 是否啟用模糊匹配
   * @default false
   */
  fuzzyMatch?: boolean
}

/**
 * 轉義正則表達式特殊字符
 */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 從查詢字符串中提取搜索詞
 * 處理布爾運算符和字段查詢
 */
function extractSearchTerms(query: string): string[] {
  // 移除布爾運算符和字段前綴
  const cleanQuery = query
    .replace(/\b(AND|OR|NOT)\b/gi, ' ')
    .replace(/[+-]/g, ' ')
    .replace(/\w+:/g, ' ')
    .replace(/[()]/g, ' ')
    .replace(/~/g, ' ')
    .replace(/\*/g, '')

  // 分詞並過濾空詞
  return cleanQuery
    .split(/\s+/)
    .filter(term => term.trim().length > 0)
    .map(term => term.trim())
}

/**
 * 高亮文本中的搜索關鍵詞
 * @param text - 原始文本
 * @param query - 搜索查詢字符串
 * @param options - 高亮選項
 * @returns 包含高亮標記的 HTML 字符串
 *
 * @example
 * highlightText('這是一條測試消息', '測試')
 * // 返回: '這是一條<mark class="search-highlight">測試</mark>消息'
 */
export function highlightText(
  text: string,
  query: string,
  options: HighlightOptions = {}
): string {
  if (!text || !query) {
    return text
  }

  const {
    className = 'search-highlight',
    caseSensitive = false,
    maxHighlights = 100
  } = options

  // 提取搜索詞
  const searchTerms = extractSearchTerms(query)
  if (searchTerms.length === 0) {
    return text
  }

  let highlightedText = text
  let highlightCount = 0

  // 對每個搜索詞進行高亮
  for (const term of searchTerms) {
    if (highlightCount >= maxHighlights) {
      break
    }

    const escapedTerm = escapeRegExp(term)
    const flags = caseSensitive ? 'g' : 'gi'
    const regex = new RegExp(`(${escapedTerm})`, flags)

    // 計算匹配數量
    const matches = highlightedText.match(regex)
    if (matches) {
      const matchCount = matches.length
      if (highlightCount + matchCount > maxHighlights) {
        // 如果超過最大數量，只高亮部分
        const remainingCount = maxHighlights - highlightCount
        let count = 0
        highlightedText = highlightedText.replace(regex, (match) => {
          if (count < remainingCount) {
            count++
            return `<mark class="${className}">${match}</mark>`
          }
          return match
        })
        highlightCount = maxHighlights
        break
      } else {
        highlightedText = highlightedText.replace(
          regex,
          `<mark class="${className}">$1</mark>`
        )
        highlightCount += matchCount
      }
    }
  }

  return highlightedText
}

/**
 * 高亮 Vue 組件安全版本
 * 返回分段數組，可用於 v-for 渲染
 * @param text - 原始文本
 * @param query - 搜索查詢字符串
 * @returns 文本片段數組，每個片段標記是否為高亮
 *
 * @example
 * highlightTextSegments('這是一條測試消息', '測試')
 * // 返回: [
 * // { text: '這是一條', highlight: false },
 * // { text: '測試', highlight: true },
 * // { text: '消息', highlight: false }
 * // ]
 */
export interface TextSegment {
  text: string
  highlight: boolean
}

export function highlightTextSegments(
  text: string,
  query: string,
  options: HighlightOptions = {}
): TextSegment[] {
  if (!text || !query) {
    return [{ text, highlight: false }]
  }

  const {
    caseSensitive = false,
    maxHighlights = 100
  } = options

  const searchTerms = extractSearchTerms(query)
  if (searchTerms.length === 0) {
    return [{ text, highlight: false }]
  }

  // 構建所有搜索詞的正則表達式
  const escapedTerms = searchTerms.map(term => escapeRegExp(term))
  const flags = caseSensitive ? 'g' : 'gi'
  const regex = new RegExp(`(${escapedTerms.join('|')})`, flags)

  // 分割文本
  const segments: TextSegment[] = []
  let lastIndex = 0
  let highlightCount = 0

  const matches = Array.from(text.matchAll(regex))

  for (const match of matches) {
    if (highlightCount >= maxHighlights) {
      break
    }

    const matchIndex = match.index
    if (matchIndex === undefined) {
      continue
    }

    const matchText = match[0]

    // 添加非高亮部分
    if (matchIndex > lastIndex) {
      segments.push({
        text: text.substring(lastIndex, matchIndex),
        highlight: false
      })
    }

    // 添加高亮部分
    segments.push({
      text: matchText,
      highlight: true
    })

    lastIndex = matchIndex + matchText.length
    highlightCount++
  }

  // 添加剩餘文本
  if (lastIndex < text.length) {
    segments.push({
      text: text.substring(lastIndex),
      highlight: false
    })
  }

  return segments.length > 0 ? segments : [{ text, highlight: false }]
}

/**
 * 計算高亮統計信息
 * @param text - 原始文本
 * @param query - 搜索查詢字符串
 * @returns 統計信息
 */
export interface HighlightStats {
  totalMatches: number
  matchedTerms: string[]
  matchPositions: Array<{ start: number; end: number; term: string }>
}

export function getHighlightStats(
  text: string,
  query: string,
  caseSensitive: boolean = false
): HighlightStats {
  const stats: HighlightStats = {
    totalMatches: 0,
    matchedTerms: [],
    matchPositions: []
  }

  if (!text || !query) {
    return stats
  }

  const searchTerms = extractSearchTerms(query)
  const matchedTermsSet = new Set<string>()

  for (const term of searchTerms) {
    const escapedTerm = escapeRegExp(term)
    const flags = caseSensitive ? 'g' : 'gi'
    const regex = new RegExp(escapedTerm, flags)

    const matches = Array.from(text.matchAll(regex))
    if (matches.length > 0) {
      matchedTermsSet.add(term)
      stats.totalMatches += matches.length

      for (const match of matches) {
        const matchIndex = match.index
        if (matchIndex !== undefined) {
          stats.matchPositions.push({
            start: matchIndex,
            end: matchIndex + match[0].length,
            term: match[0]
          })
        }
      }
    }
  }

  stats.matchedTerms = Array.from(matchedTermsSet)

  // 按位置排序
  stats.matchPositions.sort((a, b) => a.start - b.start)

  return stats
}

/**
 * 預覽高亮結果（截取上下文）
 * @param text - 原始文本
 * @param query - 搜索查詢字符串
 * @param contextLength - 上下文長度（字符數）
 * @returns 包含高亮的預覽文本
 */
export function getHighlightPreview(
  text: string,
  query: string,
  contextLength: number = 50
): string {
  if (!text || !query) {
    return text.substring(0, contextLength * 2)
  }

  const stats = getHighlightStats(text, query)
  if (stats.matchPositions.length === 0) {
    return text.substring(0, contextLength * 2)
  }

  // 取第一個匹配位置
  const firstMatch = stats.matchPositions[0]
  if (!firstMatch) {
    return text.substring(0, contextLength * 2)
  }

  const start = Math.max(0, firstMatch.start - contextLength)
  const end = Math.min(text.length, firstMatch.end + contextLength)

  let preview = text.substring(start, end)

  // 添加省略號
  if (start > 0) {
    preview = `...${  preview}`
  }
  if (end < text.length) {
    preview = `${preview  }...`
  }

  // 高亮預覽文本
  return highlightText(preview, query)
}
