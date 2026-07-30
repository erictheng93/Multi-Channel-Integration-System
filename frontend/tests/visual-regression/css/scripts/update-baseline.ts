#!/usr/bin/env bun
/**
 * Regenerate the committed CSS baselines under
 * `frontend/tests/visual-regression/css/baseline/`.
 *
 *   bun tests/visual-regression/css/scripts/update-baseline.ts
 *
 * Runs the CSS regression suite with `UPDATE_CSS_BASELINE=1`, which makes every
 * baseline helper write instead of compare. Review the resulting diff: a change
 * in these files is a change in the CSS that ships.
 *
 * Exists as a script rather than an inline env assignment because
 * `VAR=value cmd` is not valid in PowerShell, and this repo is developed on
 * Windows as well as CI.
 */
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const FRONTEND_ROOT = resolve(HERE, '..', '..', '..', '..')

const result = spawnSync(
  'bunx',
  ['vitest', 'run', 'tests/visual-regression/css', '--reporter', 'default'],
  {
    cwd: FRONTEND_ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, UPDATE_CSS_BASELINE: '1' },
  }
)

if (result.error !== undefined) {
  console.error('[css-baseline] failed to start vitest:', result.error.message)
  process.exit(1)
}

if (result.status !== 0) {
  console.error('[css-baseline] vitest exited with code', result.status)
  process.exit(result.status ?? 1)
}

console.log('[css-baseline] baselines rewritten under tests/visual-regression/css/baseline/')
console.log('[css-baseline] review the diff before committing')
