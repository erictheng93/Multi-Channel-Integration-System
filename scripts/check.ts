#!/usr/bin/env bun

type CheckScope = 'all' | 'backend' | 'frontend'

interface CheckDefinition {
  label: string
  cwd?: string
  args: string[]
  errorPattern?: RegExp
}

interface CheckResult {
  label: string
  passed: boolean
  errorCount: number
}

const validScopes = new Set(['all', 'backend', 'frontend'])
const requestedScope = (Bun.argv[2] ?? 'all') as CheckScope

if (!validScopes.has(requestedScope)) {
  console.error(`Unknown check scope: ${requestedScope}`)
  console.error('Usage: bun scripts/check.ts [all|backend|frontend]')
  process.exit(1)
}

const rootDir = process.cwd()
const bunExe = process.execPath

const backendChecks: CheckDefinition[] = [
  {
    label: 'tsc --noEmit (backend)',
    args: ['x', 'tsc', '--noEmit'],
    errorPattern: /error TS/gi,
  },
  {
    label: 'Import path check',
    args: ['x', 'tsx', 'scripts/check-import-paths.ts'],
  },
  {
    label: 'Route conflict check',
    args: ['run', 'check:routes:ci'],
  },
  {
    label: 'Type debt allowlist',
    args: ['run', 'check:type-debt'],
  },
]

const frontendChecks: CheckDefinition[] = [
  {
    label: 'vue-tsc --noEmit (frontend)',
    cwd: 'frontend',
    args: ['x', 'vue-tsc', '--noEmit'],
    errorPattern: /error TS/gi,
  },
  {
    label: 'ESLint (frontend)',
    cwd: 'frontend',
    args: ['run', 'lint:check'],
    errorPattern: /\berror\b/gi,
  },
  {
    label: 'Scoped .btn guard',
    cwd: 'frontend',
    args: ['run', 'lint:scoped-btn'],
  },
]

function printHeader(title: string) {
  console.log(`\n=== ${title} ===`)
}

function previewOutput(output: string, pattern?: RegExp): string[] {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)

  const filtered = pattern
    ? lines.filter((line) => {
        pattern.lastIndex = 0
        return pattern.test(line)
      })
    : lines

  return (filtered.length > 0 ? filtered : lines).slice(0, 10)
}

function countMatches(output: string, pattern?: RegExp): number {
  if (!pattern) {
    return 0
  }

  pattern.lastIndex = 0
  return output.match(pattern)?.length ?? 0
}

function runCheck(check: CheckDefinition): CheckResult {
  const cwd = check.cwd ? `${rootDir}/${check.cwd}` : rootDir
  const commandLabel = `bun ${check.args.join(' ')}`

  console.log(`\n  Running ${check.label}...`)

  const proc = Bun.spawnSync({
    cmd: [bunExe, ...check.args],
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      PATH: process.env.PATH ?? '',
    },
  })

  const stdout = proc.stdout ? new TextDecoder().decode(proc.stdout) : ''
  const stderr = proc.stderr ? new TextDecoder().decode(proc.stderr) : ''
  const output = `${stdout}${stderr}`
  const passed = proc.success

  if (passed) {
    console.log(`  PASS ${check.label}`)
  } else {
    console.log(`  FAIL ${check.label}`)
    console.log(`    Command: ${commandLabel}`)
    for (const line of previewOutput(output, check.errorPattern)) {
      console.log(`    ${line}`)
    }
  }

  return {
    label: check.label,
    passed,
    errorCount: countMatches(output, check.errorPattern),
  }
}

function runChecks(title: string, checks: CheckDefinition[]): CheckResult[] {
  printHeader(title)
  return checks.map(runCheck)
}

console.log('Project Health Check')
console.log(`Running quality checks for: ${requestedScope}`)
console.log(`Bun: ${bunExe}`)

const start = performance.now()
const results: CheckResult[] = []

if (requestedScope === 'all' || requestedScope === 'backend') {
  results.push(...runChecks('Backend Checks', backendChecks))
}

if (requestedScope === 'all' || requestedScope === 'frontend') {
  results.push(...runChecks('Frontend Checks', frontendChecks))
}

const durationSeconds = Math.round((performance.now() - start) / 1000)
const checksPassed = results.filter((result) => result.passed).length
const checksFailed = results.length - checksPassed
const totalErrors = results.reduce((sum, result) => sum + result.errorCount, 0)

printHeader('Summary')
console.log(`  Passed: ${checksPassed}`)
console.log(`  Failed: ${checksFailed}`)
console.log(`  Errors: ${totalErrors}`)
console.log(`  Time:   ${durationSeconds}s`)

if (checksFailed === 0) {
  console.log('\n  All checks passed!\n')
  process.exit(0)
}

console.log('\n  Some checks failed. Please fix the errors above.\n')
process.exit(1)
