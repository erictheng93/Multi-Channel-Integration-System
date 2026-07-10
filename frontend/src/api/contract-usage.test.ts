import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const allowedTransportFiles = new Set([
  'src/api/contract-client.ts',
  'src/api/modern-contract-client.ts'
])

// Phase 1 modules that still call the transport clients directly because no
// typed contract exists yet in shared/api-contracts. Migrating them to
// callApiContract is deferred to Phase 2 - remove entries here once migrated.
const phase1PendingContract = new Set(['src/api/broadcasts.ts'])

const directTransportPattern =
  /\b(?:apiClient\.(?:get|post|put|delete|request|uploadFile|downloadFile)|modernApiClient\.(?:get|post|put|delete))\b/

function collectApiFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry)
    const stats = statSync(fullPath)

    if (stats.isDirectory()) {
      return collectApiFiles(fullPath)
    }

    if (!entry.endsWith('.ts') || entry.endsWith('.test.ts') || entry.endsWith('.d.ts')) {
      return []
    }

    return [fullPath]
  })
}

describe('API contract usage', () => {
  it('keeps direct API transports inside contract wrappers', () => {
    const apiRoot = join(process.cwd(), 'src/api')
    const violations = collectApiFiles(apiRoot).flatMap((filePath) => {
      // Normalize to forward slashes so the allowlists match on Windows too.
      const relativePath = relative(process.cwd(), filePath).split(sep).join('/')

      if (allowedTransportFiles.has(relativePath) || phase1PendingContract.has(relativePath)) {
        return []
      }

      return readFileSync(filePath, 'utf8')
        .split('\n')
        .flatMap((line, index) =>
          directTransportPattern.test(line) ? [`${relativePath}:${index + 1}`] : []
        )
    })

    expect(violations).toEqual([])
  })
})
