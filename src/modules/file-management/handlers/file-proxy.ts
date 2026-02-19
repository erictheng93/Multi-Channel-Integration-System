// 公開文件下載代理
// 用於代理 R2 文件下載，解決 R2 公開訪問問題
// 路徑: /api/files/public/*

import { Hono } from 'hono';
import { HTTP_STATUS } from '@/constants/http-status';
import { globalErrorHandler } from '@/core/error-handler';
import type { Bindings } from '@/types';
import { createDbClient } from '@/db/drizzle-factory';
import { fileAttachments } from '@/db/schema';
import { eq } from 'drizzle-orm';

const fileProxyHandler = new Hono<{ Bindings: Bindings }>();

/**
 * 公開文件下載代理 - 無需認證
 * 用於客服前端和 LINE 消費者下載文件
 *
 * 路由: GET /api/files/public/:r2Path
 * 例如: /api/files/public/attachments/conv-id/pending/filename.pdf
 */
fileProxyHandler.get('/public/*', async (c) => {
  try {
    // 獲取完整的 R2 路徑 (去掉 /public/ 前綴)
    const fullPath = c.req.path;
    const r2Key = fullPath.replace(/^\/api\/files\/public\//, '');

    console.log(`[File Proxy] Downloading file: ${r2Key}`);

    if (!r2Key || r2Key === 'public') {
      return c.json({ success: false, error: 'File path is required' }, HTTP_STATUS.BAD_REQUEST);
    }

    // 從 R2 獲取文件
    if (!c.env.R2_BUCKET) {
      console.error('[File Proxy] R2_BUCKET not configured');
      return c.json({ success: false, error: 'Storage not configured' }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    const object = await c.env.R2_BUCKET.get(r2Key);

    if (!object) {
      console.warn(`[File Proxy] File not found in R2: ${r2Key}`);
      return c.json({ success: false, error: 'File not found' }, HTTP_STATUS.NOT_FOUND);
    }

    // 從 R2 object 獲取元數據
    const contentType = object.httpMetadata?.contentType || 'application/octet-stream';
    const contentDisposition = object.httpMetadata?.contentDisposition ||
      `attachment; filename="${r2Key.split('/').pop() || 'download'}"`;

    console.log(`[File Proxy] Serving file: ${r2Key}, type: ${contentType}, size: ${object.size}`);

    // 返回文件流
    return new Response(object.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': object.size.toString(),
        'Content-Disposition': contentDisposition,
        'Cache-Control': 'public, max-age=86400', // 緩存 24 小時
        'Access-Control-Allow-Origin': '*', // 允許跨域訪問
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * 通過附件 ID 下載文件 - 無需認證
 * 從數據庫查找 r2Key 然後代理下載
 *
 * 路由: GET /api/files/download/:attachmentId
 */
fileProxyHandler.get('/download/:attachmentId', async (c) => {
  try {
    const attachmentId = c.req.param('attachmentId');

    if (!attachmentId) {
      return c.json({ success: false, error: 'Attachment ID is required' }, HTTP_STATUS.BAD_REQUEST);
    }

    console.log(`[File Proxy] Looking up attachment: ${attachmentId}`);

    // 從數據庫獲取附件信息
    const db = createDbClient(c.env.DB);
    const attachment = await db.select()
      .from(fileAttachments)
      .where(eq(fileAttachments.id, attachmentId))
      .get();

    if (!attachment) {
      console.warn(`[File Proxy] Attachment not found in DB: ${attachmentId}`);
      return c.json({ success: false, error: 'Attachment not found' }, HTTP_STATUS.NOT_FOUND);
    }

    const r2Key = attachment.r2Key;

    if (!r2Key) {
      console.warn(`[File Proxy] No R2 key for attachment: ${attachmentId}`);
      return c.json({ success: false, error: 'File storage key not found' }, HTTP_STATUS.NOT_FOUND);
    }

    // 從 R2 獲取文件
    if (!c.env.R2_BUCKET) {
      console.error('[File Proxy] R2_BUCKET not configured');
      return c.json({ success: false, error: 'Storage not configured' }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    const object = await c.env.R2_BUCKET.get(r2Key);

    if (!object) {
      console.warn(`[File Proxy] File not found in R2: ${r2Key}`);
      return c.json({ success: false, error: 'File not found in storage' }, HTTP_STATUS.NOT_FOUND);
    }

    // 從附件記錄獲取元數據
    const contentType = attachment.mimeType || 'application/octet-stream';
    const filename = attachment.filename || r2Key.split('/').pop() || 'download';

    console.log(`[File Proxy] Serving attachment: ${attachmentId}, file: ${filename}, type: ${contentType}`);

    // 返回文件流
    return new Response(object.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': object.size.toString(),
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    return globalErrorHandler.handleError(c, error);
  }
});

/**
 * CORS 預檢請求處理
 */
fileProxyHandler.options('/public/*', (_c) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
});

fileProxyHandler.options('/download/:attachmentId', (_c) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
});

export default fileProxyHandler;
