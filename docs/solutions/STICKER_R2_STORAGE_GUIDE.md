# LINE 貼圖存入 R2 實作指南

> ⚠️ **警告**: 此方案會增加儲存和頻寬成本,僅在必要時使用

## 概述

本指南說明如何修改系統,將 LINE 貼圖下載並存儲到 Cloudflare R2,而不是直接從 LINE CDN 加載。

## 成本估算

基於平均使用量 (每月 1000 個貼圖):

| 項目           | 估算成本  |
| -------------- | --------- |
| R2 儲存        | $0.50     |
| R2 頻寬        | $1.50     |
| 處理時間       | $0.20     |
| **總計**       | **$2.20** |

## 實作步驟

### Step 1: 修改 Backend Webhook 處理

**檔案:** `src/handlers/webhook.ts`

```typescript
// Line 655-689: 修改條件判斷
// 修改前:
if (mediaData && message.type !== 'location' && message.type !== 'sticker') {

// 修改後:
if (mediaData && message.type !== 'location') {
  // 移除 && message.type !== 'sticker'
  // 現在貼圖也會被處理

  try {
    const { processLineMediaMessage } = await import('../utils/file-storage');
    const mediaFile = await processLineMediaMessage(
      env,
      message.id,
      message.type,  // 'sticker'
      message.fileName || 'sticker.png'
    );
    // ... 存儲到 fileAttachments 表
  }
}
```

### Step 2: 增強 processLineMediaMessage 函數

**檔案:** `src/utils/file-storage.ts`

```typescript
export async function processLineMediaMessage(
  env: Bindings,
  messageId: string,
  messageType: string,
  fileName?: string
): Promise<MediaFile | null> {
  try {
    let contentUrl: string;
    let mimeType: string;

    // 處理貼圖類型
    if (messageType === 'sticker') {
      // 從 LINE Content API 下載貼圖
      contentUrl = `https://api.line.me/v2/bot/message/${messageId}/content`;
      mimeType = 'image/png';
      fileName = fileName || `sticker_${messageId}.png`;
    } else {
      // 原有的圖片/影片/音訊處理邏輯
      contentUrl = `https://api.line.me/v2/bot/message/${messageId}/content`;
      mimeType = getMimeType(messageType);
    }

    // 下載文件
    const response = await fetch(contentUrl, {
      headers: {
        'Authorization': `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`
      }
    });

    if (!response.ok) {
      console.error(`Failed to download ${messageType}:`, response.status);
      return null;
    }

    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();

    // 存儲到 R2
    const r2Key = `line-media/${messageType}/${messageId}/${fileName}`;
    await env.R2_BUCKET.put(r2Key, buffer, {
      httpMetadata: {
        contentType: mimeType
      }
    });

    // 返回文件資訊
    return {
      id: uuidv4(),
      filename: fileName,
      mimeType: mimeType,
      size: buffer.byteLength,
      url: r2Key,
      originalUrl: contentUrl
    };

  } catch (error) {
    console.error(`Error processing LINE ${messageType}:`, error);
    return null;
  }
}

function getMimeType(messageType: string): string {
  const mimeTypes: Record<string, string> = {
    'image': 'image/jpeg',
    'video': 'video/mp4',
    'audio': 'audio/mp4',
    'file': 'application/octet-stream',
    'sticker': 'image/png'
  };
  return mimeTypes[messageType] || 'application/octet-stream';
}
```

### Step 3: 修改前端渲染邏輯

**檔案:** `frontend/src/components/conversation/MessageBubble.vue`

```typescript
// Line 566-595: 修改 stickerMetadata computed
const stickerMetadata = computed(() => {
  if (props.message.messageType !== 'sticker') {
    return null;
  }

  // 優先使用 fileAttachments 中的 R2 URL
  if (props.message.metadata?.attachment?.url) {
    return {
      type: 'r2',
      url: props.message.metadata.attachment.url
    };
  }

  // 回退到 LINE CDN
  if (props.message.metadata) {
    try {
      const metadata = typeof props.message.metadata === 'string'
        ? JSON.parse(props.message.metadata)
        : props.message.metadata;

      return {
        type: 'line-cdn',
        packageId: metadata.packageId,
        stickerId: metadata.stickerId
      };
    } catch (error) {
      console.error('Failed to parse sticker metadata:', error);
      return null;
    }
  }

  return null;
});

// 修改 stickerImageUrl computed
const stickerImageUrl = computed(() => {
  if (!stickerMetadata.value) {
    return null;
  }

  // R2 URL (新增)
  if (stickerMetadata.value.type === 'r2') {
    return `/api/files/${stickerMetadata.value.url}`;
  }

  // LINE CDN URL (原有邏輯)
  if (stickerMetadata.value.type === 'line-cdn') {
    const { packageId, stickerId } = stickerMetadata.value;
    return stickerUrls.value[currentStickerUrlIndex.value];
  }

  return null;
});
```

### Step 4: 添加 R2 文件訪問 API

**檔案:** `src/handlers/file-access.ts` (新建)

```typescript
import { Hono } from 'hono';
import type { Bindings } from '../types';

const fileAccessRouter = new Hono<{ Bindings: Bindings }>();

// 公開訪問 R2 文件
fileAccessRouter.get('/api/files/:key{.+}', async (c) => {
  const key = c.req.param('key');

  try {
    const object = await c.env.R2_BUCKET.get(key);

    if (!object) {
      return c.notFound();
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('Cache-Control', 'public, max-age=31536000'); // 1 year cache

    return new Response(object.body, {
      headers
    });
  } catch (error) {
    console.error('Error fetching R2 file:', error);
    return c.text('Internal Server Error', 500);
  }
});

export default fileAccessRouter;
```

**註冊路由:** `src/index.ts`

```typescript
import fileAccessRouter from './handlers/file-access';

// ...
app.route('/api/files', fileAccessRouter);
```

## 測試驗證

### 1. 測試貼圖下載

```bash
# 發送測試貼圖到 LINE OA
# 檢查後端日誌確認下載成功

npx wrangler tail --format pretty
```

### 2. 驗證 R2 儲存

```bash
# 列出 R2 Bucket 中的貼圖文件
npx wrangler r2 object list multi-channel-crm-files --prefix=line-media/sticker/
```

### 3. 測試前端顯示

```bash
# 訪問對話頁面
# 開啟開發者工具查看 Network 請求
# 確認貼圖從 /api/files/* 加載
```

## 回滾計畫

如果需要回滾到 LINE CDN 方案:

1. 恢復 `webhook.ts` 第 656 行的條件判斷
2. 移除 `file-access.ts` 路由註冊
3. 恢復 `MessageBubble.vue` 的 stickerMetadata 邏輯

## 優缺點總結

### 優點
- ✅ 完全自主控制貼圖資源
- ✅ 可離線訪問 (如果部署在內網)
- ✅ 不依賴 LINE CDN 可用性

### 缺點
- ❌ 增加儲存成本 (每月 $2-5)
- ❌ 增加頻寬成本 (每月 $1-3)
- ❌ 增加系統複雜度
- ❌ 需要維護額外的文件訪問 API
- ❌ 下載貼圖需要時間 (webhook 處理變慢)

## 建議

**不推薦實施此方案**,除非:
1. 您的系統部署在內網環境,無法訪問 LINE CDN
2. 需要確保貼圖永久可用 (即使 LINE 下架貼圖包)
3. 有合規要求必須自行儲存所有媒體資源

對於大多數使用場景,**當前的 LINE CDN 方案已經足夠且更經濟**。
