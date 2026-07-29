import { describe, expect, it } from 'vitest'
import { MessageCrudService } from '@modules/messaging/services/message-crud'

interface CapturedStatement {
  sql: string
  params: unknown[]
}

describe('MessageCrudService search visibility scope', () => {
  it('binds the same visible conversation scope into count and result queries', async () => {
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
    const visibleConversationIds = ['conv-a', 'conv-b']

    await service.searchMessages({ content: 'sentinel' }, visibleConversationIds)

    expect(statements).toHaveLength(2)
    for (const statement of statements) {
      expect(statement.sql).toContain('json_each(?)')
      expect(statement.params).toContain(JSON.stringify(visibleConversationIds))
    }
  })
})
