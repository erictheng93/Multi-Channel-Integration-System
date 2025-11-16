import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from '@backend/db/schema'
import { sql } from 'drizzle-orm'
import { vi } from 'vitest'

/**
 * In-memory SQLite database for integration testing
 *
 * Provides a real database environment for testing database logic
 * without the complexity of mocking Drizzle ORM internals.
 *
 * @example
 * ```typescript
 * const env = new DatabaseTestEnvironment()
 *
 * // Insert test data
 * await env.db.insert(customers).values({
 *   platform: 'line',
 *   platformUserId: 'U123'
 * })
 *
 * // Test your functions
 * const customer = await findOrCreateCustomer(env.db, 'line', 'U123')
 *
 * env.close()
 * ```
 */
export class DatabaseTestEnvironment {
  private sqlite: Database.Database
  public db: BetterSQLite3Database<typeof schema>
  private mockD1Database: any
  private idCounter: number = 0 // Counter for unique ID generation

  constructor() {
    // Create in-memory SQLite database
    this.sqlite = new Database(':memory:')

    // Initialize Drizzle with schema
    this.db = drizzle(this.sqlite, { schema })

    // Create a mock D1Database that returns our Drizzle instance
    this.mockD1Database = this.createMockD1Database()

    // Setup mock for drizzle-orm/d1
    this.setupDrizzleMock()

    // Create tables
    this.setupSchema()
  }

  /**
   * Create a mock D1Database object
   * This allows database.ts functions to work with our in-memory database
   */
  private createMockD1Database(): D1Database {
    return {
      prepare: (query: string) => {
        // Forward to better-sqlite3
        const stmt = this.sqlite.prepare(query)
        return {
          bind: (...values: any[]) => {
            // better-sqlite3 doesn't have a separate bind method
            // Store the values for later use
            return {
              run: () => stmt.run(...values),
              first: () => stmt.get(...values),
              all: () => ({ results: stmt.all(...values) }),
              raw: () => stmt.raw(true).all(...values)
            }
          },
          run: () => stmt.run(),
          first: () => stmt.get(),
          all: () => ({ results: stmt.all() }),
          raw: () => stmt.raw(true).all()
        } as any
      },
      dump: () => Promise.resolve(new ArrayBuffer(0)),
      batch: (statements: any[]) => Promise.resolve([]),
      exec: (query: string) => Promise.resolve({ count: 0, duration: 0 })
    } as D1Database
  }

  /**
   * Setup mock for drizzle-orm/d1 to return our Drizzle instance
   * This is done at the module level in test files
   */
  private setupDrizzleMock() {
    // This will be set up in the test file
  }

  /**
   * Get the mock D1Database instance
   * Use this when calling database.ts functions
   */
  getMockD1Database(): D1Database {
    return this.mockD1Database
  }

  /**
   * Get the Drizzle instance for this environment
   * Used by drizzle-orm/d1 mock
   */
  getDrizzleInstance() {
    return this.db
  }

  /**
   * Create all necessary database tables
   * Based on schema.ts definitions
   */
  private setupSchema() {
    // Create tables in correct order (respecting foreign keys)

    // 1. Teams table (no dependencies)
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        qr_code TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // 2. Agents table (depends on teams)
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'agent',
        team_id INTEGER REFERENCES teams(id),
        is_active INTEGER DEFAULT 1,
        password_policy TEXT DEFAULT 'changeable',
        last_active TEXT,
        last_login_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // 3. Customers table (depends on teams)
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY,
        platform TEXT NOT NULL,
        platform_user_id TEXT NOT NULL,
        display_name TEXT,
        avatar_url TEXT,
        email TEXT,
        phone TEXT,
        source_team_id INTEGER REFERENCES teams(id),
        metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(platform, platform_user_id)
      );
    `)

    // 4. Conversations table (depends on customers, teams, agents)
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(id),
        assigned_team_id INTEGER REFERENCES teams(id),
        assigned_user_id TEXT REFERENCES agents(id),
        status TEXT NOT NULL DEFAULT 'active',
        priority TEXT DEFAULT 'normal',
        first_response_at TEXT,
        closed_at TEXT,
        internal_notes TEXT,
        last_message_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // 5. Messages table (depends on conversations, customers, agents)
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id),
        sender_type TEXT NOT NULL,
        customer_sender_id INTEGER REFERENCES customers(id),
        agent_sender_id TEXT REFERENCES agents(id),
        content TEXT NOT NULL,
        message_type TEXT NOT NULL,
        platform_message_id TEXT,
        is_recalled INTEGER DEFAULT 0,
        recall_deadline TEXT,
        recalled_at TEXT,
        is_sent INTEGER DEFAULT 0,
        sent_at TEXT,
        delivery_status TEXT,
        reply_to_message_id TEXT REFERENCES messages(id),
        thread_id TEXT,
        session_id TEXT,
        session_sequence INTEGER,
        metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // 6. Delayed Messages table (depends on conversations, agents)
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS delayed_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id),
        agent_id TEXT NOT NULL REFERENCES agents(id),
        content TEXT NOT NULL,
        message_type TEXT NOT NULL DEFAULT 'text',
        scheduled_at TEXT NOT NULL,
        sent_at TEXT,
        cancelled_at TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // 7. Message Recall Logs table (depends on messages, agents)
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS message_recall_logs (
        id INTEGER PRIMARY KEY,
        message_id TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES agents(id),
        action TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // 8. Activities table (depends on agents for audit trail)
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES agents(id),
        user_name TEXT NOT NULL,
        user_role TEXT NOT NULL,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT,
        details TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // 9. System Settings table (no dependencies)
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // 10. Tags table (no dependencies)
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        color TEXT,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // 11. Conversation Tags junction table
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS conversation_tags (
        conversation_id TEXT NOT NULL REFERENCES conversations(id),
        tag_id INTEGER NOT NULL REFERENCES tags(id),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (conversation_id, tag_id)
      );
    `)

    // 12. Message Tags junction table
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS message_tags (
        message_id TEXT NOT NULL REFERENCES messages(id),
        tag_id INTEGER NOT NULL REFERENCES tags(id),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (message_id, tag_id)
      );
    `)

    // 13. Reports table (depends on teams, agents)
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        format TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_by TEXT NOT NULL REFERENCES agents(id),
        team_id INTEGER REFERENCES teams(id),
        time_range TEXT,
        start_date TEXT,
        end_date TEXT,
        filters TEXT,
        options TEXT,
        generation_started_at TEXT,
        completed_at TEXT,
        failed_at TEXT,
        error_message TEXT,
        execution_time INTEGER,
        download_url TEXT,
        file_size INTEGER,
        file_hash TEXT,
        downloaded_count INTEGER DEFAULT 0,
        last_downloaded_at TEXT,
        expires_at TEXT,
        deleted_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // Create useful indexes for testing performance
    this.sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_customers_platform_user ON customers(platform, platform_user_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_customer ON conversations(customer_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
    `)
  }

  /**
   * Reset database by clearing all tables
   * Useful for test isolation
   */
  reset() {
    // Get all table names
    const tables = this.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[]

    // Disable foreign keys temporarily for clean deletion
    this.sqlite.exec('PRAGMA foreign_keys = OFF;')

    // Clear all tables
    for (const { name } of tables) {
      this.sqlite.prepare(`DELETE FROM ${name}`).run()
    }

    // Re-enable foreign keys
    this.sqlite.exec('PRAGMA foreign_keys = ON;')

    // Reset autoincrement sequences
    this.sqlite.exec("DELETE FROM sqlite_sequence;")
  }

  /**
   * Helper: Insert test data into any table
   */
  async insertTestData<T extends keyof typeof schema>(
    table: T,
    data: any | any[]
  ) {
    const tableRef = schema[table] as any
    if (Array.isArray(data)) {
      await this.db.insert(tableRef).values(data)
    } else {
      await this.db.insert(tableRef).values(data)
    }
  }

  /**
   * Helper: Create a test team
   */
  async createTestTeam(overrides?: Partial<typeof schema.teams.$inferInsert>) {
    const [team] = await this.db.insert(schema.teams).values({
      name: 'Test Team',
      description: 'Test team for integration tests',
      isActive: true,
      ...overrides
    }).returning()
    return team
  }

  /**
   * Helper: Create a test customer
   */
  async createTestCustomer(overrides?: Partial<typeof schema.customers.$inferInsert>) {
    const [customer] = await this.db.insert(schema.customers).values({
      platform: 'line',
      platformUserId: `U${Date.now()}`,
      displayName: 'Test User',
      ...overrides
    }).returning()
    return customer
  }

  /**
   * Helper: Create a test agent
   */
  async createTestAgent(overrides?: Partial<typeof schema.agents.$inferInsert>) {
    this.idCounter++
    const [agent] = await this.db.insert(schema.agents).values({
      id: `agent-${Date.now()}-${this.idCounter}`,
      email: `test${Date.now()}-${this.idCounter}@example.com`,
      passwordHash: 'test-hash',
      displayName: 'Test Agent',
      role: 'agent',
      isActive: true,
      ...overrides
    }).returning()
    return agent
  }

  /**
   * Helper: Create a test conversation
   */
  async createTestConversation(
    customerId: number,
    overrides?: Partial<typeof schema.conversations.$inferInsert>
  ) {
    this.idCounter++
    const [conversation] = await this.db.insert(schema.conversations).values({
      id: `conv-${Date.now()}-${this.idCounter}`,
      customerId,
      status: 'active',
      priority: 'normal',
      ...overrides
    }).returning()
    return conversation
  }

  /**
   * Helper: Create a test message
   */
  async createTestMessage(
    conversationId: string,
    overrides?: Partial<typeof schema.messages.$inferInsert>
  ) {
    this.idCounter++
    const [message] = await this.db.insert(schema.messages).values({
      id: `msg-${Date.now()}-${this.idCounter}`,
      conversationId,
      senderType: 'customer',
      content: 'Test message',
      messageType: 'text',
      isSent: true,
      deliveryStatus: 'delivered',
      ...overrides
    }).returning()
    return message
  }

  /**
   * Close the database connection
   */
  close() {
    this.sqlite.close()
  }
}
