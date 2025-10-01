// Teams Module Routes
// 團隊模組路由配置

import { Hono } from 'hono';
import teamHandlers from '@modules/teams/handlers/team';
import type { Bindings } from '@/types';

const app = new Hono<{ Bindings: Bindings }>();

// Mount team handlers
app.route('/', teamHandlers);

export default app;