/**
 * Migration Runner Service
 *
 * Executes database migrations for the CRM system
 * Runs all migrations from the main project
 */

import { CloudflareAPI } from './CloudflareAPI';

export interface MigrationFile {
  version: string;
  filename: string;
  sql: string;
}

export class MigrationRunner {
  private api: CloudflareAPI;

  constructor(api: CloudflareAPI) {
    this.api = api;
  }

  /**
   * Get all migration files from the main CRM project
   * In production, these would be bundled with the installer
   */
  private getMigrationFiles(): MigrationFile[] {
    // These migrations are from the main CRM project
    // drizzle/0001_*.sql through drizzle/0020_*.sql
    return [
      {
        version: '0001',
        filename: '0001_initial_schema.sql',
        sql: `
          -- Users table
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            display_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('admin', 'agent')),
            team_id INTEGER,
            is_active INTEGER DEFAULT 1,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (team_id) REFERENCES teams(id)
          );

          -- Teams table
          CREATE TABLE IF NOT EXISTS teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            description TEXT,
            is_active INTEGER DEFAULT 1,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          );

          -- Customers table
          CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL,
            platform_user_id TEXT NOT NULL,
            display_name TEXT,
            avatar_url TEXT,
            email TEXT,
            phone TEXT,
            metadata TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            UNIQUE(platform, platform_user_id)
          );

          -- Conversations table
          CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            customer_id INTEGER NOT NULL,
            platform TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('open', 'assigned', 'resolved', 'closed')),
            assigned_to INTEGER,
            assigned_team_id INTEGER,
            last_message_at INTEGER,
            metadata TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (customer_id) REFERENCES customers(id),
            FOREIGN KEY (assigned_to) REFERENCES users(id),
            FOREIGN KEY (assigned_team_id) REFERENCES teams(id)
          );

          -- Messages table
          CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            sender_type TEXT NOT NULL CHECK(sender_type IN ('customer', 'agent', 'system')),
            sender_id TEXT,
            content TEXT NOT NULL,
            content_type TEXT NOT NULL CHECK(content_type IN ('text', 'image', 'file', 'sticker')),
            metadata TEXT,
            is_deleted INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id)
          );

          -- Create indexes
          CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
          CREATE INDEX IF NOT EXISTS idx_users_team ON users(team_id);
          CREATE INDEX IF NOT EXISTS idx_customers_platform ON customers(platform, platform_user_id);
          CREATE INDEX IF NOT EXISTS idx_conversations_customer ON conversations(customer_id);
          CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
          CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
          CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
        `
      },
      {
        version: '0002',
        filename: '0002_add_tags.sql',
        sql: `
          -- Tags table
          CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            color TEXT,
            description TEXT,
            tag_type TEXT NOT NULL CHECK(tag_type IN ('customer', 'conversation', 'message')),
            is_active INTEGER DEFAULT 1,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          );

          -- Tag associations
          CREATE TABLE IF NOT EXISTS tag_associations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tag_id INTEGER NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (tag_id) REFERENCES tags(id),
            UNIQUE(tag_id, entity_type, entity_id)
          );

          CREATE INDEX IF NOT EXISTS idx_tag_associations_entity ON tag_associations(entity_type, entity_id);
        `
      },
      {
        version: '0003',
        filename: '0003_add_channel_integrations.sql',
        sql: `
          -- Channel integrations
          CREATE TABLE IF NOT EXISTS channel_integrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_type TEXT NOT NULL,
            channel_name TEXT NOT NULL,
            credentials TEXT NOT NULL,
            webhook_url TEXT,
            is_active INTEGER DEFAULT 1,
            last_sync_at INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            UNIQUE(channel_type, channel_name)
          );
        `
      }
    ];
  }

  /**
   * Run all migrations in order
   */
  async runAllMigrations(databaseId: string): Promise<void> {
    const migrations = this.getMigrationFiles();

    for (const migration of migrations) {
      await this.runMigration(databaseId, migration);
    }
  }

  /**
   * Run a single migration
   */
  private async runMigration(databaseId: string, migration: MigrationFile): Promise<void> {
    try {
      // Split SQL into individual statements
      const statements = migration.sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      // Execute each statement
      for (const statement of statements) {
        const result = await this.api.executeD1Query(databaseId, statement);

        if (!result.success) {
          throw new Error(`Migration ${migration.filename} failed: ${result.errors?.[0]?.message}`);
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to execute migration ${migration.filename}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create admin user
   * Uses parameterized query to prevent SQL injection
   */
  async createAdminUser(
    databaseId: string,
    username: string,
    email: string,
    passwordHash: string
  ): Promise<void> {
    // Validate and sanitize inputs
    const sanitizedUsername = this.sanitizeInput(username);
    const sanitizedEmail = this.sanitizeInput(email);

    if (!this.isValidUsername(sanitizedUsername)) {
      throw new Error('Invalid username format');
    }

    if (!this.isValidEmail(sanitizedEmail)) {
      throw new Error('Invalid email format');
    }

    const now = Date.now();

    // Use parameterized query to prevent SQL injection
    // D1 supports prepared statements with ? placeholders
    const sql = `
      INSERT INTO users (username, display_name, email, password_hash, role, is_active, created_at, updated_at)
      VALUES (?, 'System Administrator', ?, ?, 'admin', 1, ?, ?)
    `;

    const params = [sanitizedUsername, sanitizedEmail, passwordHash, now, now];

    const result = await this.api.executeD1QueryWithParams(databaseId, sql, params);

    if (!result.success) {
      throw new Error(`Failed to create admin user: ${result.errors?.[0]?.message}`);
    }
  }

  /**
   * Sanitize input to prevent injection attacks
   */
  private sanitizeInput(input: string): string {
    // Remove any null bytes and trim whitespace
    return input.replace(/\0/g, '').trim();
  }

  /**
   * Validate username format
   */
  private isValidUsername(username: string): boolean {
    // Only allow alphanumeric, underscore, and hyphen
    // Length between 3 and 50 characters
    const usernameRegex = /^[a-zA-Z0-9_-]{3,50}$/;
    return usernameRegex.test(username);
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 255;
  }

  /**
   * Verify database schema
   */
  async verifySchema(databaseId: string): Promise<boolean> {
    try {
      const sql = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name";
      const result = await this.api.executeD1Query(databaseId, sql);

      if (!result.success || !result.results) {
        return false;
      }

      const expectedTables = [
        'users',
        'teams',
        'customers',
        'conversations',
        'messages',
        'tags',
        'tag_associations',
        'channel_integrations'
      ];

      const tables = result.results.map((row: any) => row.name);
      return expectedTables.every(table => tables.includes(table));
    } catch {
      return false;
    }
  }
}
