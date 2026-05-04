# LIFF QR Code 迁移和使用指南

##  目录

1. [按钮功能分析](#按钮功能分析)
2. [自动生成机制](#自动生成机制)
3. [批量生成指南](#批量生成指南)
4. [环境变量配置](#环境变量配置)
5. [故障排除](#故障排除)

---

##  按钮功能分析

### "生成 QR Code"按钮在哪里？

**位置**：`frontend/src/components/team/TeamCard.vue` 第 289-296 行

```vue
<button
  v-if="!currentQRCode && !loadingQRCode"
  class="btn btn-sm btn-primary"
  :disabled="generatingQR"
  @click="handleGenerateQR"
>
  {{ generatingQR ? '生成中...' : '+ 生成 QR Code' }}
</button>
```

### 按钮的存在意义

####  **应该保留此按钮**，原因如下：

| 场景 | 说明 | 是否需要按钮 |
|------|------|------------|
| **新创建的团队** | 创建时自动生成 LIFF QR Code |  不需要（已自动生成） |
| **迁移前创建的团队** | 没有 LIFF QR Code |  **需要**（手动生成） |
| **QR Code 损坏/失效** | 需要重新生成 |  **需要**（重新生成） |
| **环境变量未配置** | 创建时自动生成失败 |  **需要**（补救措施） |

####  **按钮的两个用途**：

1. **首次生成**：为迁移前创建的团队生成 LIFF QR Code
2. **重新生成**：如果 QR Code 有问题，可以重新生成（会显示确认对话框）

### 按钮点击报错的原因

用户点击按钮时报错，可能的原因：

#### 1. **环境变量未配置** 
   - `LINE_LIFF_ID` 未设置
   - `R2_BUCKET` 未配置
   - `R2_PUBLIC_URL` 未设置

#### 2. **R2 存储桶权限问题** 
   - R2 Bucket 不存在
   - 权限不足，无法上传文件

#### 3. **LIFF 应用未创建** 
   - LINE LIFF 应用未在 LINE Developers 中创建

---

##  自动生成机制

### 当前实现状态

 **系统已实现自动生成 LIFF QR Code**

**位置**：`src/modules/teams/handlers/team.ts` 第 1034-1039 行

```typescript
// Task 3: Generate LIFF QR code (NEW - LIFF Team QR Code System)
generateTeamQRCode(team.id, team.name, c.env).catch(err => {
  // LIFF QR generation failure should not fail team creation
  console.error(`[LIFF QR] Generation failed for team ${team.id}:`, err);
  return { success: false, error: err.message };
})
```

### 自动生成流程

```
创建团队
   │
   ├─→ Task 1: 记录活动日志
   ├─→ Task 2: 生成传统 QR Code（待移除）
   └─→ Task 3: 生成 LIFF QR Code 
          │
          ├─→ 生成 LIFF URL（https://liff.line.me/{LIFF_ID}?team={teamId}）
          ├─→ 生成 QR Code 图片（512x512 PNG）
          ├─→ 上传到 R2 存储桶
          └─→ 保存到数据库（team_liff_qr_codes 表）
```

### 为什么旧团队没有 LIFF QR Code？

- **原因**：旧团队在添加 LIFF QR Code 系统**之前**创建
- **解决方案**：使用批量生成功能为所有旧团队补充 LIFF QR Code

---

##  批量生成指南

### 方法 1：使用管理员 API（推荐）

我已经为你创建了专门的管理员 API endpoint。

#### Step 1: 检查当前状态

```bash
# 查看有多少团队已有/没有 LIFF QR Code
curl -X GET https://your-domain.com/api/admin/liff-qr/status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "totalTeams": 10,
    "teamsWithLiffQR": 3,
    "teamsWithoutLiffQR": 7,
    "coverage": "30.00%",
    "teams": [
      {"id": 1, "name": "客服一组", "hasLiffQR": true},
      {"id": 2, "name": "客服二组", "hasLiffQR": false},
      ...
    ]
  }
}
```

#### Step 2: 批量生成 LIFF QR Code

```bash
# 为所有没有 LIFF QR Code 的团队批量生成
curl -X POST https://your-domain.com/api/admin/liff-qr/batch-generate \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "total": 7,
    "success": 6,
    "failed": 1,
    "errors": [
      {
        "teamId": 5,
        "teamName": "客服五组",
        "error": "LINE_LIFF_ID not configured"
      }
    ]
  }
}
```

### 方法 2：使用前端按钮（手动）

如果团队数量不多，可以逐个点击"+ 生成 QR Code"按钮：

1. 打开团队管理页面
2. 找到显示"尚未生成 QR Code"的团队卡片
3. 点击"+ 生成 QR Code"按钮
4. 等待生成完成

---

##  环境变量配置

### 必需的环境变量

在 `wrangler.toml` 中配置以下环境变量：

```toml
[vars]
# LINE LIFF 应用 ID（必需）
LINE_LIFF_ID = "1234567890-abcdefgh"

# R2 公开 URL（必需）
R2_PUBLIC_URL = "https://your-r2-bucket.r2.cloudflarestorage.com"

# LINE Bot ID（可选，用于传统 QR Code）
LINE_BOT_ID = "@your-bot-id"

# 前端 URL（可选）
FRONTEND_URL = "https://your-domain.com"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "your-bucket-name"
```

### 如何获取 LINE_LIFF_ID？

1. 登录 [LINE Developers Console](https://developers.line.biz/)
2. 选择你的 Provider
3. 选择或创建一个 LIFF 应用
4. 复制 **LIFF ID**（格式：`1234567890-abcdefgh`）
5. 确保 LIFF 应用的 **Endpoint URL** 指向你的前端域名

### 如何配置 R2 存储桶？

```bash
# 1. 创建 R2 存储桶
wrangler r2 bucket create your-bucket-name

# 2. 配置公开访问（如果需要）
wrangler r2 bucket public-access enable your-bucket-name

# 3. 获取公开 URL
# 格式：https://your-account-id.r2.cloudflarestorage.com
```

---

##  故障排除

### 问题 1："生成 QR Code"按钮点击无反应或报错

**可能原因**：
- LINE_LIFF_ID 未配置
- R2_BUCKET 未配置
- R2 存储桶权限不足

**解决方案**：
1. 检查环境变量配置（见上文）
2. 查看浏览器控制台错误信息
3. 查看 Worker 日志：`wrangler tail --env production`

### 问题 2：批量生成 API 报错

**错误示例**：
```json
{
  "teamId": 3,
  "teamName": "客服三组",
  "error": "LINE_LIFF_ID not configured"
}
```

**解决方案**：
1. 确认 `wrangler.toml` 中配置了 `LINE_LIFF_ID`
2. 重新部署 Worker：`npm run deploy`
3. 再次执行批量生成

### 问题 3：QR Code 图片无法显示

**可能原因**：
- R2_PUBLIC_URL 配置错误
- R2 存储桶未设置公开访问

**解决方案**：
```bash
# 1. 检查 R2 公开访问设置
wrangler r2 bucket public-access status your-bucket-name

# 2. 如果未启用，启用公开访问
wrangler r2 bucket public-access enable your-bucket-name

# 3. 验证 URL 格式
# 正确格式：https://your-account-id.r2.cloudflarestorage.com/qr-codes/team-1-123456.png
```

### 问题 4：旧团队没有"+ 生成 QR Code"按钮

**原因**：
- 团队已经有 LIFF QR Code

**验证方法**：
```bash
# 检查团队状态
curl -X GET https://your-domain.com/api/admin/liff-qr/status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

##  部署步骤

### 1. 更新代码

```bash
# 确保所有更改已保存
git status
```

### 2. 配置环境变量

编辑 `wrangler.toml`，添加：
```toml
[vars]
LINE_LIFF_ID = "YOUR_LIFF_ID"
R2_PUBLIC_URL = "https://your-account.r2.cloudflarestorage.com"
```

### 3. 部署到生产环境

```bash
# 部署 Worker
npm run deploy
```

### 4. 批量生成 LIFF QR Code

```bash
# 方法 A：使用 curl（推荐）
curl -X POST https://your-domain.com/api/admin/liff-qr/batch-generate \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 方法 B：使用浏览器
# 访问：https://your-domain.com
# 登录管理员账号
# 打开浏览器控制台执行：
fetch('/api/admin/liff-qr/batch-generate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('authToken')
  }
}).then(r => r.json()).then(console.log)
```

### 5. 验证结果

```bash
# 检查生成状态
curl -X GET https://your-domain.com/api/admin/liff-qr/status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

##  总结

###  已完成的工作

1.  创建批量生成 LIFF QR Code 的 API endpoint
2.  分析"+ 生成 QR Code"按钮的存在意义
3.  提供详细的配置和部署指南

###  关键结论

| 项目 | 结论 |
|------|------|
| **按钮是否应该保留？** |  **应该保留**，用于旧团队和重新生成 |
| **新团队是否自动生成？** |  **是**，创建时自动生成 LIFF QR Code |
| **如何批量生成？** | 使用 `/api/admin/liff-qr/batch-generate` API |
| **报错原因？** | 环境变量未配置（LINE_LIFF_ID, R2_PUBLIC_URL） |

###  下一步操作

1. 配置环境变量（`LINE_LIFF_ID`, `R2_PUBLIC_URL`）
2. 部署更新后的代码
3. 执行批量生成 API
4. 验证所有团队都有 LIFF QR Code

---

##  支持

如果遇到问题，请检查：
1. Worker 日志：`wrangler tail --env production`
2. 浏览器控制台错误
3. 环境变量配置是否正确

需要帮助？请提供：
- 错误信息（完整堆栈）
- Worker 日志输出
- 环境变量配置（隐藏敏感信息）
