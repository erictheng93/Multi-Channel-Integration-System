import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync(
  new URL('../../../.github/workflows/ci-cd.yml', import.meta.url),
  'utf8'
)

function getStepBlock(stepName: string): string {
  const marker = `      - name: ${stepName}`
  const start = workflow.indexOf(marker)
  expect(start).toBeGreaterThanOrEqual(0)

  const next = workflow.indexOf('\n      - name:', start + marker.length)
  return workflow.slice(start, next === -1 ? workflow.length : next)
}

describe('CI/CD workflow production deploy safeguards', () => {
  it('intentionally allows the guarded D1 migration step', () => {
    const migrationStep = getStepBlock('Apply D1 migrations')

    expect(migrationStep).toContain('MCIS_CONFIRM_PRODUCTION: allow:d1:migrate')
    expect(migrationStep).toContain('run: bun run db:migrate')
  })

  it('captures a rollback Worker version id instead of a deployment id', () => {
    const captureStep = getStepBlock('Capture current worker version for rollback')

    expect(captureStep).toContain('sort_by(.created_on)')
    expect(captureStep).toContain('versions')
    expect(captureStep).toContain('version_id')
    expect(captureStep).not.toContain("'.[0].id")
  })

  it('passes the rollback version id as Wrangler positional input', () => {
    const rollbackStep = getStepBlock('Roll back worker on failure')

    expect(rollbackStep).toContain(
      'bunx wrangler rollback "${{ steps.capture.outputs.previous }}" --name mcis-worker'
    )
    expect(rollbackStep).toContain('--message')
    expect(rollbackStep).not.toContain('--version-id')
  })
})
