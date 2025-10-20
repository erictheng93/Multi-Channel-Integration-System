// Teams Module Routes - 使用智能路由註冊器
// Smart Route Registry 示例

import { Hono } from 'hono';
import teamHandlers from '@modules/teams/handlers/team';
import membersHandler from '@modules/teams/handlers/members';
import passwordHandler from '@modules/teams/handlers/password';
import invitationsHandler from '@modules/teams/handlers/invitations';
import type { Bindings } from '@/types';
import { createSmartRegistry, RoutePriority } from '@/core/smart-route-registry';

const app = new Hono<{ Bindings: Bindings }>();

// ✅ 使用智能路由註冊器
const registry = createSmartRegistry(app);

// 添加所有路由定義（順序不重要！）
registry.addMany([
  {
    path: '/members',
    handler: membersHandler,
    priority: RoutePriority.SPECIFIC,
    description: 'Member management endpoints'
  },
  {
    path: '/invitations',
    handler: invitationsHandler,
    priority: RoutePriority.SPECIFIC,
    description: 'Invitation management endpoints'
  },
  {
    path: '/members',
    handler: passwordHandler,
    priority: RoutePriority.SPECIFIC,
    description: 'Password management for members'
  },
  {
    path: '/',
    handler: teamHandlers,
    priority: RoutePriority.PARAMETERIZED,
    description: 'Team CRUD and parameterized routes (contains /:id/*)'
  }
]);

// 自動排序並註冊（會顯示詳細報告）
const { registered, conflicts, report } = registry.register();

// 如果檢測到衝突，發出警告
if (conflicts.length > 0) {
  console.warn('\n⚠️  WARNING: Route conflicts detected in Teams module!');
  console.warn('Please review the registration report above.\n');
}

export default app;
