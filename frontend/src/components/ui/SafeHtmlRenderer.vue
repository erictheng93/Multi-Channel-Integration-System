<template>
  <div
    ref="containerRef"
    class="safe-html-container"
  />
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'

interface Props {
  html?: string
  allowedTags?: string[]
  allowedAttributes?: Record<string, string[]>
}

const props = withDefaults(defineProps<Props>(), {
  html: '',
  allowedTags: () => ['span', 'img', 'div', 'a'],
  allowedAttributes: () => ({
    span: ['class', 'title', 'style'],
    img: ['src', 'alt', 'title', 'class', 'style', 'width', 'height', 'data-sticker-package', 'data-sticker-id', 'data-sticker-type'],
    div: ['class', 'style'],
    a: ['href', 'target', 'rel', 'class', 'title']
  })
})

const containerRef = ref<HTMLElement>()

/**
 * 安全的HTML清理器
 * 只允许白名单中的标签和属性
 */
const sanitizeHtml = (html: string): string => {
  // 创建一个临时DOM元素来解析HTML
  const temp = document.createElement('div')
  temp.innerHTML = html
  
  // 递归处理所有节点
  const processNode = (node: globalThis.Node): globalThis.Node | null => {
    if (node.nodeType === globalThis.Node.TEXT_NODE) {
      // 文本节点直接返回
      return node.cloneNode(true)
    }
    
    if (node.nodeType === globalThis.Node.ELEMENT_NODE) {
      const element = node as globalThis.Element
      const tagName = element.tagName.toLowerCase()
      
      // 检查是否在允许的标签列表中
      if (!props.allowedTags.includes(tagName)) {
        // 如果标签不被允许，返回其文本内容
        return document.createTextNode(element.textContent || '')
      }
      
      // 创建新的安全元素
      const safeElement = document.createElement(tagName)
      
      // 复制允许的属性
      const allowedAttrs = props.allowedAttributes[tagName] || []
      for (const attr of allowedAttrs) {
        const value = element.getAttribute(attr)
        if (value !== null) {
          // 额外的安全检查
          if (attr === 'src' && !isValidImageSrc(value)) {
            continue
          }
          if (attr === 'href' && !isValidHref(value)) {
            continue
          }
          if (attr === 'style' && !isValidStyle(value)) {
            continue
          }
          safeElement.setAttribute(attr, value)
        }
      }
      
      // 递归处理子节点
      for (const child of Array.from(element.childNodes)) {
        const safeChild = processNode(child)
        if (safeChild) {
          safeElement.appendChild(safeChild)
        }
      }
      
      return safeElement
    }
    
    return null
  }
  
  // 处理所有子节点
  const safeContainer = document.createElement('div')
  for (const child of Array.from(temp.childNodes)) {
    const safeChild = processNode(child)
    if (safeChild) {
      safeContainer.appendChild(safeChild)
    }
  }
  
  return safeContainer.innerHTML
}

/**
 * 验证图片源是否安全
 */
const isValidImageSrc = (src: string): boolean => {
  try {
    const url = new URL(src, window.location.origin)
    // 只允许HTTP/HTTPS协议
    return ['http:', 'https:', 'data:'].includes(url.protocol)
  } catch {
    return false
  }
}

/**
 * 验证链接href是否安全
 * Validates that link href only uses http/https protocols
 */
const isValidHref = (href: string): boolean => {
  try {
    const url = new URL(href, window.location.origin)
    // 只允许HTTP/HTTPS协议（不允许javascript:, data:等）
    return ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}

/**
 * 验证CSS样式是否安全
 */
const isValidStyle = (style: string): boolean => {
  // 基本的CSS安全检查，阻止可能的脚本注入
  const dangerousPatterns = [
    /javascript:/i,
    /expression\s*\(/i,
    /url\s*\(\s*['"]?\s*javascript:/i,
    /@import/i,
    /behavior\s*:/i
  ]
  
  return !dangerousPatterns.some(pattern => pattern.test(style))
}

/**
 * 為貼圖圖片添加加載失敗處理
 */
const setupImageErrorHandlers = () => {
  if (!containerRef.value) {return}

  // 找到所有貼圖圖片元素
  const images = containerRef.value.querySelectorAll('img.sticker-image')

  images.forEach((img) => {
    const imgElement = img as HTMLImageElement

    // 添加 load 事件處理
    imgElement.addEventListener('load', () => {
      // 圖片加載成功，設置透明度
      imgElement.style.opacity = '1'
      console.log('✅ Sticker loaded:', imgElement.src)
    })

    // 添加 error 事件處理
    imgElement.addEventListener('error', () => {
      console.log('❌ Sticker failed to load:', imgElement.src)

      // 隱藏圖片
      imgElement.style.display = 'none'

      // 顯示 Fallback
      const fallback = imgElement.nextElementSibling as HTMLElement
      if (fallback && fallback.classList.contains('sticker-fallback')) {
        fallback.style.display = 'block'
      }
    })

    // 如果圖片已經加載完成（從緩存），立即觸發相應事件
    if (imgElement.complete) {
      if (imgElement.naturalWidth === 0) {
        // 圖片加載失敗
        imgElement.dispatchEvent(new Event('error'))
      } else {
        // 圖片加載成功
        imgElement.dispatchEvent(new Event('load'))
      }
    }
  })
}

/**
 * 渲染安全的HTML内容
 */
const renderSafeHtml = async () => {
  if (containerRef.value && props.html) {
    const safeHtml = sanitizeHtml(props.html)
    containerRef.value.innerHTML = safeHtml

    // 等待 DOM 更新後設置事件處理器
    await nextTick()
    setupImageErrorHandlers()
  } else if (containerRef.value) {
    containerRef.value.innerHTML = ''
  }
}

// 监听HTML变化
watch(() => props.html, renderSafeHtml)

// 组件挂载后初始渲染
onMounted(renderSafeHtml)
</script>

<style scoped>
.safe-html-container {
  display: inline;
}

/* 确保渲染的内容样式正确 */
.safe-html-container :deep(.emoji) {
  font-size: 1.2em;
  line-height: 1;
  vertical-align: middle;
}

.safe-html-container :deep(.emoji-image) {
  width: 1.2em;
  height: 1.2em;
  display: inline-block;
  vertical-align: middle;
  object-fit: contain;
  margin: 0 1px;
}

.safe-html-container :deep(.line-sticker) {
  max-width: 100px;
  max-height: 100px;
  display: inline-block;
  vertical-align: middle;
  object-fit: contain;
  margin: 2px;
  border-radius: var(--radius-md, 6px);
}

.safe-html-container :deep(.custom-emoji) {
  width: 1.2em;
  height: 1.2em;
  display: inline-block;
  vertical-align: middle;
  object-fit: contain;
  margin: 0 1px;
}

/* Clickable link styles - 可点击链接样式 */
.safe-html-container :deep(a),
.safe-html-container :deep(.message-link) {
  color: #2563eb; /* Blue color like Image #2 */
  text-decoration: underline;
  cursor: pointer;
  word-break: break-all; /* Handle long URLs */
}

.safe-html-container :deep(a:hover),
.safe-html-container :deep(.message-link:hover) {
  color: #1d4ed8; /* Darker blue on hover */
  text-decoration: underline;
}

.safe-html-container :deep(a:visited),
.safe-html-container :deep(.message-link:visited) {
  color: #7c3aed; /* Purple for visited links */
}
</style>