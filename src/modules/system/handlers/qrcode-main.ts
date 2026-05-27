// QR Code 處理器 - 主要實現
import { Hono } from 'hono';
import { html } from 'hono/html';
import { createContextLogger } from '@/utils/logger'

const log = createContextLogger('QrcodeMain')

import type { Bindings } from '@/types';
import { QRCodeServiceImpl as QRCodeService } from '@/services/qrcode-service-impl';
import { getTeamByQRCode } from '@/utils/team';
import { createDbClient } from '@/db/drizzle-factory';
import { jwtAuth } from '@/middleware/auth';
import { handleApiError } from '@/utils/api-response';
import { nowISO } from '@/utils/timestamp'

const qrcodeHandler = new Hono<{ Bindings: Bindings }>();

// 停用 QR Code
qrcodeHandler.delete('/:token', jwtAuth, async (c) => {
  try {
    const token = c.req.param('token')!;
    await QRCodeService.deactivateQRCode(createDbClient(c.env.DB), token);

    return c.json({
      success: true,
      message: 'QR Code deactivated successfully',
      timestamp: nowISO()
    });

  } catch (error) {
    log.error('Operation failed', {}, error as Error);
    return handleApiError(error, c);
  }
});

// QR Code 加入團隊頁面
qrcodeHandler.get('/join', async (c) => {
  try {
    const teamQRCode = c.req.query('team');

    if (!teamQRCode) {
      return c.html(`
        <html>
          <head><title>加入團隊</title></head>
          <body>
            <h1>無效的邀請連結</h1>
            <p>請檢查您的邀請連結是否正確。</p>
          </body>
        </html>
      `);
    }

    const team = await getTeamByQRCode(c.env.DB, teamQRCode);

    if (!team) {
      return c.html(`
        <html>
          <head><title>加入團隊</title></head>
          <body>
            <h1>邀請連結已過期</h1>
            <p>此邀請連結無效或已過期，請聯繫團隊管理員獲取新的邀請連結。</p>
          </body>
        </html>
      `);
    }

    // F16: escape team.name / team.description via Hono's `html` tag. See
    // src/index.ts:687 for the rationale — this duplicate handler is the
    // route actually mounted in some deploys, so both must be patched.
    return c.html(html`
      <html>
        <head>
          <title>加入 ${team.name}</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .team-info { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .btn { background: #007bff; color: white; padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; }
            .btn:hover { background: #0056b3; }
          </style>
        </head>
        <body>
          <h1>加入團隊邀請</h1>
          <div class="team-info">
            <h2>${team.name}</h2>
            ${team.description ? html`<p>${team.description}</p>` : ''}
            <p><strong>團隊 ID:</strong> ${team.id}</p>
          </div>
          <p>您被邀請加入此團隊。請聯繫系統管理員完成帳戶設置。</p>
          <a href="/" class="btn">返回首頁</a>
        </body>
      </html>
    `);

  } catch (error) {
    log.error('Join team page error', {}, error as Error);
    return c.html(`
      <html>
        <head><title>錯誤</title></head>
        <body>
          <h1>發生錯誤</h1>
          <p>處理邀請連結時發生錯誤，請稍後再試。</p>
        </body>
      </html>
    `);
  }
});

export default qrcodeHandler;
