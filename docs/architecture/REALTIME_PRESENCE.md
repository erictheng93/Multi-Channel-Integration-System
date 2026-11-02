# Realtime presence and metrics

## Endpoints

| Endpoint | Who | Notes |
|----------|-----|-------|
| `GET /api/team/presence` | any authenticated user | Online agent ids from the MessageBroadcaster user registry. Admin: all. Agent: members of their own teams only. KV-cached 15 s (freshness checked on read via `generatedAt`, because KV's minimum TTL is 60 s). `available:false` means the broadcaster could not be reached (unknown, not "nobody online"); that response is never cached. |
| `GET /api/websocket/metrics` | admin | Connection and throughput metrics. The fake `performance` block and the Node-only `uptime` were removed. |
| `GET /api/websocket/metrics/history?range=1h\|6h\|24h\|7d` | admin | Points from `ws_metrics_snapshots` (written by the `*/5` cron). 7d is bucket-averaged to at most 300 points. |

Internal (MessageBroadcaster DO, global instance): `GET /online-users` returns `{ userIds, count, timestamp }`.

## Semantics

- `activeConnections` / `registeredConnections` = users in the broadcaster registry plus conversation rooms. These are registered connections, not proven-live sockets; a registry entry can outlive a dropped socket until a failed delivery prunes it. `onlineAgents` is the number of distinct users in the registry (two tabs of one agent count once).
- `eventsInPerSecond` / `eventsOutPerSecond` are real deltas over `windowSeconds`: the current counters minus the newest stored sample that is at least 30 s old. Samples are taken only when someone reads the metrics (the `*/5` cron and ad-hoc admin reads), kept at most 12 over 15 minutes, and persisted in DO storage so they survive eviction. Inbound = events the broadcaster accepted; outbound = delivery attempts (recipients reached plus failures), so one event fanned out to many users counts once in and many out.
- `errorRate` = failed / (success + failed) deliveries inside the same window. `errorRateLifetime` is the since-creation ratio, for reference only.
- When there is no usable reference sample (first read after the counters reset) rates and `errorRate` are `null` and `windowSeconds` is 0. The aggregate `connections` block in `/api/websocket/metrics` reports those as 0 for the legacy monitoring page; the snapshot table stores NULL.

## Alarm and cost notes

No DO alarms or timers were added. Metrics reads never arm an alarm. The cron adds one broadcaster request, one insert and one prune per 5 minutes; the table holds about 2016 rows at steady state. If the broadcaster is unreachable the run records nothing (no zero rows) and still prunes.

## Frontend binding (the shell on feat/ui-foundation)

- Topbar "online" pill: bind it to the current user's own browser connection, not to `/team/presence`. Use the websocket store (`frontend/src/stores/websocket.ts`): `isConnected`, `isConnecting`, `connectionState` (and `reconnectAttempts` for a "reconnecting" label). `components/ui/WebSocketStatusIndicator.vue` already derives a label and dot colour from the same state; reuse its composable rather than reading the store twice. `TeamPresenceDto.self.registered` is a server-side cross-check only (it can lag by 15 s).
- Avatar presence dot for the current user: same store state as the pill.
- Dots for other agents (team list, assignee chips): poll `presenceApi.getTeamPresence()` (`frontend/src/api/presence.ts`) no faster than every 15 s, and show a dot when `onlineAgentIds.includes(agent.id)`. If `available` is false, hide the dots instead of showing everybody as offline. There is no "away" state; do not invent one.
