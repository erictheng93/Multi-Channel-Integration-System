import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const allowedTransportFiles = new Set([
  'src/api/contract-client.ts',
  'src/api/modern-contract-client.ts'
])

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
      const relativePath = relative(process.cwd(), filePath)

      if (allowedTransportFiles.has(relativePath)) {
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
