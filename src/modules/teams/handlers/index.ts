// Teams Module Routes
// 團隊模組路由配置

import { Hono } from 'hono';
import teamHandlers from '@modules/teams/handlers/team';
import membersHandler from '@modules/teams/handlers/members';
import passwordHandler from '@modules/teams/handlers/password';
import agentTeamsHandler from '@modules/teams/handlers/agent-teams';
import type { Bindings } from '@/types';

const app = new Hono<{ Bindings: Bindings }>();

// ⚠️ IMPORTANT: Route registration order matters!
// More specific routes MUST be registered BEFORE generic parameter routes
// Otherwise /:id/* patterns will intercept specific routes

// Mount agent-teams handler FIRST (multi-team membership support)
// Routes: /api/teams/agent-teams/:agentId, /api/teams/agent-teams/:agentId/join, etc.
app.route('/agent-teams', agentTeamsHandler);

// Mount member management handlers (before /:id routes)
app.route('/members', membersHandler);

// Mount password management handlers on /members
// Note: change-password is mounted separately in main index.ts under /api/auth
app.route('/members', passwordHandler);

// Mount team handlers LAST (contains /:id/* patterns)
app.route('/', teamHandlers);

export default app;