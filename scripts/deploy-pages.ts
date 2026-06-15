#!/usr/bin/env bun
/**
 * Manual production deploy for the frontend (Cloudflare Pages).
 *
 * Why this exists: CI auto-deploy is disabled (.github/workflows/ci-cd.yml,
 * `deploy-production: if: false`). The frontend is now shipped by hand. Vite
 * bakes VITE_* env into the bundle at BUILD time, so a missing/empty
 * VITE_BACKEND_URL silently ships a bundle that crashes on load (Vue never
 * mounts, page stuck at "載入中..."). This wrapper makes that impossible to ship:
 *
 *   1. read the expected backend URL from frontend/.env.production (source of truth)
 *   2. build the frontend
 *   3. GUARD: assert the URL is actually baked into dist/ — abort if not
 *   4. deploy dist/ to Cloudflare Pages (project: mcis)
 *
 * Usage:  bun run deploy:pages
 */

const ROOT = process.cwd()
const ENV_FILE = `${ROOT}/frontend/.env.production`
const DIST = `${ROOT}/frontend/dist`
const PROJECT = 'mcis'

function fail(message: string): never {
  console.error(`\n[deploy:pages] ✗ ${message}\n`)
  process.exit(1)
}

function log(message: string): void {
  console.log(`[deploy:pages] ${message}`)
}

// 1. Read expected backend URL from the local production env file.
const envFile = Bun.file(ENV_FILE)
if (!(await envFile.exists())) {
  fail(`Missing ${ENV_FILE}\n  Copy frontend/.env.production.example and fill in real values.`)
}
const envText = await envFile.text()
const backendUrl = envText.match(/^\s*VITE_BACKEND_URL\s*=\s*(.+?)\s*$/m)?.[1]?.trim()
if (!backendUrl) {
  fail(`VITE_BACKEND_URL not set in ${ENV_FILE}`)
}
log(`expected backend URL: ${backendUrl}`)

// 2. Build the frontend (Vite reads frontend/.env.production at build time).
log('building frontend...')
const build = Bun.spawnSync(['bun', 'run', 'build'], {
  cwd: `${ROOT}/frontend`,
  stdout: 'inherit',
  stderr: 'inherit',
  env: process.env,
})
if (build.exitCode !== 0) {
  fail('frontend build failed.')
}

// 3. Guard: the backend URL MUST appear in the built bundle, or the build did
//    not pick up VITE_BACKEND_URL and would crash on load.
log('verifying backend URL is baked into the bundle...')
const glob = new Bun.Glob('assets/**/*.js')
let baked = false
for await (const relativePath of glob.scan({ cwd: DIST })) {
  const contents = await Bun.file(`${DIST}/${relativePath}`).text()
  if (contents.includes(backendUrl)) {
    baked = true
    break
  }
}
if (!baked) {
  fail(
    `backend URL (${backendUrl}) NOT found in built bundle.\n` +
      `  The build did not pick up VITE_BACKEND_URL — refusing to ship a broken bundle.`,
  )
}
log('guard OK — backend URL baked into bundle.')

// 4. Deploy to Cloudflare Pages.
log(`deploying frontend/dist to Pages project "${PROJECT}"...`)
const deploy = Bun.spawnSync(
  ['bunx', 'wrangler', 'pages', 'deploy', 'frontend/dist', '--project-name', PROJECT],
  { cwd: ROOT, stdout: 'inherit', stderr: 'inherit', env: process.env },
)
if (deploy.exitCode !== 0) {
  fail('wrangler pages deploy failed.')
}
log('done. ✅')
