/**
 * Migration Runner Service
 *
 * Executes database migrations for the CRM system
 * Uses bundled migrations from the main project
 */

import { CloudflareAPI } from './CloudflareAPI';
import { BUNDLED_MIGRATIONS, getMigrationCount } from '../migrations/bundled-migrations';
import type { MigrationFile } from '../migrations/bundled-migrations';

export interface MigrationResult {
  success: boolean;
  migrationsRun: number;
  totalMigrations: number;
  errors: string[];
  duration: number;
}

export interface MigrationProgress {
  currentMigration: number;
  totalMigrations: number;
  currentVersion: string;
  currentDescription: string;
}

export class MigrationRunner {
  private api: CloudflareAPI;
  private onProgress?: (progress: MigrationProgress) => void;

  constructor(api: CloudflareAPI, onProgress?: (progress: MigrationProgress) => void) {
    this.api = api;
    this.onProgress = onProgress;
  }

  /**
   * Run all migrations in order
   */
  async runAllMigrations(databaseId: string): Promise<MigrationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let migrationsRun = 0;
    const totalMigrations = getMigrationCount();

    // First, create migrations tracking table if not exists
    await this.createMigrationsTable(databaseId);

    // Get already applied migrations
    const appliedMigrations = await this.getAppliedMigrations(databaseId);

    for (const migration of BUNDLED_MIGRATIONS) {
      // Skip if already applied
      if (appliedMigrations.includes(migration.version)) {
        migrationsRun++;
        continue;
      }

      // Report progress
      if (this.onProgress) {
        this.onProgress({
          currentMigration: migrationsRun + 1,
          totalMigrations,
          currentVersion: migration.version,
          currentDescription: migration.description
        });
      }

      try {
        await this.runMigration(databaseId, migration);
        await this.recordMigration(databaseId, migration);
        migrationsRun++;
      } catch (error) {
        const errorMessage = `Migration ${migration.version} (${migration.filename}) failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMessage);
        // Stop on first error to prevent cascading failures
        break;
      }
    }

    return {
      success: errors.length === 0,
      migrationsRun,
      totalMigrations,
      errors,
      duration: Date.now() - startTime
    };
  }

  /**
   * Create migrations tracking table
   */
  private async createMigrationsTable(databaseId: string): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS _migrations (
        version TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        description TEXT,
        applied_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const result = await this.api.executeD1Query(databaseId, sql);
    if (!result.success) {
      throw new Error('Failed to create migrations table');
    }
  }

  /**
   * Get list of already applied migrations
   */
  private async getAppliedMigrations(databaseId: string): Promise<string[]> {
    try {
      const sql = 'SELECT version FROM _migrations ORDER BY version';
      const result = await this.api.executeD1Query(databaseId, sql);

      if (!result.success || !result.results) {
        return [];
      }

      return (result.results as Array<{ version: string }>).map(row => row.version);
    } catch {
      return [];
    }
  }

  /**
   * Record a migration as applied
   */
  private async recordMigration(databaseId: string, migration: MigrationFile): Promise<void> {
    const sql = `
      INSERT INTO _migrations (version, filename, description)
      VALUES (?, ?, ?)
    `;
    const params = [migration.version, migration.filename, migration.description];

    await this.api.executeD1QueryWithParams(databaseId, sql, params);
  }

  /**
   * Run a single migration
   */
  private async runMigration(databaseId: string, migration: MigrationFile): Promise<void> {
    // Split SQL into individual statements
    const statements = this.splitSQLStatements(migration.sql);

    // Execute each statement
    for (const statement of statements) {
      const result = await this.api.executeD1Query(databaseId, statement);

      if (!result.success) {
        const errorMsg = result.errors?.[0]?.message || 'Unknown error';
        throw new Error(errorMsg);
      }
    }
  }

  /**
   * Split SQL into individual statements
   * Handles multi-line statements and comments
   */
  private splitSQLStatements(sql: string): string[] {
    return sql
      .split(';')
      .map(s => s.trim())
      .filter(s => {
        // Filter out empty statements and comments-only statements
        const withoutComments = s.replace(/--[^\n]*/g, '').trim();
        return withoutComments.length > 0;
      });
  }

  /**
   * Create admin user with secure password hashing
   * Uses PBKDF2 for password hashing (Web Crypto API compatible)
   */
  async createAdminUser(
    databaseId: string,
    email: string,
    password: string,
    displayName?: string
  ): Promise<{ userId: string; username: string }> {
    // Validate inputs
    if (!this.isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Generate user ID
    const userId = this.generateUUID();
    const username = email.split('@')[0];
    const adminDisplayName = displayName || 'System Administrator';

    // Hash password using PBKDF2
    const passwordHash = await this.hashPassword(password);

    // Insert admin user
    const sql = `
      INSERT INTO agents (id, email, password_hash, display_name, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'admin', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
    const params = [userId, email, passwordHash, adminDisplayName];

    const result = await this.api.executeD1QueryWithParams(databaseId, sql, params);

    if (!result.success) {
      const errorMsg = result.errors?.[0]?.message || 'Failed to create admin user';
      throw new Error(errorMsg);
    }

    return { userId, username };
  }

  /**
   * Hash password using PBKDF2
   * Compatible with Web Crypto API (Cloudflare Workers)
   */
  private async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );

    // Combine salt and hash for storage
    const hashArray = new Uint8Array(derivedBits);
    const combined = new Uint8Array(salt.length + hashArray.length);
    combined.set(salt);
    combined.set(hashArray, salt.length);

    // Return as base64 with prefix for identification
    return 'pbkdf2:' + this.arrayToBase64(combined);
  }

  /**
   * Convert Uint8Array to base64 string
   */
  private arrayToBase64(array: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < array.length; i++) {
      binary += String.fromCharCode(array[i]);
    }
    return btoa(binary);
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 255;
  }

  /**
   * Generate UUID v4
   */
  private generateUUID(): string {
    return crypto.randomUUID();
  }

  /**
   * Verify database schema is complete
   */
  async verifySchema(databaseId: string): Promise<{ valid: boolean; missingTables: string[] }> {
    const requiredTables = [
      'teams',
      'agents',
      'customers',
      'conversations',
      'messages',
      'delayed_messages',
      'file_attachments',
      'tags',
      'customer_tags',
      'conversation_tags',
      'notifications',
      'activities',
      'system_settings',
      'channel_integrations'
    ];

    try {
      const sql = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name";
      const result = await this.api.executeD1Query(databaseId, sql);

      if (!result.success || !result.results) {
        return { valid: false, missingTables: requiredTables };
      }

      const existingTables = (result.results as Array<{ name: string }>).map(row => row.name);
      const missingTables = requiredTables.filter(table => !existingTables.includes(table));

      return {
        valid: missingTables.length === 0,
        missingTables
      };
    } catch {
      return { valid: false, missingTables: requiredTables };
    }
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(databaseId: string): Promise<{
    applied: number;
    pending: number;
    versions: string[];
  }> {
    const appliedMigrations = await this.getAppliedMigrations(databaseId);
    const totalMigrations = getMigrationCount();

    return {
      applied: appliedMigrations.length,
      pending: totalMigrations - appliedMigrations.length,
      versions: appliedMigrations
    };
  }
}
