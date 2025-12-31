/**
 * 批量生成 LIFF QR Code 脚本
 *
 * 功能：为所有没有 LIFF QR Code 的团队自动生成
 *
 * 使用方法：
 * npx tsx scripts/generate-liff-qr-for-all-teams.ts
 */

import { createDbClient } from '../src/db/drizzle-factory';
import { teams, teamLiffQrCodes } from '../src/db/schema';
import { eq, isNull } from 'drizzle-orm';
import { generateTeamQRCode } from '../src/services/liff-qrcode-service';
import type { Bindings } from '../src/types';

// 模拟 Bindings 环境（从环境变量读取）
const env: Bindings = {
  DB: null as any, // 将在运行时设置
  CACHE: null as any,
  R2_BUCKET: null as any,
  LINE_LIFF_ID: process.env.LINE_LIFF_ID || '',
  R2_PUBLIC_URL: process.env.R2_PUBLIC_URL || '',
  LINE_BOT_ID: process.env.LINE_BOT_ID || '',
  LINE_CHANNEL_SECRET: process.env.LINE_CHANNEL_SECRET || '',
  LINE_CHANNEL_ACCESS_TOKEN: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  JWT_SECRET: process.env.JWT_SECRET || '',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '',

  // Durable Objects bindings (not used in this script)
  CONVERSATION_ROOM: null as any,
  USER_CONNECTION: null as any,
  MESSAGE_BROADCASTER: null as any,
  DELAYED_MESSAGE_PROCESSOR: null as any,
  DELAYED_MESSAGE_BUFFER: null as any,

  // Queue binding (not used in this script)
  MESSAGE_QUEUE: null as any,
};

async function generateLiffQRForAllTeams() {
  console.log('🚀 开始批量生成 LIFF QR Code...\n');

  // 检查必需的环境变量
  const requiredEnvVars = ['LINE_LIFF_ID', 'R2_PUBLIC_URL'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ 缺少必需的环境变量：', missingVars.join(', '));
    console.error('\n请在 .env 或 wrangler.toml 中配置以下变量：');
    missingVars.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    process.exit(1);
  }

  console.log('✅ 环境变量检查通过');
  console.log(`   LINE_LIFF_ID: ${env.LINE_LIFF_ID}`);
  console.log(`   R2_PUBLIC_URL: ${env.R2_PUBLIC_URL}\n`);

  try {
    // 注意：这个脚本需要在 Cloudflare Workers 环境中运行
    // 或者需要提供 D1 和 R2 的本地访问方式
    console.log('⚠️  注意：此脚本需要在 Cloudflare Workers 环境中运行');
    console.log('   建议使用 wrangler 命令执行：');
    console.log('   wrangler tail --env production\n');

    // 以下代码仅作示例，实际需要在 Worker 环境中执行
    console.log('📋 建议的执行步骤：');
    console.log('   1. 将此逻辑添加到一个临时的 Worker endpoint');
    console.log('   2. 部署 Worker');
    console.log('   3. 通过 HTTP 请求触发该 endpoint');
    console.log('   4. 完成后删除该 endpoint\n');

    // 示例代码（需要在 Worker 中执行）
    console.log('📝 Worker endpoint 示例代码：');
    console.log(`
// 在 src/index.ts 中添加临时 endpoint
app.get('/admin/generate-all-liff-qr', jwtAuth, requireAdmin(), async (c) => {
  const db = createDbClient(c.env.DB);

  // 查找所有团队
  const allTeams = await db.select().from(teams).where(eq(teams.isActive, true)).all();

  // 查找已有 LIFF QR Code 的团队
  const existingLiffQRs = await db.select().from(teamLiffQrCodes).all();
  const teamsWithLiffQR = new Set(existingLiffQRs.map(qr => qr.teamId));

  // 筛选出没有 LIFF QR Code 的团队
  const teamsWithoutLiffQR = allTeams.filter(team => !teamsWithLiffQR.has(team.id));

  console.log(\`找到 \${allTeams.length} 个团队\`);
  console.log(\`其中 \${teamsWithLiffQR.size} 个已有 LIFF QR Code\`);
  console.log(\`需要生成 \${teamsWithoutLiffQR.length} 个 LIFF QR Code\`);

  const results = {
    total: teamsWithoutLiffQR.length,
    success: 0,
    failed: 0,
    errors: [] as Array<{teamId: number; teamName: string; error: string}>
  };

  // 批量生成 LIFF QR Code
  for (const team of teamsWithoutLiffQR) {
    try {
      const result = await generateTeamQRCode(team.id, team.name, c.env);

      if (result.success) {
        results.success++;
        console.log(\`✅ 团队 \${team.name} (ID: \${team.id}) LIFF QR Code 生成成功\`);
      } else {
        results.failed++;
        results.errors.push({
          teamId: team.id,
          teamName: team.name,
          error: result.error || 'Unknown error'
        });
        console.error(\`❌ 团队 \${team.name} (ID: \${team.id}) 生成失败: \${result.error}\`);
      }
    } catch (error) {
      results.failed++;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      results.errors.push({
        teamId: team.id,
        teamName: team.name,
        error: errorMsg
      });
      console.error(\`❌ 团队 \${team.name} (ID: \${team.id}) 生成异常: \${errorMsg}\`);
    }
  }

  return c.json({
    success: true,
    data: results,
    timestamp: new Date().toISOString()
  });
});
`);

  } catch (error) {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  }
}

// 运行脚本
generateLiffQRForAllTeams().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
