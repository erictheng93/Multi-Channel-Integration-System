// PDF Export Service
// PDF 匯出服務 — 在瀏覽器端使用 jsPDF + html2canvas 產生 PDF
// 利用瀏覽器原生字型渲染，完美支援中文 (CJK) 字元

export interface PdfExportMessage {
  id: string
  conversationId: string
  senderType: string
  senderName: string
  content: string
  messageType: string
  sentAt: string | null
  deliveryStatus: string | null
  createdAt: string | null
}

export interface PdfExportData {
  messages: PdfExportMessage[]
  exportInfo: {
    format: string
    totalRecords: number
    exportedAt: string
    exportedBy: string
    filters: {
      conversationId?: string
      dateFrom?: string
      dateTo?: string
      customerId?: string
      agentId?: string
      limit?: number
    }
  }
}

export interface PdfExportOptions {
  title?: string
  pageSize?: 'a4' | 'letter'
}

// ─── DOM helper utilities ───

/** 建立帶樣式的元素 */
function createElement(
  tag: string,
  styles: Record<string, string> = {},
  text?: string
): HTMLElement {
  const el = document.createElement(tag)
  Object.assign(el.style, styles)
  if (text !== undefined) {
    el.textContent = text
  }
  return el
}

/** 建立 span 元素 */
function createSpan(text: string, styles: Record<string, string> = {}): HTMLSpanElement {
  const span = document.createElement('span')
  Object.assign(span.style, styles)
  span.textContent = text
  return span
}

/** 格式化日期 */
function formatDate(dateStr: string | null): string {
  if (!dateStr) {return '未知時間'}
  try {
    return new Date(dateStr).toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  } catch {
    return dateStr
  }
}

/** 建構 Header 區塊 */
function buildHeader(
  title: string,
  exportInfo: PdfExportData['exportInfo'],
  conversationCount: number,
  filterItems: string[]
): HTMLDivElement {
  const header = createElement('div', {
    marginBottom: '32px',
    paddingBottom: '20px',
    borderBottom: '2px solid #007AFF'
  }) as HTMLDivElement

  // 標題
  const h1 = createElement('h1', {
    margin: '0 0 8px 0',
    fontSize: '22px',
    fontWeight: '700',
    color: '#1d1d1f'
  }, title)
  header.appendChild(h1)

  // 匯出摘要
  const metaRow = createElement('div', {
    display: 'flex',
    gap: '24px',
    fontSize: '12px',
    color: '#86868b'
  })
  metaRow.appendChild(createSpan(`匯出時間: ${formatDate(exportInfo.exportedAt)}`))
  metaRow.appendChild(createSpan(`記錄數量: ${exportInfo.totalRecords} 筆`))
  metaRow.appendChild(createSpan(`對話數量: ${conversationCount} 段`))
  header.appendChild(metaRow)

  // 篩選條件
  if (filterItems.length > 0) {
    const filterBox = createElement('div', {
      marginTop: '12px',
      padding: '8px 12px',
      background: '#f5f5f7',
      borderRadius: '6px',
      fontSize: '11px',
      color: '#636366'
    }, `篩選條件: ${filterItems.join(' | ')}`)
    header.appendChild(filterBox)
  }

  return header
}

/** 建構單則訊息 DOM */
function buildMessageBlock(msg: PdfExportMessage): HTMLDivElement {
  const isAgent = msg.senderType === 'agent'
  const name = msg.senderName || (isAgent ? '客服' : '客戶')
  const time = formatDate(msg.createdAt)
  const accentColor = isAgent ? '#007AFF' : '#8e8e93'
  const bgColor = isAgent ? '#f0f7ff' : '#f5f5f7'

  const block = createElement('div', {
    marginBottom: '6px',
    padding: '8px 12px',
    background: bgColor,
    borderLeft: `3px solid ${accentColor}`,
    borderRadius: '0 6px 6px 0'
  }) as HTMLDivElement

  // 上方列：發送者 + 時間
  const metaRow = createElement('div', {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '3px'
  })

  const senderLabel = createSpan(
    `${isAgent ? '[客服]' : '[客戶]'} ${name}`,
    { fontWeight: '600', fontSize: '12px', color: accentColor }
  )
  metaRow.appendChild(senderLabel)

  const timeLabel = createSpan(time, { fontSize: '10px', color: '#aeaeb2' })
  metaRow.appendChild(timeLabel)

  block.appendChild(metaRow)

  // 訊息內容
  const contentDiv = createElement('div', {
    fontSize: '13px',
    color: '#1d1d1f',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  }, msg.content)
  block.appendChild(contentDiv)

  return block
}

/** 建構對話群組 DOM */
function buildConversationGroup(
  convId: string,
  msgs: PdfExportMessage[],
  groupIndex: number
): HTMLDivElement {
  const shortId = convId.length > 12 ? `${convId.slice(0, 6)}...${convId.slice(-6)}` : convId

  const group = createElement('div', {
    marginBottom: '24px'
  }) as HTMLDivElement

  // 群組標題
  const groupHeader = createElement('div', {
    padding: '8px 14px',
    background: 'linear-gradient(135deg, #f0f4ff 0%, #f5f0ff 100%)',
    borderRadius: '8px',
    marginBottom: '12px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#3b3b3b'
  }, `對話 #${groupIndex} \u2014 ${shortId}  (${msgs.length} 則訊息)`)
  group.appendChild(groupHeader)

  // 個別訊息
  for (const msg of msgs) {
    group.appendChild(buildMessageBlock(msg))
  }

  return group
}

/** 建構 Footer 區塊 */
function buildFooter(exportedAt: string): HTMLDivElement {
  return createElement('div', {
    marginTop: '32px',
    paddingTop: '16px',
    borderTop: '1px solid #e5e5ea',
    fontSize: '10px',
    color: '#aeaeb2',
    textAlign: 'center'
  }, `Multi-Channel CRM \u2014 對話記錄匯出報告 \u2014 產生時間 ${formatDate(exportedAt)}`) as HTMLDivElement
}

/**
 * 將訊息資料建構為匯出用 HTML
 * 產生一個隱藏的 div，供 html2canvas 擷取
 */
export function buildExportHtml(
  data: PdfExportData,
  options: PdfExportOptions = {}
): HTMLDivElement {
  const title = options.title || '對話記錄匯出報告'
  const { messages, exportInfo } = data

  // 按 conversationId 分組
  const grouped = new Map<string, PdfExportMessage[]>()
  for (const msg of messages) {
    const convId = msg.conversationId
    const existing = grouped.get(convId)
    if (existing) {
      existing.push(msg)
    } else {
      grouped.set(convId, [msg])
    }
  }

  // 排序每組內訊息（由舊到新）
  for (const [, msgs] of grouped) {
    msgs.sort((a, b) =>
      (a.createdAt || '').localeCompare(b.createdAt || '')
    )
  }

  // 構建篩選條件摘要
  const filterItems: string[] = []
  if (exportInfo.filters.conversationId) {
    filterItems.push(`對話 ID: ${exportInfo.filters.conversationId}`)
  }
  if (exportInfo.filters.dateFrom) {
    filterItems.push(`起始: ${formatDate(exportInfo.filters.dateFrom)}`)
  }
  if (exportInfo.filters.dateTo) {
    filterItems.push(`結束: ${formatDate(exportInfo.filters.dateTo)}`)
  }
  if (exportInfo.filters.customerId) {
    filterItems.push(`客戶 ID: ${exportInfo.filters.customerId}`)
  }
  if (exportInfo.filters.agentId) {
    filterItems.push(`客服 ID: ${exportInfo.filters.agentId}`)
  }

  // 主容器
  const container = createElement('div', {
    position: 'absolute',
    left: '-9999px',
    top: '0',
    width: '794px',
    background: '#ffffff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft JhengHei", "PingFang TC", sans-serif',
    fontSize: '13px',
    lineHeight: '1.6',
    color: '#1d1d1f',
    padding: '40px',
    boxSizing: 'border-box'
  }) as HTMLDivElement

  // 組裝
  container.appendChild(buildHeader(title, exportInfo, grouped.size, filterItems))

  let groupIndex = 0
  for (const [convId, msgs] of grouped) {
    groupIndex++
    container.appendChild(buildConversationGroup(convId, msgs, groupIndex))
  }

  container.appendChild(buildFooter(exportInfo.exportedAt))

  return container
}

/**
 * 產生 PDF 匯出檔案
 * 動態匯入 jspdf + html2canvas（懶載入，不影響首次載入效能）
 */
export async function generatePdfExport(
  data: PdfExportData,
  options: PdfExportOptions = {}
): Promise<Blob> {
  // 動態匯入以減少 bundle 大小
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas')
  ])

  const pageSize = options.pageSize || 'a4'

  // 建構 HTML 並附加到 DOM（html2canvas 需要元素在 DOM 中才能擷取）
  const htmlDiv = buildExportHtml(data, options)
  document.body.appendChild(htmlDiv)

  try {
    // 使用 html2canvas 擷取 HTML 為圖片
    const canvas = await html2canvas(htmlDiv, {
      scale: 2, // 2x 解析度以確保文字清晰
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 794 // A4 寬度 (210mm ~ 794px at 96dpi)
    })

    // 計算 PDF 頁面尺寸
    const imgWidth = pageSize === 'a4' ? 210 : 215.9 // mm
    const pageHeight = pageSize === 'a4' ? 297 : 279.4 // mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    // 建立 PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: pageSize
    })

    const imgData = canvas.toDataURL('image/jpeg', 0.95)

    // 如果內容超過一頁，分頁處理
    let heightLeft = imgHeight
    let position = 0

    // 第一頁
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight

    // 後續頁面
    while (heightLeft > 0) {
      position = -(imgHeight - heightLeft)
      pdf.addPage()
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }

    return pdf.output('blob')
  } finally {
    // 清理 DOM 元素
    document.body.removeChild(htmlDiv)
  }
}
