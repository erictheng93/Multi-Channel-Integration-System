// Teams Module Routes
// 團隊模組路由配置

import { Hono } from 'hono';
import teamHandlers from '@modules/teams/handlers/team';
import membersHandler from '@modules/teams/handlers/members';
import passwordHandler from '@modules/teams/handlers/password';
import invitationsHandler from '@modules/teams/handlers/invitations';
import type { Bindings } from '@/types';

const app = new Hono<{ Bindings: Bindings }>();

// ⚠️ IMPORTANT: Route registration order matters!
// More specific routes MUST be registered BEFORE generic parameter routes
// Otherwise /:id/* patterns will intercept specific routes

// Mount member management handlers FIRST (before /:id routes)
app.route('/members', membersHandler);

// Mount invitation handlers FIRST (before /:id routes)
app.route('/invitations', invitationsHandler);

// Mount password management handlers on /members
// Note: change-password is mounted separately in main index.ts under /api/auth
app.route('/members', passwordHandler);

// Mount team handlers LAST (contains /:id/* patterns)
app.route('/', teamHandlers);

export default app;