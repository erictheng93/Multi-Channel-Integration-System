# 对话列表实时同步功能测试计划

## 📋 测试目标

验证对话列表的所有 7 个字段都能实时更新：

| # | 字段 | class 名称 | 数据来源 | 测试场景 |
|---|------|-----------|---------|---------|
| 1 | **客户名称** | `customer-name` | `conversation.customer?.name` | 客户信息更新 |
| 2 | **客户 ID** | `customer-id` | `conversation.userId` | 用户 ID 变更 |
| 3 | **平台** | `platform-badge` | `conversation.platform` | 平台切换 |
| 4 | **状态** | `status-badge` | `conversation.status` | 状态变更 (open/assigned/closed) |
| 5 | **最后消息** | `last-message` | `conversation.lastMessage?.content` | 新消息到达 |
| 6 | **负责人** | `assigned-agent` | `conversation.assignedAgent/Team?.name` | 指派变更 |
| 7 | **更新时间** | `timestamp` | `conversation.updatedAt` | 任何更新 |

---

## 🚀 测试前准备

### 1. 启动开发服务器

```bash
# Terminal 1: Backend
cd D:\Code\Multi_Channel_Integration_System
npm run dev

# Terminal 2: Frontend
cd D:\Code\Multi_Channel_Integration_System\frontend
npm run dev
```

### 2. 打开浏览器控制台

访问 `http://localhost:3000/conversations`，打开浏览器开发者工具 (F12)，切换到 Console 标签。

### 3. 验证 WebSocket 连接

在控制台中查找以下日志：

```
✅ 期望看到的日志:
🚀 [ConversationsTable] Mounted for conversation list
🔌 [ConversationsTable] Initializing real-time sync from Store...
🚀 [ConversationsStore] Initializing real-time sync...
📡 [Sync Service] Initializing WebSocket connection...
✅ [Sync Service] WebSocket connected
✅ [ConversationsStore] Real-time sync initialized
```

---

## 🧪 测试场景

### 测试 1: 新消息实时更新 (字段 5, 7)

**操作步骤：**
1. 在对话列表页保持打开状态
2. 使用另一个浏览器窗口或 LINE 应用发送新消息
3. 观察对话列表中的"最后消息"和"更新时间"字段

**期望结果：**
- ✅ "最后消息"立即显示新消息内容（无需刷新页面）
- ✅ "更新时间"自动更新为当前时间
- ✅ 对话自动移到列表顶部（根据 updatedAt 排序）
- ✅ 控制台显示:
  ```
  📥 [ConversationsStore] Received X conversations from WebSocket
  📊 [ConversationsStore] Incremental update completed: changed: 1, added: 0
  ```

---

### 测试 2: 对话状态变更 (字段 4, 7)

**操作步骤：**
1. 在对话详情页中将对话状态从 "待处理" 改为 "已指派"
2. 返回对话列表页（或在另一个标签页中观察）

**期望结果：**
- ✅ 状态徽章颜色和文字自动更新（蓝色"已指派"）
- ✅ "更新时间"自动更新
- ✅ 无需手动刷新页面

---

### 测试 3: 指派变更 (字段 6, 7)

**操作步骤：**
1. 将对话指派给某个客服人员或团队
2. 观察列表页的"负责人"字段

**期望结果：**
- ✅ "负责人"从"未指派"变为"👤 客服姓名"或"👥 团队名称"
- ✅ 状态自动变为"已指派"
- ✅ "更新时间"自动更新

---

### 测试 4: WebSocket 断线重连

**操作步骤：**
1. 在浏览器控制台中模拟网络断开：
   ```javascript
   // 关闭 WebSocket 连接
   conversationsStore.cleanup()
   ```
2. 等待 5 秒
3. 观察控制台日志

**期望结果：**
- ✅ 自动尝试重连 (最多 3 次)
- ✅ 重连失败后切换到轮询模式
- ✅ 控制台显示:
  ```
  🔄 [Sync Service] Reconnecting WebSocket (1/3)...
  ⚠️ [Sync Service] Max reconnect attempts reached, falling back to polling
  📊 [ConversationsStore] Sync status changed: polling
  ```
- ✅ 轮询模式下仍然能接收更新（5 分钟一次）

---

### 测试 5: 多组件共享实时更新

**操作步骤：**
1. 同时打开以下页面（使用多个浏览器标签）：
   - 对话列表页 (`/conversations`)
   - Dashboard 页 (如果有对话统计)
   - 通知中心 (如果显示未读对话)
2. 在任一页面触发对话更新（发送消息、变更状态等）

**期望结果：**
- ✅ 所有使用 `conversationsStore` 的组件都自动更新
- ✅ 只有一个 WebSocket 连接（检查 Network 标签）
- ✅ 所有页面显示一致的数据

---

### 测试 6: 页面切换时的连接管理

**操作步骤：**
1. 打开对话列表页
2. 切换到其他页面（如 Dashboard）
3. 再切回对话列表页

**期望结果：**
- ✅ WebSocket 连接保持活跃（不断开）
- ✅ 回到列表页时，数据已经是最新的（0 延迟）
- ✅ 控制台显示:
  ```
  👋 [ConversationsTable] Component unmounting, cleaning up...
  🛑 [ConversationsStore] Cleaning up real-time sync...
  ```

---

## 📊 性能验证

### 1. WebSocket 连接数检查

**操作步骤：**
1. 打开浏览器开发者工具
2. 切换到 Network 标签
3. 筛选 WS (WebSocket) 连接

**期望结果：**
- ✅ 只有 1 个 WebSocket 连接
- ✅ 连接状态显示为 "pending" 或 101 (协议升级)
- ✅ 无重复连接或频繁断开

### 2. 内存泄漏检查

**操作步骤：**
1. 打开开发者工具 Performance 标签
2. 反复进入/离开对话列表页 10 次
3. 拍摄内存快照

**期望结果：**
- ✅ 内存使用稳定，无持续增长
- ✅ `conversationSync` 服务正确清理

---

## 🐛 故障排查

### 问题 1: WebSocket 连接失败

**症状：**
```
❌ [Sync Service] WebSocket connection failed
⚠️ [Sync Service] Max reconnect attempts reached, falling back to polling
```

**解决方案：**
1. 检查后端 WebSocket 服务是否启动
2. 检查 `.env` 文件中的 `VITE_WS_URL` 配置
3. 检查防火墙是否阻止 WebSocket 连接

### 问题 2: 数据不更新

**症状：**
- WebSocket 已连接，但列表数据不刷新

**解决方案：**
1. 检查控制台是否有错误日志
2. 验证 `updateConversationsIncrementally` 是否被调用
3. 检查后端是否正确发送 WebSocket 消息

### 问题 3: 重复连接

**症状：**
- Network 标签显示多个 WebSocket 连接

**解决方案：**
1. 检查是否有多个组件调用 `initializeRealtime`
2. 确保 `cleanup` 方法在组件卸载时被调用
3. 检查 `conversationSync` 服务的单例模式

---

## ✅ 测试完成检查清单

- [ ] 所有 7 个字段都能实时更新
- [ ] WebSocket 连接稳定，无频繁断开
- [ ] 断线后能自动重连或切换到轮询模式
- [ ] 多个组件共享同一个 WebSocket 连接
- [ ] 页面切换时连接管理正确
- [ ] 无内存泄漏
- [ ] 控制台无错误日志
- [ ] 性能符合预期（更新延迟 < 1 秒）

---

## 📝 测试报告模板

```markdown
## 实时同步功能测试报告

**测试时间：** YYYY-MM-DD HH:mm:ss
**测试人员：** [Your Name]
**环境：** Development

### 测试结果

| 测试场景 | 状态 | 备注 |
|---------|------|------|
| 新消息实时更新 | ✅/❌ | |
| 状态变更实时更新 | ✅/❌ | |
| 指派变更实时更新 | ✅/❌ | |
| WebSocket 断线重连 | ✅/❌ | |
| 多组件共享更新 | ✅/❌ | |
| 页面切换连接管理 | ✅/❌ | |

### 性能指标

- WebSocket 连接数：1
- 更新延迟：< 1s
- 内存使用：稳定
- CPU 占用：正常

### 问题记录

[记录发现的问题和解决方案]

### 总结

[测试总结和建议]
```

---

## 🎓 下一步

如果所有测试通过，可以：
1. ✅ 将更改提交到 Git
2. ✅ 更新 CLAUDE.md 文档
3. ✅ 开始实施方案 B 阶段 2（架构优化）
