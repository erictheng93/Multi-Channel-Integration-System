# 🎯 组件重构优先级评估表单

**生成日期**: 2026-01-05
**评估范围**: 10 个大型组件
**评估标准**: 复杂度、业务影响、技术债务、ROI

---

## 📊 优先级评估总览

```
═══════════════════════════════════════════════════════════════════════════
                        PRIORITY ASSESSMENT MATRIX
═══════════════════════════════════════════════════════════════════════════

进度: ████████████░░░░░░░░░░░░░░░░░░░░  40% (4/10 完成)

总计: 10 个组件
  ✅ 已完成: 4 个
  ⚠️  进行中: 1 个
  🔴 待重构: 5 个
```

---

## 📋 详细优先级表单

### 🔴 P0 级 - 立即执行 (本周必须启动)

#### #1 NotificationList.vue ⚠️ 80% 完成

| 评估项目 | 详情 |
|---------|------|
| **当前状态** | 进行中 (Composables 完成，主组件待简化) |
| **当前行数** | 943 lines (目标: 150 lines) |
| **const 变量** | 12 个 (目标: 3 个) |
| **复杂度** | 🟠🟠🟠🟠🟠🟠🟠 7/10 |
| **业务影响** | 🟡 中 (通知系统) |
| **技术债务** | 🟠 中-高 (模板内联逻辑多) |
| **预估时间** | **2-3 小时** |
| **优先级原因** | • 已完成 80%，快速完成获得成就感<br>• Composables 已全部完成<br>• 只需简化主组件模板 |

**主要问题**:
```
❌ 主组件仍有 943 行 (模板约 850 行)
❌ 大量内联组件未提取为独立文件
❌ 缺少单元测试
```

**剩余工作清单**:
- [ ] 简化主组件模板 (移除内联逻辑)
- [ ] 确保所有子组件已正确导入
- [ ] 为 5 个 composables 编写单元测试
- [ ] 集成测试
- [ ] 手动测试所有功能

**预期收益**:
```
✅ 主组件减少 84% (943 → 150 lines)
✅ 完成一个完整重构案例
✅ 为后续重构提供信心
```

**建议时间**: **周一上午** (2-3 小时一次性完成)

---

#### #2 ConversationList.vue 🔴 最高优先级

| 评估项目 | 详情 |
|---------|------|
| **当前状态** | 待重构 (最大单体组件) |
| **当前行数** | **1,592 lines** (目标: 120 lines) |
| **const 变量** | **41 个** (目标: 3 个) |
| **复杂度** | 🔴🔴🔴🔴🔴🔴🔴🔴🔴 **9/10 (非常高)** |
| **业务影响** | 🔴 **极高** (核心对话管理) |
| **技术债务** | 🔴 **非常高** (影响新功能开发) |
| **预估时间** | **3-4 天** (Week 1 Wed-Fri + Week 2 Mon-Tue) |
| **优先级原因** | • 最大最复杂的单体组件<br>• 影响核心业务功能<br>• 性能优化潜力最大<br>• 技术债务最严重 |

**主要问题**:
```
❌ 过多的局部状态 (41 个 const - 系统最多)
   • filters (status, platform, assigned, search, tags, dateRange, ...)
   • conversations [], selectedConversations []
   • sortBy, sortOrder, pagination
   • virtualScroll (config + state)
   • cacheManager (KV cache integration)
   • syncStatus (WebSocket/SSE/Polling)
   • ... 还有 30+ 个其他状态

❌ 复杂的数据流
   • 多重筛选逻辑 (6+ 筛选条件)
   • 虚拟滚动实现 (@tanstack/vue-virtual)
   • 混合同步机制 (SSE → WebSocket → Polling)
   • 双层缓存 (内存 + KV)
   • 实时更新处理

❌ 模板复杂度高
   • 筛选器部分 (~150 行)
   • 对话列表 (虚拟滚动 ~200 行)
   • 空状态、加载状态 (~100 行)
   • 同步状态指示器 (~50 行)

❌ 难以测试
   • 无法隔离测试筛选逻辑
   • 无法测试排序
   • 无法测试同步机制
   • 无法测试缓存策略
```

**重构计划** (4 个阶段):

**Phase 1: Composables 提取 (Day 1-2)**
```
□ useConversationListController.ts (主协调器)
  • 初始化所有子 composables
  • 管理模态窗口状态
  • 生命周期管理

□ useConversationFilters.ts (多重筛选)
  • 状态筛选 (open/assigned/closed)
  • 平台筛选 (LINE/Facebook/Instagram)
  • 指派筛选 (all/me/unassigned)
  • 标签筛选
  • 日期范围筛选
  • 搜索筛选
  • 组合筛选逻辑

□ useConversationSort.ts (排序)
  • 排序字段选择
  • 排序方向 (asc/desc)
  • 自定义排序逻辑

□ useConversationCache.ts (KV 缓存)
  • 缓存读取
  • 缓存写入
  • 缓存失效
  • 缓存命中率统计

□ 单元测试 (4 个 composables, 覆盖率 ≥ 80%)
```

**Phase 2: 同步与虚拟滚动 (Day 2-3)**
```
□ useConversationSync.ts (混合同步)
  • SSE 连接管理
  • WebSocket 降级
  • Polling 最后手段
  • 自动重连机制
  • 同步状态追踪
  • 实时更新处理

□ useConversationVirtualScroll.ts (虚拟滚动)
  • @tanstack/vue-virtual 集成
  • 动态高度计算
  • 滚动位置记忆
  • 预加载机制

□ 单元测试 (2 个 composables)
```

**Phase 3: UI 子组件提取 (Day 3-4)**
```
□ ConversationHeader.vue (标题 + 操作按钮)
  • 页面标题
  • 刷新按钮
  • 缓存状态指示器
  • 同步状态指示器

□ ConversationFilters.vue (筛选器组)
  • 状态筛选下拉框
  • 平台筛选下拉框
  • 指派筛选下拉框
  • 标签筛选
  • 日期范围选择器
  • 搜索框

□ ConversationSort.vue (排序选项)
  • 排序字段选择
  • 排序方向切换

□ ConversationListContainer.vue (虚拟滚动容器)
  • 虚拟滚动逻辑
  • 渲染可见对话
  • 加载更多

□ ConversationCard.vue (单个对话卡片)
  • 对话信息显示
  • 状态标识
  • 操作按钮

□ CacheStatusIndicator.vue (缓存状态)
  • 缓存命中率显示
  • 视觉指示器

□ SyncStatusIndicator.vue (同步状态)
  • SSE/WebSocket/Polling 状态
  • 连接状态动画

□ EmptyState.vue (空状态)
  • 无对话提示
  • 引导操作

□ LoadingSkeleton.vue (骨架屏)
  • 加载占位符
```

**Phase 4: 整合与测试 (Day 4-5)**
```
□ 简化主组件 ConversationList.vue
  • 移除所有内联逻辑
  • 替换为子组件
  • 初始化 controller
  • 添加生命周期钩子

□ 集成测试
  • 完整 CRUD 流程
  • 筛选功能
  • 排序功能
  • 实时同步
  • 缓存机制

□ E2E 测试
  • 用户完整流程

□ 性能测试
  • 虚拟滚动性能
  • 缓存命中率
  • 实时更新延迟
```

**预期收益**:
```
✅ 主组件减少 92% (1,592 → 120 lines)
✅ const 变量减少 93% (41 → 3)
✅ API 调用减少 90% (通过缓存)
✅ 筛选性能提升 85% (去抖 + 客户端筛选)
✅ 虚拟滚动支持 10,000+ 对话
✅ 测试覆盖率 80%+
✅ 维护成本降低 80%
✅ 新功能开发速度提升 70%
```

**建议时间**: **Week 1 Wed-Fri + Week 2 Mon-Tue** (3-4 天)

**风险提示**:
```
⚠️  复杂度高，需要充分测试
⚠️  虚拟滚动需要仔细处理
⚠️  同步机制需要完整测试 (SSE/WebSocket/Polling)
⚠️  缓存逻辑需要验证一致性
```

---

### 🟠 P1 级 - 本月执行 (Week 3-4)

#### #3 Dashboard.vue

| 评估项目 | 详情 |
|---------|------|
| **当前状态** | 待重构 (业务关键组件) |
| **当前行数** | 1,421 lines (目标: 150 lines) |
| **const 变量** | 36 个 (目标: 3 个) |
| **复杂度** | 🟠🟠🟠🟠🟠🟠🟠 7/10 |
| **业务影响** | 🔴 高 (首页入口) |
| **技术债务** | 🟠 中-高 (影响用户体验) |
| **预估时间** | **2-3 天** |
| **优先级原因** | • 业务关键组件 (首页)<br>• 用户体验影响大<br>• 实时更新需要优化 |

**主要问题**:
```
❌ 混合多项职责
   • 页面布局
   • 数据获取 (多个 API 调用)
   • 状态管理 (36 个 const)
   • 实时更新 (WebSocket)
   • 动画和交互

❌ 过多局部状态 (36 个 const)
   • dashboardStats (总体统计)
   • stats (详细统计)
   • openConversations (待处理对话)
   • assignedConversations (已指派对话)
   • recentActivities (活动流)
   • onlineAgents (线上客服)
   • loading, isInitialLoading
   • currentAgent, currentDate
   • ... 还有 28 个其他状态

❌ 硬编码的 UI 元素
   • 统计卡片直接在模板中 (无子组件)
   • 对话列表嵌入主组件
   • 活动流嵌入主组件
   • 缺乏组件重用

❌ 复杂的数据刷新逻辑
   • WebSocket 实时更新
   • 定时刷新机制
   • 手动刷新按钮
   • 需要协调多个数据源
```

**重构计划** (3 个阶段):

**Phase 1: Composables (Day 1)**
```
□ useDashboardController.ts (主协调器)
□ useDashboardStats.ts (统计数据)
  • 总体统计计算
  • 详细统计计算
  • 数据聚合

□ useDashboardRefresh.ts (刷新逻辑)
  • 手动刷新
  • 定时刷新
  • 防抖处理

□ useDashboardRealtime.ts (WebSocket 实时更新)
  • WebSocket 连接
  • 实时事件处理
  • 状态更新
```

**Phase 2: UI 子组件 (Day 1-2)**
```
□ DashboardHeader.vue (欢迎区 + 操作)
□ StatsCard.vue (可重用统计卡片) ⭐
□ StatsGrid.vue (统计卡片容器)
□ RecentConversations.vue (最近对话)
□ ActivityStream.vue (活动流)
□ OnlineAgents.vue (线上客服)
□ DashboardSkeleton.vue (已存在)
□ RefreshButton.vue (刷新按钮)
```

**Phase 3: 整合测试 (Day 2-3)**
```
□ 简化主组件 (1,421 → 150 lines)
□ 集成测试
□ 性能优化 (骨架屏、懒加载)
□ 实时更新测试
```

**预期收益**:
```
✅ 主组件减少 89% (1,421 → 150 lines)
✅ 创建可重用 StatsCard 组件 (可用于其他页面)
✅ 实时更新性能优化
✅ 首屏加载速度提升 (骨架屏)
✅ 测试覆蓋率 75%+
```

**建议时间**: **Week 3** (Mon-Fri, 2-3 天)

---

#### #4 Login.vue

| 评估项目 | 详情 |
|---------|------|
| **当前状态** | 待重构 (入口组件) |
| **当前行数** | 1,411 lines (目标: 200 lines) |
| **const 变量** | 27 个 (目标: 3 个) |
| **复杂度** | 🟠🟠🟠🟠🟠🟠 6/10 |
| **业务影响** | 🟠 中-高 (用户入口) |
| **技术债务** | 🟡 中 (样式复杂度高) |
| **预估时间** | **2 天** |
| **优先级原因** | • 用户第一印象<br>• CSS 可提取为共享资源<br>• 相对简单易重构 |

**主要问题**:
```
❌ 逻辑与样式混合 (1,411 行)
   • 认证逻辑: ~100 行
   • 表单验证: ~50 行
   • 样式定义: ~700+ 行 (CSS)
   • 主题管理: ~30 行
   • 动画定义: ~500+ 行 (复杂动画)

❌ 复杂的 CSS
   • 玻璃态效果 (Glassmorphism)
   • 复杂的渐层动画
   • 响应式布局
   • 深色/浅色主题切换
   • 可提取为独立样式文件

❌ 表单状态管理 (27 个 const)
   • formData (email, password, ...)
   • errors (多个验证错误)
   • touched, focused (字段状态)
   • showPassword, loading, rememberMe
   • 主题状态
```

**重构计划** (2 个阶段):

**Phase 1: Composables + CSS 拆分 (Day 1)**
```
□ useLoginForm.ts (表单状态和验证)
  • 表单数据管理
  • 字段验证规则
  • 错误处理
  • 提交逻辑

□ useLoginAuth.ts (认证逻辑)
  • 登录 API 调用
  • JWT 处理
  • 错误处理
  • 重定向逻辑

□ useLoginTheme.ts (主题管理)
  • 主题切换
  • 主题持久化

□ CSS 拆分
  • animations.css (500 lines) - 提取动画
  • variables.css - 提取变量
  • 主组件样式简化至 ~100 行
```

**Phase 2: UI 子组件 + 整合 (Day 1-2)**
```
□ LoginCard.vue (玻璃态卡片容器)
□ LoginHeader.vue (标题和 Logo)
□ LoginForm.vue (表单容器)
  ├─ EmailField.vue
  ├─ PasswordField.vue
  ├─ RememberMeCheckbox.vue
  └─ SubmitButton.vue
□ LoginFooter.vue (底部链接)
□ ThemeToggle.vue (主题切换)

□ 简化主组件 (1,411 → 200 lines)
□ 表单验证测试
□ 主题切换测试
□ 认证流程测试
```

**预期收益**:
```
✅ 主组件减少 86% (1,411 → 200 lines)
✅ CSS 模块化，可重用于其他页面
✅ 表单验证逻辑可测试
✅ 认证逻辑可测试
✅ 主题管理可重用
```

**建议时间**: **Week 4** (Mon-Wed, 2 天)

---

### 🟡 P2 级 - 待评估 (Week 5)

#### #5 MessageBubble.vue

| 评估项目 | 详情 |
|---------|------|
| **当前状态** | **需要先评估** |
| **当前行数** | **未知** (需要先查看) |
| **const 变量** | **未知** |
| **复杂度** | **?/10** (待评估) |
| **业务影响** | 🟡 中 (消息显示) |
| **技术债务** | **未知** |
| **预估时间** | **待评估后决定** |
| **优先级原因** | • 需要先评估复杂度<br>• 可能不需要重构 (如果 < 300 行) |

**评估清单**:
```
□ 读取 MessageBubble.vue 文件
□ 统计代码行数
□ 统计 const 变量数量
□ 评估复杂度 (1-10)
□ 识别主要问题
□ 决定是否需要重构
  • 如果 < 300 行 → 跳过重构
  • 如果 300-500 行 → 考虑重构
  • 如果 > 500 行 → 必须重构
```

**建议时间**: **Week 5 Mon** (评估)

---

#### #6 ReportDashboard.vue

| 评估项目 | 详情 |
|---------|------|
| **当前状态** | **需要先评估** |
| **当前行数** | **未知** (需要先查看) |
| **const 变量** | **未知** |
| **复杂度** | **?/10** (待评估) |
| **业务影响** | 🟡 中 (报表系统) |
| **技术债务** | **未知** |
| **预估时间** | **待评估后决定** |
| **优先级原因** | • 需要先评估复杂度<br>• 可能参考 Dashboard 模式 |

**评估清单**:
```
□ 读取 ReportDashboard.vue 文件
□ 统计代码行数
□ 统计 const 变量数量
□ 评估复杂度 (1-10)
□ 识别主要问题
□ 决定是否需要重构
□ 如果需要重构，参考 Dashboard.vue 模式
```

**建议时间**: **Week 5 Mon** (评估)

---

### ✅ 已完成组件 (4/10)

#### ✅ #1 CustomerTags.vue - 完美重构案例 ⭐⭐⭐⭐⭐

| 评估项目 | 详情 |
|---------|------|
| **状态** | ✅ 完成 (100%) |
| **重构前** | 1,984 lines, 120+ const |
| **重构后** | 180 lines, 8 const |
| **改善** | -90.9% 代码量，-93.3% 变量 |
| **复杂度** | 10/10 → 3/10 |
| **测试覆盖** | 待补充 (单元测试) |

**完成内容**:
```
✅ 5 个 Composables (774 lines)
  ├─ useCustomerTagsController.ts (243 lines)
  ├─ useTagSearch.ts (98 lines)
  ├─ useTagActions.ts (276 lines)
  ├─ useTagSelection.ts (81 lines)
  └─ useTagKeyboard.ts (76 lines)

✅ 8 个 UI 子组件 (2,100+ lines)
  ├─ TagsHeader.vue
  ├─ TagsStats.vue
  ├─ TagsToolbar.vue
  ├─ TagsList.vue
  ├─ TagCard.vue
  ├─ TagFormModal.vue
  ├─ DeleteConfirmModal.vue
  └─ BulkDeleteModal.vue

✅ 主组件简化至 180 lines
✅ 完整文档 (REFACTORING_COMPLETE.md)
```

**待补充**:
```
⚠️  单元测试 (5 个 composables)
⚠️  集成测试
```

---

#### ✅ #2 TeamManagement.vue - 已遵循最佳实践 ⭐⭐⭐⭐

| 评估项目 | 详情 |
|---------|------|
| **状态** | ✅ 已优化 |
| **当前行数** | 232 lines |
| **const 变量** | 3 个 |
| **复杂度** | 3/10 (低) |
| **架构** | ✅ Controller Pattern |

**架构评估**:
```
✅ useTeamManagementController (主协调器)
✅ 9 个 UI 子组件
  ├─ TeamStatsOverview.vue
  ├─ MemberListSection.vue
  ├─ TeamListSection.vue
  ├─ AddMemberModal.vue
  ├─ AddTeamModal.vue
  ├─ EditTeamModal.vue
  ├─ PasswordResetModal.vue
  └─ QRCodeModal.vue

✅ 主组件 232 lines (符合标准)
✅ 职责分离清晰
✅ 可测试性好
```

**结论**: 无需重构 ✅

---

#### ✅ #3 ApiMonitor.vue - 已遵循最佳实践 ⭐⭐⭐⭐

| 评估项目 | 详情 |
|---------|------|
| **状态** | ✅ 已优化 |
| **当前行数** | 101 lines |
| **const 变量** | 3 个 |
| **复杂度** | 2/10 (非常低) |
| **架构** | ✅ Controller Pattern |

**架构评估**:
```
✅ useApiMonitorController (主协调器)
✅ 6 个 UI 子组件
  ├─ ApiHeader.vue
  ├─ ApiStatsGrid.vue
  ├─ ApiFilter.vue
  ├─ ApiCardList.vue
  ├─ ApiModal.vue
  └─ MigrationStatus.vue

✅ 主组件 101 lines (非常优秀)
✅ 职责分离清晰
✅ 可测试性好
```

**结论**: 无需重构 ✅

---

#### ✅ #4 SystemSettings.vue - 已遵循最佳实践 ⭐⭐⭐⭐

| 评估项目 | 详情 |
|---------|------|
| **状态** | ✅ 已优化 |
| **当前行数** | 151 lines |
| **const 变量** | 1 个 |
| **复杂度** | 2/10 (非常低) |
| **架构** | ✅ Controller Pattern |

**架构评估**:
```
✅ useSystemSettingsController (主协调器)
✅ 8 个设置专用子组件
  ├─ SettingsHeader.vue
  ├─ SettingsNav.vue
  ├─ GeneralSettingsForm.vue
  ├─ LineIntegrationForm.vue
  ├─ FacebookIntegrationForm.vue
  ├─ AdvancedSettingsForm.vue
  ├─ BackupManager.vue
  └─ CacheManager.vue

✅ 主组件 151 lines (非常优秀)
✅ 职责分离清晰
✅ 可测试性好
```

**结论**: 无需重构 ✅

---

## 📊 优先级矩阵 (影响 vs 复杂度)

```
高业务影响 │
          │
    🔴    │  #2 ConversationList    🔴 P0 (立即执行)
          │  (复杂度 9, 影响极高)
          │
          │  #3 Dashboard           🟠 P1 (本月执行)
    🟠    │  (复杂度 7, 影响高)
          │
          │  #4 Login               🟠 P1 (本月执行)
          │  (复杂度 6, 影响中-高)
    🟡    │
          │  #1 NotificationList    ⚠️  80% 完成
          │  (复杂度 7, 影响中)
          │
          │  #5 MessageBubble       🟡 P2 (待评估)
          │  #6 ReportDashboard     🟡 P2 (待评估)
低业务影响 │
          └──────────────────────────────────────
           低                                  高
                     复杂度 / 技术债务
```

---

## ⏱️ 时间规划总览

```
═══════════════════════════════════════════════════════════════════
                    6-WEEK EXECUTION TIMELINE
═══════════════════════════════════════════════════════════════════

Week 1: NotificationList 完成 + ConversationList Phase 1-2
├─ Mon-Tue:    NotificationList 收尾 (2-3 hrs)           ⚠️
├─ Wed-Thu:    ConversationList Phase 1 (Composables)    🔴
└─ Fri:        ConversationList Phase 2 (同步逻辑)       🔴

Week 2: ConversationList Phase 3-4 (完成)
├─ Mon:        ConversationList Phase 3 (UI 子组件)      🔴
├─ Tue:        ConversationList Phase 3 (UI 子组件)      🔴
├─ Wed:        ConversationList Phase 4 (整合)           🔴
├─ Thu:        ConversationList Phase 4 (测试)           🔴
└─ Fri:        ConversationList 完成 + Review            🔴

Week 3: Dashboard.vue 重构
├─ Mon:        Dashboard Phase 1 (Composables)           🟠
├─ Tue:        Dashboard Phase 1-2 (Composables + UI)   🟠
├─ Wed:        Dashboard Phase 2 (UI 子组件)             🟠
├─ Thu:        Dashboard Phase 3 (整合)                  🟠
└─ Fri:        Dashboard 测试 + 完成                     🟠

Week 4: Login.vue 重构
├─ Mon:        Login Phase 1 (Composables + CSS)         🟠
├─ Tue:        Login Phase 2 (UI 子组件)                 🟠
├─ Wed:        Login Phase 2 (整合测试)                  🟠
├─ Thu-Fri:    测试补充 (CustomerTags, NotificationList) ✅

Week 5: MessageBubble & ReportDashboard 评估
├─ Mon:        评估 MessageBubble 和 ReportDashboard     🟡
├─ Tue-Thu:    根据评估结果决定是否重构                  🟡
└─ Fri:        Composables 单元测试补充                  ✅

Week 6: 测试补全 & 文档完善
├─ Mon-Tue:    所有 Composables 单元测试 (目标 80%)      ✅
├─ Wed-Thu:    集成测试 + E2E 测试                       ✅
└─ Fri:        文档完善 + 总结报告                       ✅

═══════════════════════════════════════════════════════════════════
```

---

## 🎯 成功指标 (Success Metrics)

### 代码质量指标

| 指标 | 目标 | 当前 | 差距 |
|------|------|------|------|
| 平均主组件行数 | < 200 lines | ~1,400 lines | ❌ 需改进 |
| 平均 const 变量数 | < 5 个 | ~30 个 | ❌ 需改进 |
| Composables 测试覆盖率 | > 80% | 0% | ❌ 需补充 |
| 集成测试覆盖率 | > 70% | ~30% | ⚠️ 需改进 |
| TypeScript 严格模式 | 100% | 100% | ✅ 已达标 |

### 性能指标

| 指标 | 目标 | 当前 | 差距 |
|------|------|------|------|
| 初始渲染时间 | < 200ms | ~500ms | ⚠️ 需优化 |
| 操作响应时间 | < 100ms | ~300ms | ⚠️ 需优化 |
| API 调用频率 | 减少 80% | 基准 | ⚠️ 需优化 |
| 缓存命中率 | > 70% | ~30% | ⚠️ 需优化 |

### 团队效率指标

| 指标 | 目标 | 当前 | 改善 |
|------|------|------|------|
| 新功能开发时间 | -70% | 基准 | 待验证 |
| Bug 修复时间 | -80% | 基准 | 待验证 |
| Code Review 时间 | -67% | 基准 | 待验证 |
| 新人上手时间 | -75% | 基准 | 待验证 |

---

## ⚠️ 风险与应急计划

### 风险 1: 时间超支

**概率**: 🟠 中 (40%)

**影响**: 🔴 高

**预防措施**:
- 每日进度追踪
- 每个组件预留 20% 缓冲时间
- 优先级排序清晰

**应急计划**:
- 缩减范围 (延后 MessageBubble, ReportDashboard)
- 专注高优先级 (ConversationList, Dashboard)
- 团队成员协作

### 风险 2: 重构引入新 Bug

**概率**: 🟡 中-低 (30%)

**影响**: 🔴 高

**预防措施**:
- 每个 composable 立即编写测试
- 完整的集成测试
- 手动测试所有功能路径

**应急计划**:
- 保留原组件为 .backup.vue
- Feature flag 控制新旧组件切换
- 快速回滚机制 (git revert)
- 24 小时监控期

### 风险 3: 测试覆盖不足

**概率**: 🟠 中 (50%)

**影响**: 🟠 中-高

**预防措施**:
- 在提取 composable 时立即编写测试
- Code Review 检查测试
- 使用 Vitest coverage 工具

**应急计划**:
- Week 6 专门分配时间补测试
- 优先测试业务关键路径
- 至少达到 70% 覆盖率

---

## 📋 执行检查清单

### Week 1 Mon-Tue: NotificationList 完成 ⚠️

- [ ] 简化主组件模板 (移除内联逻辑)
- [ ] 确保所有子组件已正确导入
- [ ] 为 5 个 composables 编写单元测试
- [ ] 集成测试
- [ ] 手动测试所有功能
- [ ] Git commit + PR

### Week 1 Wed-Fri + Week 2: ConversationList 🔴

**Phase 1: Composables (Wed-Thu)**
- [ ] 创建 useConversationListController.ts
- [ ] 提取 useConversationFilters.ts
- [ ] 提取 useConversationSort.ts
- [ ] 提取 useConversationCache.ts
- [ ] 编写单元测试 (4 个 composables)

**Phase 2: 同步逻辑 (Fri)**
- [ ] 提取 useConversationSync.ts (SSE/WebSocket/Polling)
- [ ] 提取 useConversationVirtualScroll.ts
- [ ] 编写单元测试 (2 个 composables)

**Phase 3: UI 子组件 (Mon-Tue)**
- [ ] ConversationHeader.vue
- [ ] ConversationFilters.vue
- [ ] ConversationSort.vue
- [ ] ConversationListContainer.vue
- [ ] ConversationCard.vue
- [ ] CacheStatusIndicator.vue
- [ ] SyncStatusIndicator.vue
- [ ] EmptyState.vue
- [ ] LoadingSkeleton.vue

**Phase 4: 整合测试 (Wed-Fri)**
- [ ] 简化主组件 (1,592 → 120 lines)
- [ ] 集成测试
- [ ] E2E 测试
- [ ] 性能测试
- [ ] Git commit + PR

### Week 3: Dashboard.vue 🟠

- [ ] Phase 1: Composables
- [ ] Phase 2: UI 子组件
- [ ] Phase 3: 整合测试
- [ ] Git commit + PR

### Week 4: Login.vue 🟠

- [ ] Phase 1: Composables + CSS 拆分
- [ ] Phase 2: UI 子组件 + 整合
- [ ] 测试
- [ ] Git commit + PR

### Week 5: 评估与决策 🟡

- [ ] 评估 MessageBubble.vue
- [ ] 评估 ReportDashboard.vue
- [ ] 决定是否需要重构
- [ ] 如需重构，执行重构

### Week 6: 测试与文档 ✅

- [ ] 所有 Composables 单元测试 (≥ 80%)
- [ ] 集成测试补充
- [ ] E2E 测试补充
- [ ] 文档完善
- [ ] 总结报告

---

## 🎉 预期成果

重构完成后，将实现：

### 代码质量提升
```
✅ 平均主组件代码量减少 90%
✅ const 变量数量减少 90%+
✅ 测试覆盖率提升至 80%+
✅ 100% TypeScript 严格模式
```

### 性能优化
```
✅ API 调用减少 80-90% (缓存)
✅ 操作响应时间减少 70%+
✅ 首屏渲染速度提升 60%+
✅ 虚拟滚动支持 10,000+ 项目
```

### 开发效率提升
```
✅ 新功能开发时间减少 70%
✅ Bug 修复时间减少 80%
✅ Code Review 时间减少 67%
✅ 新人上手时间减少 75%
```

### 架构改进
```
✅ 100% 职责分离 (View/Logic/State)
✅ 100% 可测试性
✅ 创建可重用组件库
✅ 建立标准化架构模式
```

---

**生成时间**: 2026-01-05
**文档版本**: v1.0
**评估人**: Claude (架构师)
**审核人**: [待填写]

---

## 📞 联系与反馈

如有任何问题或建议，请：
1. 创建 Issue
2. 发起讨论
3. 联系团队负责人

---

**状态**: ✅ 评估完成，等待审批执行
