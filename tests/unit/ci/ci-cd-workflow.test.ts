import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync(
  new URL('../../../.github/workflows/ci-cd.yml', import.meta.url),
  'utf8'
)

/** Slice out one job block, from its `  <name>:` line to the next job at the same indent. */
function getJobBlock(jobName: string): string {
  const marker = `\n  ${jobName}:\n`
  const start = workflow.indexOf(marker)
  expect(start).toBeGreaterThanOrEqual(0)

  const rest = workflow.slice(start + marker.length)
  const next = rest.search(/\n {2}[a-z][a-z0-9-]*:\n/)
  return next === -1 ? workflow.slice(start) : workflow.slice(start, start + marker.length + next)
}

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

describe('CI/CD workflow schema doc guard', () => {
  // The token this job carries can read production D1. A `pull_request` run can
  // originate from a fork, so the job must never run on that event.
  it('runs the schema doc check only on push, never on a pull request', () => {
    const job = getJobBlock('schema-doc')

    expect(job).toContain("if: github.event_name == 'push'")
    expect(job).toContain('run: bun run db:doc:schema:check')
  })

  // `validate` is documented as credential-free and safe to run anywhere.
  // Folding a production-D1 check into it would quietly break that promise.
  it('keeps the production credentials out of the validate job', () => {
    // Comments are stripped: a job block runs up to the next job's header, which
    // includes that job's explanatory comments, and those legitimately name the
    // very things this test forbids as executable YAML.
    const validate = getJobBlock('validate')
      .split('\n')
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n')

    expect(validate).not.toContain('CLOUDFLARE_API_TOKEN')
    expect(validate).not.toContain('db:doc:schema')
  })
})
