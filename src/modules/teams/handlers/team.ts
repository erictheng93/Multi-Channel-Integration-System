// Teams Module Handler - Composition Router
// Combines sub-routers: team-crud, team-members, team-qr
//
// ROUTE REGISTRATION ORDER (Priority):
// 1. teamCrud: /health, /info, /stats/all, /transfer, /search/:query,
// /:id/stats, /:id (GET/PUT/DELETE), / (GET/POST)
// 2. teamMembers: /:id/members/bulk-remove, /:id/members/batch,
// /:id/members/:agentId (PUT/DELETE), /:id/members (GET/POST)
// 3. teamQr: /:id/qr-code/liff/stats, /:id/qr-codes/:qrCodeId/deactivate,
// /:id/qr-code/liff (GET/POST), /:id/qr-code/latest,
// /:id/qr-code/fast, /:id/qr-code (POST), /:id/qr-codes (GET),
// /:id/qr-code-test (POST)
//
// teamCrud MUST be registered FIRST because it contains static routes (/health, /info)
// and specific routes (/stats/all, /transfer) that must take priority over
// parameterized routes. The wildcard routes (GET /, POST /) are at the end of
// teamCrud's internal registration order.

import { Hono } from 'hono';
import teamCrud from './team-crud';
import teamMembers from './team-members';
import teamQr from './team-qr';
import type { Bindings } from '@/types';

const app = new Hono<{ Bindings: Bindings }>();

// Mount sub-routers in priority order
app.route('/', teamCrud);
app.route('/', teamMembers);
app.route('/', teamQr);

export default app;
