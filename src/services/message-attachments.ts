import { and, eq, getTableColumns, inArray, isNull, or, sql } from 'drizzle-orm';
import { SQLiteAsyncDialect } from 'drizzle-orm/sqlite-core';
import type { Database } from '@/db/drizzle-factory';
import { fileAttachments, messages } from '@/db/schema';

/** Claim all uploads with the message in one D1 transaction, including race revalidation. */
export async function insertMessageWithAttachments(
  d1: D1Database,
  db: Database,
  message: typeof messages.$inferInsert,
  attachmentIds: unknown,
  uploadedBy: string
): Promise<void> {
  if (attachmentIds === undefined || (Array.isArray(attachmentIds) && !attachmentIds.length)) {
    await db.insert(messages).values(message);
    return;
  }
  if (!Array.isArray(attachmentIds) || attachmentIds.length > 10 ||
      attachmentIds.some(id => typeof id !== 'string' || !id) ||
      new Set(attachmentIds).size !== attachmentIds.length) {
    throw Object.assign(new Error('Invalid attachments'), { status: 400 });
  }
  const ids = attachmentIds as string[];
  const eligible = and(
    inArray(fileAttachments.id, ids),
    eq(fileAttachments.uploadedBy, uploadedBy),
    isNull(fileAttachments.messageId),
    or(isNull(fileAttachments.conversationId), eq(fileAttachments.conversationId, message.conversationId))
  );
  const attachments = await db.select().from(fileAttachments).where(eligible).all();
  if (attachments.length !== ids.length || attachments.some(file =>
    !ids.includes(file.id) || file.uploadedBy !== uploadedBy || file.messageId !== null ||
    (file.conversationId !== null && file.conversationId !== message.conversationId))) {
    throw Object.assign(new Error('Invalid attachments'), { status: 400 });
  }

  const columns = getTableColumns(messages);
  const entries = Object.entries(message).filter(([, value]) => value !== undefined);
  const insert = sql`insert into ${messages} (${sql.join(entries.map(([key]) =>
    sql.identifier(columns[key as keyof typeof columns].name)), sql`, `)})
    select ${sql.join(entries.map(([, value]) => sql`${typeof value === 'boolean' ? Number(value) : value}`), sql`, `)}
    where (select count(*) from ${fileAttachments} where ${eligible}) = ${ids.length}`;
  const update = sql`update ${fileAttachments} set message_id = ${message.id}, conversation_id = ${message.conversationId}
    where ${eligible} and exists (select 1 from ${messages} where ${messages.id} = ${message.id})`;
  const dialect = new SQLiteAsyncDialect();
  const statements = [insert, update].map(statement => {
    const query = dialect.sqlToQuery(statement);
    return d1.prepare(query.sql).bind(...query.params);
  });
  const [created, claimed] = await d1.batch(statements);
  if (created.meta.changes !== 1 || claimed.meta.changes !== ids.length) {
    throw Object.assign(new Error('Attachments are no longer available'), { status: 400 });
  }
}
