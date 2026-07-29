import { describe, expect, it } from 'vitest'
import { MessageCrudService } from '@modules/messaging/services/message-crud'

interface CapturedStatement {
  sql: string
  params: unknown[]
}

describe('MessageCrudService search visibility scope', () => {
  it('scopes count and result queries to visible, non-deleted messages', async () => {
    const statements: CapturedStatement[] = []
    const fakeDb = {
      prepare(sql: string) {
        const statement: CapturedStatement = { sql, params: [] }
        statements.push(statement)

        const prepared = {
          bind(...params: unknown[]) {
            statement.params = params
            return prepared
          },
          first() {
            return Promise.resolve({ count: 0 })
          },
          raw() {
            return Promise.resolve(sql.includes('count(*)') ? [[0]] : [])
          },
          all() {
            return Promise.resolve({ success: true, results: [] })
          }
        }

        return prepared
      }
    } as unknown as D1Database

    const service = new MessageCrudService(fakeDb)
    const user = {
      role: 'agent' as const,
      allowedTeamIds: [7, 9]
    }

    await service.searchMessages({ content: 'sentinel' }, user)

    expect(statements).toHaveLength(2)
    for (const statement of statements) {
      expect(statement.sql).toContain('from "conversations"')
      expect(statement.sql).toContain('"conversations"."assigned_team_id"')
      expect(statement.sql).toContain('"messages"."deleted_at" is null')
      expect(statement.params).toContain(JSON.stringify([7, 9]))
    }
  })
})
