#  MessageBubble 功能对比清单

**生成日期**: 2026-01-05
**目的**: 确保 MessageBubbleOptimized 功能完整性 100% 对齐原版
**状态**:  Phase 1 准备中

---

##  功能对比矩阵

| 功能模块 | MessageBubble.vue (原版) | MessageBubbleOptimized.vue | 状态 |
|---------|------------------------|---------------------------|------|
| **消息类型支持** | | | |
|  文本消息 |  SafeHtmlRenderer |  纯文本 |  需补齐 |
|  图片消息 |  完整支持 |  完整支持 |  已对齐 |
|  文件消息（单个） |  FileAttachmentCard |  内联文件卡片 |  需补齐 |
|  文件消息（多个） |  支持 |  不支持 |  需补齐 |
|  贴纸消息 |  完整支持 |  不支持 |  需补齐 |
| **消息操作** | | | |
| 复制消息 |  copyMessage |  $emit('copy') |  已对齐 |
| 回复消息 |  replyToMessage |  $emit('reply') |  已对齐 |
| 转发消息 |  forwardMessage |  $emit('forward') |  已对齐 |
| 撤回消息 |  recallMessage |  $emit('recall') |  已对齐 |
| 选择消息 |  selectMessage |  不支持 |  需补齐 |
| 重试失败消息 |  handleRetry |  不支持 |  需补齐 |
| 下拉操作菜单 |  showActionsMenu |  不支持 |  需补齐 |
| **图片功能** | | | |
| 图片预览 |  模态窗口 + 缩放 |  window.open() |  需补齐 |
| 图片缩放 |  0.5x - 3x |  不支持 |  需补齐 |
| 滚轮缩放 |  handleZoom |  不支持 |  需补齐 |
| 图片下载 |  downloadFile |  downloadFile |  已对齐 |
| **Composables** | | | |
| useMessageTime |  使用 |  内联实现 |  需补齐 |
| useMessageAttachment |  使用 |  内联实现 |  需补齐 |
| useMessageActions |  使用 |  内联实现 |  需补齐 |
| useMessageSticker |  使用 |  不支持 |  需补齐 |
| useMessageContent |  使用 |  不支持 |  需补齐 |
| **Props** | | | |
| message |  Message |  Message |  已对齐 |
| delivered |  boolean |  boolean |  已对齐 |
| showSender |  boolean |  boolean |  已对齐 |
| uploadProgress |  number |  不支持 |  需补齐 |
| attachmentUrl |  string |  不支持 |  需补齐 |
| attachmentName |  string |  不支持 |  需补齐 |
| attachmentSize |  number |  不支持 |  需补齐 |
| canEdit |  不支持 |  boolean |  优化版新增 |
| canDelete |  不支持 |  boolean |  优化版新增 |
| **Emits** | | | |
| preview |  [message] |  不支持 |  需补齐 |
| image-error |  [message] |  不支持 |  需补齐 |
| copy |  [message] |  [message] |  已对齐 |
| reply |  [message] |  [message] |  已对齐 |
| forward |  [message] |  [message] |  已对齐 |
| recall |  [message] |  [message] |  已对齐 |
| select |  [message] |  [message] |  已对齐 |
| retry |  [messageId] |  不支持 |  需补齐 |
| **性能优化** | | | |
| v-memo |  不使用 |  使用 |  优化版优势 |
| Lazy Loading Icons |  不使用 |  defineAsyncComponent |  优化版优势 |
| 时间格式化缓存 |  不使用 |  使用 |  优化版优势 |
| CSS contain |  不使用 |  使用 |  优化版优势 |
| GPU 加速 |  不使用 |  transform: translateZ(0) |  优化版优势 |

---

##  需要补齐的功能清单

### 1️ **导入依赖补齐**

```typescript
// MessageBubbleOptimized.vue 缺失的导入
import SafeHtmlRenderer from '@/components/ui/SafeHtmlRenderer.vue'
import FileAttachmentCard from '@/components/file/FileAttachmentCard.vue'
import { MESSAGE_STATUS } from '@/constants/message-status'

// Composables
import {
  useMessageTime,
  useMessageAttachment,
  useMessageActions,
  useMessageSticker,
  useMessageContent,
  type FileAttachment
} from '@/composables/message'

// 格式化工具
import {
  formatFileSize,
  getFileExtension,
  getFileTypeClass
} from '@/utils/message'

// 图标（保留 Lazy Loading）
import {
  XIcon,
  MoreVerticalIcon,
  CheckIcon
} from '@/components/icons'
```

---

### 2️ **Props 补齐**

```typescript
interface Props {
  message: Message
  delivered?: boolean
  showSender?: boolean
  // 需要添加：
  uploadProgress?: number
  attachmentUrl?: string
  attachmentName?: string
  attachmentSize?: number
  // 优化版已有（保留）：
  canEdit?: boolean
  canDelete?: boolean
}
```

---

### 3️ **Emits 补齐**

```typescript
const emit = defineEmits<{
  preview: [message: Message]
  'image-error': [message: Message]
  copy: [message: Message]
  reply: [message: Message]
  forward: [message: Message]
  recall: [message: Message]
  select: [message: Message]
  retry: [messageId: string] //  需要添加
}>()
```

---

### 4️ **贴纸消息支持**

**原版实现**（需要完整复制）：
```vue
<!-- Sticker Message -->
<div
  v-else-if="actualMessageType === 'sticker'"
  class="message-sticker"
>
  <!-- SafeHtmlRenderer 渲染 -->
  <SafeHtmlRenderer
    v-if="processedMessageContent && processedMessageContent !== message.content"
    :html="processedMessageContent"
    class="sticker-rendered-content"
  />

  <!-- 贴纸图片 fallback -->
  <template v-else>
    <!-- Loading state -->
    <div v-if="stickerLoading && !stickerLoadError" class="sticker-loading">
      <div class="sticker-loading-container">
        <div class="sticker-skeleton" />
        <div class="loading-spinner">
          <div class="spinner-ring" />
        </div>
      </div>
      <div class="loading-text">載入貼圖中...</div>
    </div>

    <!-- Sticker image -->
    <div
      v-else-if="stickerImageUrl && !stickerLoadError"
      class="sticker-image-container"
    >
      <img
        :key="`sticker-${stickerMetadata?.stickerId}-${currentStickerUrlIndex}`"
        :src="stickerImageUrl"
        alt="LINE Sticker"
        class="sticker-image"
        loading="lazy"
        @error="onStickerError"
        @load="onStickerLoad"
        @loadstart="onStickerLoadStart"
      >
    </div>

    <!-- Error fallback -->
    <div v-else class="sticker-placeholder enhanced">
      <div class="sticker-icon-large">
        <div class="sticker-emoji"></div>
      </div>
      <div class="sticker-fallback-content">
        <div class="sticker-text">{{ message.content }}</div>
        <div class="sticker-error-hint">貼圖載入失敗</div>
      </div>
    </div>
  </template>
</div>
```

**需要的 Composable**：
```typescript
const stickerProps = computed(() => ({ message: props.message }))
const {
  stickerMetadata,
  stickerUrls,
  stickerImageUrl,
  currentStickerUrlIndex,
  stickerLoadError,
  stickerLoading,
  onStickerLoadStart,
  onStickerError,
  onStickerLoad
} = useMessageSticker(stickerProps)
```

---

### 5️ **图片预览模态窗口（带缩放）**

**原版实现**：
```vue
<!-- Enhanced Image Preview Modal -->
<Teleport v-if="showImagePreview" to="body">
  <div class="image-preview-overlay" @click="closeImagePreview">
    <div class="image-preview-modal" @click.stop>
      <!-- Header -->
      <div class="preview-header">
        <div class="preview-title">
          <h3>{{ attachmentName }}</h3>
          <span class="preview-meta">{{ formatFileSize(attachmentSize || 0) }}</span>
        </div>
        <div class="preview-actions">
          <button class="preview-btn" @click="downloadFile">
            <DownloadIcon />
          </button>
          <button class="preview-btn close" @click="closeImagePreview">
            <XIcon />
          </button>
        </div>
      </div>

      <!-- Image -->
      <div class="preview-content">
        <img
          :src="attachmentUrl || ''"
          :alt="attachmentName"
          class="preview-image"
          :style="{ transform: `scale(${zoomLevel})` }"
          loading="lazy"
          @wheel="handleZoom"
        >
      </div>

      <!-- Zoom Controls -->
      <div class="preview-controls">
        <button class="zoom-btn" @click="zoomOut">-</button>
        <span class="zoom-level">{{ Math.round(zoomLevel * 100) }}%</span>
        <button class="zoom-btn" @click="zoomIn">+</button>
        <button class="zoom-btn" @click="resetZoom">Reset</button>
      </div>
    </div>
  </div>
</Teleport>
```

**需要的状态和方法**：
```typescript
const showImagePreview = ref(false)
const zoomLevel = ref(1)

const openImagePreview = () => {
  if (actualMessageType.value === 'image') {
    showImagePreview.value = true
    zoomLevel.value = 1
    emit('preview', props.message)
  }
}

const closeImagePreview = () => {
  showImagePreview.value = false
  zoomLevel.value = 1
}

const zoomIn = () => {
  zoomLevel.value = Math.min(zoomLevel.value * 1.2, 3)
}

const zoomOut = () => {
  zoomLevel.value = Math.max(zoomLevel.value / 1.2, 0.5)
}

const resetZoom = () => {
  zoomLevel.value = 1
}

const handleZoom = (event: WheelEvent) => {
  event.preventDefault()
  if (event.deltaY < 0) {
    zoomIn()
  } else {
    zoomOut()
  }
}
```

---

### 6️ **消息操作下拉菜单**

**原版实现**：
```vue
<!-- Message Actions Menu -->
<div
  v-if="showActions || showActionsMenu"
  class="message-actions"
  :class="{ 'actions-outgoing': isOutgoing }"
>
  <button class="action-btn" title="複製" @click="copyMessage">
    <CopyIcon />
  </button>

  <button v-if="!isOutgoing" class="action-btn" title="回覆" @click="replyToMessage">
    <ReplyIcon />
  </button>

  <button class="action-btn" title="更多操作" @click="toggleActionsMenu">
    <MoreVerticalIcon />
  </button>

  <!-- Dropdown Menu -->
  <div v-if="showActionsMenu" class="actions-dropdown" @click.stop>
    <button class="dropdown-item" @click="forwardMessage">
      <ForwardIcon />
      <span>轉發</span>
    </button>

    <button v-if="isOutgoing" class="dropdown-item danger" @click="recallMessage">
      <TrashIcon />
      <span>撤回</span>
    </button>

    <button class="dropdown-item" @click="selectMessage">
      <CheckIcon />
      <span>選擇</span>
    </button>
  </div>
</div>
```

**需要的状态和方法** (来自 useMessageActions)：
```typescript
const {
  showActions,
  showActionsMenu, //  优化版缺失
  handleRightClick,
  toggleActionsMenu, //  优化版缺失
  copyMessage,
  replyToMessage,
  forwardMessage,
  recallMessage,
  selectMessage,
  handleRetry
} = useMessageActions(actionsProps, actionsEmit)
```

---

### 7️ **多文件附件支持**

**原版实现**：
```vue
<!--  FIX: Image Attachments + Non-Image Attachments -->
<div
  v-else-if="imageAttachments.length > 0 || nonImageAttachments.length > 0"
  class="message-attachments-container"
>
  <!-- 圖片附件 -->
  <div
    v-for="attachment in imageAttachments"
    :key="attachment.id"
    class="message-media attachment-image"
  >
    <div class="image-container" @click="handleAttachmentPreview(attachment)">
      <img :src="attachment.fileUrl" :alt="attachment.filename" />
      <div class="image-overlay">
        <div class="image-actions">
          <button class="image-action-btn" title="檢視大圖">
            <SearchIcon />
          </button>
          <button class="image-action-btn" @click.stop="downloadAttachment(attachment)">
            <DownloadIcon />
          </button>
        </div>
      </div>
    </div>
    <!-- 附件狀態指示器 -->
    <div class="attachment-status-indicator" :class="getAttachmentStatusClass(attachment)">
      <!-- Status content -->
    </div>
  </div>

  <!-- 非圖片附件 -->
  <div v-if="nonImageAttachments.length > 0" class="message-file-attachments">
    <div
      v-for="attachment in nonImageAttachments"
      :key="attachment.id"
      class="attachment-wrapper"
    >
      <FileAttachmentCard
        :attachment="attachment"
        :compact="nonImageAttachments.length > 1"
        @preview="handleAttachmentPreview"
      />
      <!-- 附件狀態指示器 -->
    </div>
  </div>
</div>
```

**需要的 Composable 返回值**：
```typescript
const {
  fileAttachments,
  imageAttachments, //  优化版缺失
  nonImageAttachments, //  优化版缺失
  hasMultipleAttachments, //  优化版缺失
  isFileOnlyContent,
  messageStatus,
  downloadFile,
  downloadAttachment, //  优化版缺失
  handleAttachmentPreview, //  优化版缺失
  isAttachmentPending, //  优化版缺失
  getAttachmentStatusClass //  优化版缺失
} = useMessageAttachment(attachmentProps)
```

---

### 8️ **SafeHtmlRenderer 用于文本消息**

**原版实现**：
```vue
<!-- Text Message -->
<SafeHtmlRenderer
  v-else
  :html="processedMessageContent"
  class="message-text"
/>
```

**需要的 Composable**：
```typescript
const contentProps = computed(() => ({ message: props.message }))
const {
  processedMessageContent,
  actualMessageType
} = useMessageContent(contentProps)
```

---

### 9️ **重试失败消息功能**

**原版实现**（在消息状态显示中）：
```vue
<!-- Message Status -->
<div v-if="isOutgoing" class="message-status">
  <template v-if="messageStatus === MESSAGE_STATUS.SENDING">
    <span class="status-sending">
      <div class="spinner-small" />
    </span>
  </template>
  <template v-else-if="messageStatus === MESSAGE_STATUS.FAILED">
    <div class="status-failed-wrapper">
      <span class="status-icon failed"></span>
      <button class="retry-btn" @click="handleRetry">
        重試
      </button>
    </div>
  </template>
  <template v-else-if="delivered">
    <CheckIcon class="status-delivered" />
  </template>
</div>
```

---

##  Phase 1 执行计划

### 任务分解

```
Phase 1.1: 导入依赖补齐 (30 min)
├─ 添加 SafeHtmlRenderer
├─ 添加 FileAttachmentCard
├─ 添加 MESSAGE_STATUS
├─ 添加 5 个 composables
├─ 添加格式化工具
└─ 添加缺失的图标

Phase 1.2: Props 和 Emits 补齐 (15 min)
├─ 添加 uploadProgress, attachmentUrl, attachmentName, attachmentSize
└─ 添加 preview, image-error, retry emits

Phase 1.3: 贴纸消息支持 (1.5 hours)
├─ 添加贴纸模板代码
├─ 集成 useMessageSticker composable
├─ 添加贴纸样式（~200 lines CSS）
└─ 测试贴纸显示

Phase 1.4: 图片预览模态窗口 (2 hours)
├─ 添加预览模态窗口模板
├─ 添加缩放相关状态和方法
├─ 添加预览样式（~400 lines CSS）
└─ 测试缩放功能

Phase 1.5: 消息操作下拉菜单 (1 hour)
├─ 添加下拉菜单模板
├─ 集成 useMessageActions 的 showActionsMenu
├─ 添加下拉菜单样式（~100 lines CSS）
└─ 测试菜单功能

Phase 1.6: 多文件附件支持 (1.5 hours)
├─ 添加多附件模板代码
├─ 集成 FileAttachmentCard
├─ 添加附件状态指示器
├─ 添加附件样式（~200 lines CSS）
└─ 测试多附件显示

Phase 1.7: SafeHtmlRenderer 文本消息 (30 min)
├─ 替换纯文本为 SafeHtmlRenderer
├─ 集成 useMessageContent composable
└─ 测试链接识别等功能

Phase 1.8: 重试失败消息 (30 min)
├─ 添加重试按钮到消息状态
├─ 集成 handleRetry 方法
└─ 测试重试功能

Phase 1.9: 所有 Composables 集成 (1 hour)
├─ useMessageTime
├─ useMessageAttachment
├─ useMessageActions
├─ useMessageSticker
├─ useMessageContent
└─ 验证所有返回值正确使用

Phase 1.10: CSS 整合 (30 min)
├─ 确保所有样式都已添加
├─ 保留性能优化（contain, GPU 加速）
└─ 验证响应式样式
```

**总时间估计**: **8-10 hours (约 1.5 天)**

---

##  验证清单

完成 Phase 1 后，需要验证：

### 功能验证
- [ ] 所有消息类型都能正确显示（文本、图片、文件、贴纸）
- [ ] 单个文件附件正确显示
- [ ] 多个文件附件正确显示
- [ ] 图片预览模态窗口正常工作
- [ ] 图片缩放功能正常（滚轮、按钮）
- [ ] 消息操作菜单正常工作（下拉菜单）
- [ ] 贴纸消息正确显示（包括加载和错误状态）
- [ ] 重试失败消息功能正常
- [ ] SafeHtmlRenderer 正确渲染链接等

### Props 和 Emits 验证
- [ ] 所有 props 都能正确接收
- [ ] 所有 emits 都能正确触发
- [ ] uploadProgress 正确显示上传进度
- [ ] attachmentUrl, attachmentName, attachmentSize 正确传递

### Composables 验证
- [ ] useMessageTime 正确格式化时间
- [ ] useMessageAttachment 正确处理附件
- [ ] useMessageActions 正确处理操作
- [ ] useMessageSticker 正确处理贴纸
- [ ] useMessageContent 正确处理内容

### 性能优化保留
- [ ] v-memo 仍然生效
- [ ] Lazy Loading Icons 仍然生效
- [ ] 时间格式化缓存仍然生效
- [ ] CSS contain 仍然生效
- [ ] GPU 加速仍然生效

---

**文档状态**:  对比完成，准备开始 Phase 1
**预计完成时间**: 8-10 hours (约 1.5 天)
**下一步**: 开始 Phase 1.1 - 导入依赖补齐
