# API metrics setup (Workers Analytics Engine)

Per-endpoint request counts, P50/P95 latency, success rate and status-class distribution on the
API monitor page come from a Workers Analytics Engine dataset. Writing needs no setup beyond
deploying (the `API_METRICS` binding in `wrangler.toml`, dataset `mcis_api_metrics`). Reading
needs two Worker secrets. Until they exist, `GET /api/system/api-status` (admin only) returns
`metrics.configured: false` and an empty `endpoints` list, and the UI shows a setup state.

## 1. Create the API token

1. Cloudflare dashboard > My Profile > API Tokens > Create Token > Create Custom Token.
2. Permission: Account | Account Analytics | Read. Nothing else.
3. Restrict it to the production account (service@dacit.net) and copy the token once.

The account id is on the dashboard overview page (right sidebar) or in `wrangler whoami`.

## 2. Set the secrets

```bash
bunx wrangler secret put CF_ACCOUNT_ID
bunx wrangler secret put CF_ANALYTICS_TOKEN
```

On Windows, if quoting breaks, run `node node_modules/wrangler/bin/wrangler.js secret put ...`.
Secrets apply to the next Worker version; deploy (manual, `bun run deploy`) to pick up the
binding and secrets together.

## Behaviour notes

- Data points: blobs `[method, route pattern, status class, status code]`, double `[latency ms]`,
  index `route pattern`. Route patterns are the matched Hono pattern (`/api/conversations/:id`),
  never the raw path. Websocket upgrades, OPTIONS and health pings are not recorded.
- Analytics Engine samples adaptively; every query weights by `_sample_interval`.
- Results cover the last hour (delta compares with the hour before) and are cached in KV for 60 s.
- Data appears a few seconds to a minute after requests; retention is 3 months.
- The binding is not available in `wrangler dev` local mode; the middleware is a no-op there.
