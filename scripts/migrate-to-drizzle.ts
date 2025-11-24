// 遷移現有資料到 Drizzle schema
import { createDbClient, type Database } from '../src/db/drizzle-factory';
import * as schema from '../src/db/schema';

interface MigrationContext {
  db: D1Database;
  drizzleDb: Database;
}

export async function migrateToNewSchema(ctx: MigrationContext) {
  console.log('Starting migration to new Drizzle schema...');

  try {
    // 1. 遷移 users 資料
    await migrateUsers(ctx);
    
    // 2. 遷移 agents 資料
    await migrateAgents(ctx);
    
    // 3. 遷移 conversations 資料
    await migrateConversations(ctx);
    
    // 4. 遷移 messages 資料
    await migrateMessages(ctx);
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

async function migrateUsers(ctx: MigrationContext) {
  console.log('Migrating users...');
  
  // 從舊的 customers 表遷移到新的 users 表
  const oldCustomers = await ctx.db.prepare(`
    SELECT * FROM customers
  `).all();

  if (oldCustomers.results.length > 0) {
    for (const customer of oldCustomers.results) {
      await ctx.drizzleDb.insert(schema.users).values({
        id: customer.id as string,
        platformId: customer.platform_user_id as string,
        platform: customer.platform as string,
        displayName: customer.name as string,
        avatarUrl: customer.avatar_url as string,
        metadata: JSON.stringify({
          originalCustomerId: customer.id,
          migratedAt: new Date().toISOString(),
        }),
        createdAt: customer.created_at as string,
        updatedAt: customer.updated_at as string,
      }).onConflictDoNothing();
    }
  }

  console.log(`Migrated ${oldCustomers.results.length} users`);
}

async function migrateAgents(ctx: MigrationContext) {
  console.log('Migrating agents...');
  
  // 檢查是否已有 agents 資料
  const existingAgents = await ctx.db.prepare(`
    SELECT COUNT(*) as count FROM agents
  `).first();

  if ((existingAgents?.count as number) === 0) {
    // 建立預設管理員帳號
    const bcrypt = await import('bcryptjs');
    const defaultPasswordHash = await bcrypt.hash('admin123', 12);
    
    await ctx.drizzleDb.insert(schema.agents).values({
      id: 'admin-001',
      username: 'admin',
      email: 'admin@example.com',
      passwordHash: defaultPasswordHash,
      displayName: 'System Administrator',
      role: 'admin',
      isActive: true,
    });

    console.log('Created default admin account (username: admin, password: admin123)');
  }
}

async function migrateConversations(ctx: MigrationContext) {
  console.log('Migrating conversations...');
  
  const oldConversations = await ctx.db.prepare(`
    SELECT * FROM conversations
  `).all();

  if (oldConversations.results.length > 0) {
    for (const conversation of oldConversations.results) {
      await ctx.drizzleDb.insert(schema.conversations).values({
        id: conversation.id as string,
        userId: conversation.customer_id as string,
        agentId: conversation.assigned_to as string || null,
        platform: conversation.platform as string,
        status: mapConversationStatus(conversation.status as string),
        title: conversation.title as string,
        lastMessageAt: conversation.last_message_at as string,
        createdAt: conversation.created_at as string,
        updatedAt: conversation.updated_at as string,
      }).onConflictDoNothing();
    }
  }

  console.log(`Migrated ${oldConversations.results.length} conversations`);
}

async function migrateMessages(ctx: MigrationContext) {
  console.log('Migrating messages...');
  
  const oldMessages = await ctx.db.prepare(`
    SELECT * FROM messages
  `).all();

  if (oldMessages.results.length > 0) {
    for (const message of oldMessages.results) {
      await ctx.drizzleDb.insert(schema.messages).values({
        id: message.id as string,
        conversationId: message.conversation_id as string,
        senderId: message.sender_id as string,
        senderType: message.sender_type as 'user' | 'agent',
        messageType: message.message_type as string || 'text',
        content: message.content as string,
        metadata: message.metadata as string,
        platformMessageId: message.platform_message_id as string,
        replyToken: message.reply_token as string,
        isRead: Boolean(message.is_read),
        createdAt: message.created_at as string,
        updatedAt: message.updated_at as string,
      }).onConflictDoNothing();
    }
  }

  console.log(`Migrated ${oldMessages.results.length} messages`);
}

function mapConversationStatus(oldStatus: string): string {
  switch (oldStatus) {
    case 'open':
      return 'pending';
    case 'assigned':
      return 'in-progress';
    case 'closed':
      return 'closed';
    default:
      return 'pending';
  }
}

// 如果直接執行此腳本
if (import.meta.main) {
  console.log('This script should be run through the Cloudflare Worker environment');
  console.log('Use: wrangler dev --local and call the migration endpoint');
}