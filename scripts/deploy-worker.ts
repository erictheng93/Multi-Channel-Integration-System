#!/usr/bin/env bun
/**
 * Worker deploy that records the git commit in the Worker version message, so
 * `wrangler deployments list` shows which commit is live.
 *
 * Usage: bun run deploy (guarded by MCIS_CONFIRM_PRODUCTION=allow:predeploy,allow:deploy)
 *
 * wrangler deploy bundles the working tree, not the commit, so uncommitted changes are marked -dirty.
 */

const git = (...args: string[]): string => {
  const result = Bun.spawnSync(['git', ...args], { stdout: 'pipe', stderr: 'inherit' })
  if (result.exitCode !== 0) {
    console.error(`git ${args.join(' ')} failed`)
    process.exit(1)
  }
  return result.stdout.toString().trim()
}

const sha = git('rev-parse', '--short=8', 'HEAD')
const dirty = git('status', '--porcelain') !== '' ? '-dirty' : ''
const message = `git ${sha}${dirty}`

console.log(`[deploy] Worker version message: ${message}`)

// Extra args pass through to wrangler, e.g. `bun scripts/deploy-worker.ts --dry-run`.
const result = Bun.spawnSync(['wrangler', 'deploy', '--minify', '--message', message, ...process.argv.slice(2)], {
  stdout: 'inherit',
  stderr: 'inherit',
  stdin: 'inherit',
  env: process.env,
})

process.exit(result.exitCode ?? 1)

export {};
