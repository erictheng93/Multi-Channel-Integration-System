import { isNull } from 'drizzle-orm'
import { messages } from './schema'

// For user-visible message reads. Cursor anchors and sequence allocation must
// still include deleted rows; raw SQL and table aliases need equivalent clauses.
export const notDeletedMessage = isNull(messages.deletedAt)
