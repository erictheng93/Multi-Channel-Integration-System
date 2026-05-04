# 团队选择器 WebSocket 实时更新规划

##  概述

**目标**: 实现团队数据的 WebSocket 实时更新，消除手动刷新需求，提供 100% 实时的用户体验。

**当前状态**:
-  Phase 1 完成：缓存优化 + 加载状态
-  Phase 2 完成：应用启动预加载
-  Phase 3.1 完成：手动刷新按钮
-  Phase 3.2 规划中：WebSocket 实时更新

---

##  业务场景

### 需要实时更新的场景

1. **团队创建/删除**
   - 管理员在团队管理页面创建新团队
   - 其他正在打开团队选择器的用户应立即看到新团队

2. **团队信息更新**
   - 团队名称修改
   - 团队成员数量变化
   - 团队状态变更（激活/停用）

3. **多用户协作**
   - 用户 A 正在指派对话给团队
   - 用户 B 同时删除了该团队
   - 用户 A 应收到实时通知，避免指派失败

---

##  技术架构

### 1. WebSocket 事件类型

```typescript
// frontend/src/types/websocket-types.ts

export interface TeamUpdateEvent {
  type: 'team.created' | 'team.updated' | 'team.deleted'
  data: {
    teamId: number
    teamName: string
    action: 'create' | 'update' | 'delete'
    timestamp: string
    updatedBy?: string
  }
}

export interface TeamMemberCountUpdateEvent {
  type: 'team.member_count_updated'
  data: {
    teamId: number
    oldCount: number
    newCount: number
    timestamp: string
  }
}
```

### 2. 后端事件广播

```typescript
// src/services/websocket-broadcast-service.ts

export class WebSocketBroadcastService {
  /**
   * 广播团队创建事件
   */
  async broadcastTeamCreated(teamId: number, teamName: string, creator: string) {
    const event: TeamUpdateEvent = {
      type: 'team.created',
      data: {
        teamId,
        teamName,
        action: 'create',
        timestamp: new Date().toISOString(),
        updatedBy: creator
      }
    }

    await this.broadcast('admin', event) // 只广播给管理员
  }

  /**
   * 广播团队更新事件
   */
  async broadcastTeamUpdated(teamId: number, teamName: string, updater: string) {
    const event: TeamUpdateEvent = {
      type: 'team.updated',
      data: {
        teamId,
        teamName,
        action: 'update',
        timestamp: new Date().toISOString(),
        updatedBy: updater
      }
    }

    await this.broadcast('admin', event)
  }

  /**
   * 广播团队删除事件
   */
  async broadcastTeamDeleted(teamId: number, teamName: string, deleter: string) {
    const event: TeamUpdateEvent = {
      type: 'team.deleted',
      data: {
        teamId,
        teamName,
        action: 'delete',
        timestamp: new Date().toISOString(),
        updatedBy: deleter
      }
    }

    await this.broadcast('admin', event)
  }
}
```

### 3. 后端集成点

需要在以下后端 handler 中添加 WebSocket 事件广播：

```typescript
// src/handlers/team-main.ts

// 团队创建
export const createTeam = async (c: Context) => {
  // ... 现有代码 ...

  const newTeam = await teamService.create(data)

  // 广播团队创建事件
  await webSocketBroadcastService.broadcastTeamCreated(
    newTeam.id,
    newTeam.name,
    currentAgent.displayName
  )

  return c.json({ success: true, data: newTeam })
}

// 团队更新
export const updateTeam = async (c: Context) => {
  // ... 现有代码 ...

  const updatedTeam = await teamService.update(teamId, data)

  // 广播团队更新事件
  await webSocketBroadcastService.broadcastTeamUpdated(
    updatedTeam.id,
    updatedTeam.name,
    currentAgent.displayName
  )

  return c.json({ success: true, data: updatedTeam })
}

// 团队删除
export const deleteTeam = async (c: Context) => {
  // ... 现有代码 ...

  const team = await teamService.findById(teamId)
  await teamService.delete(teamId)

  // 广播团队删除事件
  await webSocketBroadcastService.broadcastTeamDeleted(
    teamId,
    team.name,
    currentAgent.displayName
  )

  return c.json({ success: true })
}
```

### 4. 前端 WebSocket 监听器

```typescript
// frontend/src/services/teamUpdateListener.ts

import { preloadService } from './preloadService'
import { websocketClient } from './websocketClient'
import { useToast } from '@/composables/useToast'

export class TeamUpdateListener {
  private initialized = false

  /**
   * 初始化团队更新监听器
   */
  init() {
    if (this.initialized) return

    // 监听团队创建事件
    websocketClient.on('team.created', this.handleTeamCreated.bind(this))

    // 监听团队更新事件
    websocketClient.on('team.updated', this.handleTeamUpdated.bind(this))

    // 监听团队删除事件
    websocketClient.on('team.deleted', this.handleTeamDeleted.bind(this))

    this.initialized = true
    console.log('[TeamUpdateListener] Initialized')
  }

  /**
   * 处理团队创建事件
   */
  private async handleTeamCreated(event: TeamUpdateEvent) {
    console.log('[TeamUpdateListener] Team created:', event.data)

    // 刷新团队缓存
    await preloadService.refreshTeams()

    // 显示通知（可选）
    const { showInfo } = useToast()
    showInfo('團隊已更新', `新團隊「${event.data.teamName}」已創建`)
  }

  /**
   * 处理团队更新事件
   */
  private async handleTeamUpdated(event: TeamUpdateEvent) {
    console.log('[TeamUpdateListener] Team updated:', event.data)

    // 刷新团队缓存
    await preloadService.refreshTeams()

    // 显示通知（可选）
    const { showInfo } = useToast()
    showInfo('團隊已更新', `團隊「${event.data.teamName}」已更新`)
  }

  /**
   * 处理团队删除事件
   */
  private async handleTeamDeleted(event: TeamUpdateEvent) {
    console.log('[TeamUpdateListener] Team deleted:', event.data)

    // 刷新团队缓存
    await preloadService.refreshTeams()

    // 显示通知（可选）
    const { showWarning } = useToast()
    showWarning('團隊已刪除', `團隊「${event.data.teamName}」已被刪除`)
  }

  /**
   * 清理监听器
   */
  cleanup() {
    if (!this.initialized) return

    websocketClient.off('team.created')
    websocketClient.off('team.updated')
    websocketClient.off('team.deleted')

    this.initialized = false
    console.log('[TeamUpdateListener] Cleaned up')
  }
}

export const teamUpdateListener = new TeamUpdateListener()
```

### 5. 前端应用集成

```typescript
// frontend/src/main.ts

import { teamUpdateListener } from '@/services/teamUpdateListener'

const startApp = async () => {
  // ... 现有代码 ...

  // 初始化团队更新监听器（仅管理员）
  if (authStore.isAuthenticated && authStore.currentAgent?.role === 'admin') {
    teamUpdateListener.init()
  }

  app.mount('#app')
}
```

---

##  性能优化策略

### 1. 防抖处理

避免频繁的缓存刷新：

```typescript
// frontend/src/services/teamUpdateListener.ts

import { debounce } from '@/utils/debounce'

export class TeamUpdateListener {
  // 防抖刷新，500ms 内多次更新只刷新一次
  private debouncedRefresh = debounce(async () => {
    await preloadService.refreshTeams()
  }, 500)

  private async handleTeamUpdated(event: TeamUpdateEvent) {
    console.log('[TeamUpdateListener] Team updated:', event.data)

    // 使用防抖刷新
    this.debouncedRefresh()
  }
}
```

### 2. 批量更新

如果一次性收到多个团队更新事件，批量处理：

```typescript
private pendingUpdates: Set<number> = new Set()

private async handleTeamUpdated(event: TeamUpdateEvent) {
  this.pendingUpdates.add(event.data.teamId)

  // 延迟 200ms 批量处理
  setTimeout(async () => {
    if (this.pendingUpdates.size > 0) {
      await preloadService.refreshTeams()
      console.log(` Batch updated ${this.pendingUpdates.size} teams`)
      this.pendingUpdates.clear()
    }
  }, 200)
}
```

### 3. 智能通知

避免通知轰炸，只在用户关注时显示：

```typescript
private shouldShowNotification(event: TeamUpdateEvent): boolean {
  // 如果用户正在查看团队选择器，不显示通知（已经看到了）
  const isViewingTeamSelector = document.querySelector('.team-selector-panel') !== null

  if (isViewingTeamSelector) {
    return false
  }

  // 如果是当前用户触发的更新，不显示通知
  if (event.data.updatedBy === currentAgent.value?.displayName) {
    return false
  }

  return true
}
```

---

##  测试计划

### 1. 单元测试

```typescript
// tests/unit/services/teamUpdateListener.test.ts

describe('TeamUpdateListener', () => {
  it('should refresh teams on team.created event', async () => {
    const event = {
      type: 'team.created',
      data: {
        teamId: 123,
        teamName: 'Test Team',
        action: 'create',
        timestamp: new Date().toISOString()
      }
    }

    const refreshSpy = vi.spyOn(preloadService, 'refreshTeams')
    await teamUpdateListener.handleTeamCreated(event)

    expect(refreshSpy).toHaveBeenCalled()
  })

  it('should debounce multiple updates', async () => {
    const refreshSpy = vi.spyOn(preloadService, 'refreshTeams')

    // 触发 5 次更新
    for (let i = 0; i < 5; i++) {
      teamUpdateListener.handleTeamUpdated({
        type: 'team.updated',
        data: { teamId: i, teamName: `Team ${i}`, action: 'update', timestamp: new Date().toISOString() }
      })
    }

    // 等待防抖完成
    await new Promise(resolve => setTimeout(resolve, 600))

    // 应该只刷新一次
    expect(refreshSpy).toHaveBeenCalledTimes(1)
  })
})
```

### 2. 集成测试

```typescript
// tests/integration/team-websocket.test.ts

describe('Team WebSocket Integration', () => {
  it('should update team list in real-time when team is created', async () => {
    // 1. 用户 A 打开团队选择器
    const teamSelector = renderTeamSelector()
    expect(teamSelector.teams.length).toBe(3)

    // 2. 用户 B 创建新团队（通过后端 API）
    await createTeam({ name: 'New Team' })

    // 3. 等待 WebSocket 事件传播
    await waitFor(() => {
      expect(teamSelector.teams.length).toBe(4)
    })

    // 4. 验证新团队显示在列表中
    expect(teamSelector.teams[3].name).toBe('New Team')
  })
})
```

### 3. E2E 测试

```typescript
// tests/e2e/team-realtime-updates.spec.ts

describe('Team Real-time Updates E2E', () => {
  it('should sync team changes across multiple browser tabs', async () => {
    // 打开两个浏览器标签
    const page1 = await browser.newPage()
    const page2 = await browser.newPage()

    // Tab 1: 打开团队选择器
    await page1.goto('/conversations')
    await page1.click('[data-testid="assign-team-button"]')

    // Tab 2: 创建新团队
    await page2.goto('/teams')
    await page2.click('[data-testid="create-team-button"]')
    await page2.fill('input[name="teamName"]', 'Real-time Test Team')
    await page2.click('button[type="submit"]')

    // Tab 1: 验证新团队出现（无需刷新）
    await page1.waitForSelector('[data-testid="team-123"]')

    const teamName = await page1.textContent('[data-testid="team-123"] .team-name')
    expect(teamName).toBe('Real-time Test Team')
  })
})
```

---

##  实施时间表

```
Week 1-2: 后端开发
├─ Day 1-3: 添加 WebSocket 事件类型定义
├─ Day 4-6: 在 team-main.ts 集成事件广播
├─ Day 7-9: 后端单元测试
└─ Day 10-14: 后端集成测试和调试

Week 3-4: 前端开发
├─ Day 15-17: 实现 TeamUpdateListener
├─ Day 18-20: 集成到 main.ts 和 AdvancedAssignActions
├─ Day 21-23: 前端单元测试
└─ Day 24-28: 前端集成测试和调试

Week 5: E2E 测试和优化
├─ Day 29-31: E2E 测试开发
├─ Day 32-33: 性能优化（防抖、批量更新）
└─ Day 34-35: 文档和代码审查

Week 6: 部署和监控
├─ Day 36-37: 部署到测试环境
├─ Day 38-39: Beta 测试
└─ Day 40-42: 生产部署和监控
```

---

##  成功指标

### 1. 性能指标

| 指标 | 当前值 | 目标值 | 说明 |
|------|--------|--------|------|
| 团队数据刷新延迟 | 手动刷新 | < 500ms | WebSocket 事件到 UI 更新的延迟 |
| 事件传播成功率 | N/A | > 99.9% | WebSocket 事件成功传播到所有客户端 |
| 内存占用 | 基准 | < +5% | 新增监听器的内存开销 |
| CPU 占用 | 基准 | < +2% | 新增监听器的 CPU 开销 |

### 2. 用户体验指标

-  用户无需手动刷新即可看到最新团队数据
-  多用户协作时避免数据不一致
-  团队变更通知及时且不打扰用户

---

##  安全考虑

### 1. 权限控制

- 只有管理员用户才能接收团队更新事件
- WebSocket 连接需要验证 JWT token
- 事件数据不包含敏感信息（如密码、API 密钥）

### 2. 数据验证

```typescript
// 验证事件数据完整性
function validateTeamUpdateEvent(event: TeamUpdateEvent): boolean {
  if (!event.type || !event.data) {
    return false
  }

  if (!['team.created', 'team.updated', 'team.deleted'].includes(event.type)) {
    return false
  }

  if (!event.data.teamId || !event.data.teamName) {
    return false
  }

  return true
}
```

### 3. 防止事件轰炸

```typescript
// 限流：每秒最多处理 10 个团队更新事件
const rateLimiter = new RateLimiter(10, 1000)

private async handleTeamUpdated(event: TeamUpdateEvent) {
  if (!rateLimiter.tryAcquire()) {
    console.warn(' Rate limit exceeded, dropping event')
    return
  }

  // 处理事件...
}
```

---

##  参考资料

- 现有 WebSocket 架构: `docs/architecture/WEBSOCKET_ARCHITECTURE.md`
- WebSocket 监控: `src/handlers/websocket-health.ts`
- 团队管理 API: `src/handlers/team-main.ts`
- 预加载服务: `frontend/src/services/preloadService.ts`

---

##  快速开始（未来实施时）

```bash
# 1. 后端开发
cd src/services
# 编辑 websocket-broadcast-service.ts 添加团队事件

# 2. 前端开发
cd frontend/src/services
# 创建 teamUpdateListener.ts

# 3. 测试
bun run test:integration -- team-websocket

# 4. 部署
bun run deploy
```

---

**状态**:  规划完成，等待实施批准

**优先级**: P2 (长期优化)

**预期收益**:
- 用户体验提升至 100%
- 多用户协作体验显著改善
- 数据一致性保障

**风险**:
- 中等复杂度的开发工作
- 需要协调前后端开发
- 需要充分的测试覆盖
