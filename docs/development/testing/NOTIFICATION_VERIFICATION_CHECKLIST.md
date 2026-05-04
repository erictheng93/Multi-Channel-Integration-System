# 通知系统验证清单

##  快速验证指南

### 准备工作

1. **确认改进已部署**
   ```bash
   # 查看最新代码修改
   git status
   git diff src/utils/notification-trigger.ts
   git diff src/handlers/webhook.ts
   ```

2. **检查数据库状态**
   ```bash
   # 确认 agent_teams 表存在
   bunx wrangler d1 execute mcis-db \
     --command="SELECT name FROM sqlite_master WHERE type='table' AND name='agent_teams'"

   # 查看团队和成员
   bunx wrangler d1 execute mcis-db \
     --command="SELECT t.id, t.name, COUNT(at.agent_id) as member_count FROM teams t LEFT JOIN agent_teams at ON t.id = at.team_id GROUP BY t.id"
   ```

3. **启动服务**
   ```bash
   # Backend
   bun run dev

   # Frontend (新终端)
   cd frontend && bun run dev
   ```

---

##  测试场景 1: 新对话（第一次发送）

### 操作步骤
1. 使用**新的 LINE 账号**
2. 扫描官方账号 QR Code 添加好友
3. 发送消息："早上好，今天我想吃冰淇淋"

### 验证点
- [ ] Backend Console 显示：`[LINE Webhook] Triggering notification for unassigned conversation`
- [ ] Backend Console 显示：`[Notification Target] All agents`
- [ ] **所有管理员**的通知中心出现红点 
- [ ] **所有客服人员**的通知中心出现红点 
- [ ] 点击通知能正确跳转到对话

### 预期通知内容
```
 标题: " 新對話"
 内容: "新客戶「XXX」在 LINE 開始了新對話：早上好，今天我想吃冰淇淋"
 时间: 刚刚
```

---

##  测试场景 2: 已指派团队

### 前置准备
1. 找一个已存在的对话
2. 将对话指派给团队（例如"客服一部"）
3. **不要指派给个人客服**（确保 `assignedUserId` 为 null）

### 操作步骤
1. 使用对应的 LINE 账号
2. 发送消息："早上好，今天我想吃冰淇淋"

### 验证点
- [ ] Backend Console 显示：`[LINE Webhook] Triggering notification for assigned team`
- [ ] Backend Console 显示：`[Notification Target] Team-specific: { teamId: X }`
- [ ] **所有管理员**收到通知 
- [ ] **被指派团队的客服**收到通知 
- [ ] **其他团队的客服**不会收到通知 

### 数据库验证
```sql
-- 检查对话指派状态
SELECT
  id,
  assigned_team_id,  -- 应该不为 null
  assigned_user_id -- 应该为 null
FROM conversations
WHERE id = 'conv-xxx';

-- 检查团队成员
SELECT
  at.agent_id,
  a.display_name
FROM agent_teams at
JOIN agents a ON at.agent_id = a.id
WHERE at.team_id = X;
```

---

##  测试场景 3: 未指派

### 前置准备
1. 找一个已存在的对话
2. 确保**没有指派团队**（`assignedTeamId` 为 null）
3. 确保**没有指派客服**（`assignedUserId` 为 null）

### 操作步骤
1. 使用对应的 LINE 账号
2. 发送消息："早上好，今天我想吃冰淇淋"

### 验证点
- [ ] Backend Console 显示：`[LINE Webhook] Triggering notification for unassigned conversation`
- [ ] Backend Console 显示：`[Notification Target] All agents`
- [ ] **所有管理员**收到通知 
- [ ] **所有客服人员**收到通知 

### 数据库验证
```sql
-- 检查对话指派状态
SELECT
  id,
  assigned_team_id,  -- 应该为 null
  assigned_user_id -- 应该为 null
FROM conversations
WHERE id = 'conv-xxx';
```

---

##  故障排查

### 问题 1: 没有收到通知

**检查步骤**:
1. 确认 WebSocket 连接状态
   ```bash
   bun run health:check:ws
   ```

2. 检查 Backend Console 日志
   ```
   应该看到:
    [Notification] WebSocket broadcast successful

   如果看到:
    [Notification] WebSocket broadcast failed
   → 检查 Durable Objects 绑定
   ```

3. 检查数据库通知记录
   ```sql
   SELECT * FROM notifications
   WHERE created_at > datetime('now', '-1 hour')
   ORDER BY created_at DESC
   LIMIT 20;
   ```

### 问题 2: 通知对象不正确

**检查步骤**:
1. 查看 Backend Console 的 `[Notification Target]` 日志
2. 验证数据库中的团队成员
3. 确认用户角色（admin/agent）和 `isActive` 状态

### 问题 3: 团队成员没有收到通知

**检查步骤**:
1. 确认 `agent_teams` 表中的关联
   ```sql
   SELECT * FROM agent_teams WHERE team_id = X;
   ```

2. 确认客服账号状态
   ```sql
   SELECT id, display_name, role, is_active
   FROM agents
   WHERE id IN (SELECT agent_id FROM agent_teams WHERE team_id = X);
   ```

---

##  验证通过标准

###  所有测试场景通过
- [x] 场景 1: 新对话 - 通知所有人
- [x] 场景 2: 已指派团队 - 通知团队成员和管理员
- [x] 场景 3: 未指派 - 通知所有人

###  WebSocket 实时推送正常
- [x] 通知能即时显示在通知中心
- [x] 通知中心红点正确显示
- [x] 点击通知能正确跳转

###  数据库记录正确
- [x] 通知记录已创建
- [x] 通知类型正确
- [x] 通知内容完整

###  日志输出清晰
- [x] Backend Console 有详细日志
- [x] 日志能清楚显示通知目标
- [x] 错误日志有详细信息

---

##  验证报告模板

```markdown
# 通知系统验证报告

**验证日期**: YYYY-MM-DD
**验证人员**: XXX

## 测试结果

### 场景 1: 新对话
- 状态: [ ]  通过 / [ ]  失败
- 通知对象数量: X 人
- 备注:

### 场景 2: 已指派团队
- 状态: [ ]  通过 / [ ]  失败
- 团队: XXX
- 通知对象数量: X 人
- 备注:

### 场景 3: 未指派
- 状态: [ ]  通过 / [ ]  失败
- 通知对象数量: X 人
- 备注:

## 发现的问题
1.
2.

## 总体评估
- [ ]  系统运行正常，可以发布
- [ ]  有小问题，需要修复后再验证
- [ ]  有严重问题，需要回滚

## 签名
验证人: ____________
日期: ____________
```

---

##  下一步

验证通过后：
1. 创建 Git commit
2. 部署到生产环境
3. 监控通知发送情况
4. 收集用户反馈
