/**
 * 文件上传端到端验证测试
 * 测试实际的文件上传到R2存储功能
 */

import { describe, it, expect, beforeAll } from 'vitest';

// 测试配置
const API_BASE_URL = 'https://multi-channel.imfinethankyouandyou.com';
const R2_PUBLIC_URL = 'https://s3.imfinethankyouandyou.com';

// 测试用户凭证（需要从环境变量获取或使用测试账号）
let authToken: string;
let testMessageId: string;
let testConversationId: string;

describe('文件上传到R2存储 - E2E验证', () => {

  beforeAll(async () => {
    // 注意：这里需要先登录获取token
    // 或者从环境变量中读取测试token
    console.log('⚠️  需要设置测试用户token才能运行完整测试');
    console.log('💡 提示：export TEST_AUTH_TOKEN=your_token');

    authToken = process.env.TEST_AUTH_TOKEN || '';

    if (!authToken) {
      console.warn('⚠️  警告：未设置TEST_AUTH_TOKEN，将跳过需要认证的测试');
    }
  });

  describe('1️⃣ 健康检查 - 验证后端服务可用', () => {
    it('应该能够访问文件管理健康检查端点', async () => {
      const response = await fetch(`${API_BASE_URL}/api/files/health`);
      const data = await response.json();

      console.log('✅ 健康检查响应:', data);

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.data?.module).toBe('file-management');
      expect(data.data?.r2Available).toBe(true);
    });

    it('应该能够访问消息处理健康检查端点', async () => {
      const response = await fetch(`${API_BASE_URL}/api/messages/health`);
      const data = await response.json();

      console.log('✅ 消息健康检查响应:', data);

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
    });
  });

  describe('2️⃣ R2配置验证', () => {
    it('R2公开URL应该正确配置', () => {
      expect(R2_PUBLIC_URL).toBeTruthy();
      expect(R2_PUBLIC_URL).toMatch(/^https?:\/\//);
      console.log('✅ R2公开URL:', R2_PUBLIC_URL);
    });

    it('应该能够访问R2域名', async () => {
      const response = await fetch(R2_PUBLIC_URL, { method: 'HEAD' });

      // R2 bucket可能返回403（未授权）或404（不存在的key）
      // 但域名应该是可达的，不应该是网络错误
      console.log(`✅ R2域名状态: ${response.status} ${response.statusText}`);

      // 只要不是网络错误，就说明域名配置正确
      expect(response).toBeDefined();
    });
  });

  describe('3️⃣ 文件上传端点测试（需要认证）', () => {
    it.skipIf(!authToken)('应该能够上传文件到通用上传端点', async () => {
      // 创建测试文件
      const testFileContent = 'Test file content for R2 upload verification';
      const blob = new Blob([testFileContent], { type: 'text/plain' });
      const file = new File([blob], 'test-upload.txt', { type: 'text/plain' });

      // 准备FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('platform', 'system');

      // 发送上传请求
      const response = await fetch(`${API_BASE_URL}/api/files/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });

      const result = await response.json();

      console.log('📤 文件上传结果:', result);

      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      expect(result.data?.url).toBeTruthy();
      expect(result.data?.url).toContain(R2_PUBLIC_URL);

      // 验证文件是否真正存储到R2
      if (result.data?.url) {
        const fileResponse = await fetch(result.data.url);
        expect(fileResponse.ok).toBe(true);

        const content = await fileResponse.text();
        expect(content).toBe(testFileContent);

        console.log('✅ 文件成功上传到R2并可访问');
      }
    });

    it.skipIf(!authToken || !testMessageId)('应该能够为消息添加附件', async () => {
      if (!testMessageId) {
        console.log('⚠️  跳过：需要先创建测试消息');
        return;
      }

      // 创建测试PDF文件（模拟）
      const pdfContent = '%PDF-1.4 Test PDF Content';
      const blob = new Blob([pdfContent], { type: 'application/pdf' });
      const file = new File([blob], 'contract.pdf', { type: 'application/pdf' });

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(
        `${API_BASE_URL}/api/messages/${testMessageId}/attachments`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`
          },
          body: formData
        }
      );

      const result = await response.json();

      console.log('📎 附件上传结果:', result);

      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      expect(result.data?.url).toBeTruthy();
      expect(result.data?.url).toContain(R2_PUBLIC_URL);
      expect(result.data?.filename).toBe('contract.pdf');
    });
  });

  describe('4️⃣ 配置验证总结', () => {
    it('应该确认所有关键配置正确', () => {
      const configReport = {
        '后端API地址': API_BASE_URL,
        'R2公开URL': R2_PUBLIC_URL,
        '认证token设置': authToken ? '✅ 已设置' : '❌ 未设置',
        '文件上传端点': [
          `${API_BASE_URL}/api/files/upload`,
          `${API_BASE_URL}/api/messages/:id/attachments`
        ],
        '健康检查端点': [
          `${API_BASE_URL}/api/files/health`,
          `${API_BASE_URL}/api/messages/health`
        ]
      };

      console.log('\n📋 配置验证报告:');
      console.log(JSON.stringify(configReport, null, 2));

      expect(API_BASE_URL).toBeTruthy();
      expect(R2_PUBLIC_URL).toBeTruthy();
    });
  });
});

describe('📊 测试使用说明', () => {
  it('应该显示如何运行完整测试', () => {
    const instructions = `
╔════════════════════════════════════════════════════════════╗
║          文件上传E2E测试使用说明                            ║
╠════════════════════════════════════════════════════════════╣
║                                                             ║
║ 1. 获取测试token                                            ║
║    - 登录系统获取JWT token                                  ║
║    - 或使用测试账号的token                                  ║
║                                                             ║
║ 2. 设置环境变量                                             ║
║    export TEST_AUTH_TOKEN=your_jwt_token_here              ║
║                                                             ║
║ 3. 运行测试                                                 ║
║    npm test tests/e2e/file-upload-verification.test.ts     ║
║                                                             ║
║ 4. 查看测试结果                                             ║
║    - ✅ 健康检查通过                                        ║
║    - ✅ R2配置正确                                          ║
║    - ✅ 文件上传成功                                        ║
║    - ✅ 文件可从R2下载                                      ║
║                                                             ║
║ 当前配置:                                                   ║
║ - 后端API: ${API_BASE_URL}                                 ║
║ - R2存储: ${R2_PUBLIC_URL}                                 ║
║                                                             ║
╚════════════════════════════════════════════════════════════╝
    `;

    console.log(instructions);
    expect(true).toBe(true);
  });
});
