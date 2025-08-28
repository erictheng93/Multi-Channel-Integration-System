#!/usr/bin/env npx tsx
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface TableInfo {
  name: string;
  columns: string[];
}

// Tables that exist in both environments
const TABLES_TO_SYNC = [
  'agents',
  'conversations', 
  'messages',
  'teams',
  'users',
  'delayed_messages',
  'file_attachments',
  'invitations'
];

// Tables only in remote (will be created if needed)
const REMOTE_ONLY_TABLES = [
  'customers',
  'system_settings',
  'activities'
];

function executeCommand(command: string): any {
  try {
    const result = execSync(command, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
    // Find the start of JSON output (starts with '[')
    const jsonStart = result.indexOf('[');
    if (jsonStart === -1) {
      console.error(`No JSON output found in command result`);
      return null;
    }
    const jsonString = result.substring(jsonStart);
    return JSON.parse(jsonString);
  } catch (error: any) {
    console.error(`Error executing command: ${command}`);
    console.error(`Error details: ${error.message}`);
    throw error;
  }
}

function getTableColumns(table: string, isRemote: boolean): string[] {
  const command = isRemote 
    ? `wrangler d1 execute DB --env dev --remote --command "PRAGMA table_info(${table});"`
    : `wrangler d1 execute DB --local --command "PRAGMA table_info(${table});"`;
  
  try {
    const result = executeCommand(command);
    if (result && result[0] && result[0].results) {
      return result[0].results.map((col: any) => col.name);
    }
  } catch (error) {
    console.log(`Table ${table} not found in ${isRemote ? 'remote' : 'local'} database`);
  }
  return [];
}

function getCommonColumns(table: string): string[] {
  const remoteColumns = getTableColumns(table, true);
  const localColumns = getTableColumns(table, false);
  
  if (remoteColumns.length === 0) {
    console.log(`Table ${table} doesn't exist in remote database`);
    return [];
  }
  
  if (localColumns.length === 0) {
    console.log(`Table ${table} doesn't exist in local database, will sync all columns`);
    return remoteColumns;
  }
  
  const common = remoteColumns.filter(col => localColumns.includes(col));
  console.log(`Table ${table}: ${common.length} common columns out of ${remoteColumns.length} remote / ${localColumns.length} local`);
  
  return common;
}

function exportTableData(table: string): any[] {
  const command = `wrangler d1 execute DB --env dev --remote --command "SELECT * FROM ${table};"`;
  
  try {
    const result = executeCommand(command);
    if (result && result[0] && result[0].results) {
      console.log(`Exported ${result[0].results.length} records from ${table}`);
      return result[0].results;
    }
  } catch (error) {
    console.error(`Error exporting data from ${table}`);
  }
  return [];
}

function createTableIfNotExists(table: string): void {
  // Get schema from remote
  const command = `wrangler d1 execute DB --env dev --remote --command "SELECT sql FROM sqlite_master WHERE type='table' AND name='${table}';"`;
  
  try {
    const result = executeCommand(command);
    if (result && result[0] && result[0].results && result[0].results.length > 0) {
      const createStatement = result[0].results[0].sql;
      // Execute create statement locally
      const createCommand = `wrangler d1 execute DB --local --command "${createStatement.replace(/"/g, '\\"')}"`;
      try {
        execSync(createCommand, { encoding: 'utf-8' });
        console.log(`Created table ${table} in local database`);
      } catch (error) {
        console.log(`Table ${table} might already exist or creation failed`);
      }
    }
  } catch (error) {
    console.error(`Error getting schema for ${table}`);
  }
}

function importTableData(table: string, data: any[], columns: string[]): void {
  if (data.length === 0) {
    console.log(`No data to import for ${table}`);
    return;
  }
  
  // Check if table exists locally, create if not
  const localColumns = getTableColumns(table, false);
  if (localColumns.length === 0) {
    console.log(`Creating table ${table} in local database...`);
    createTableIfNotExists(table);
  }
  
  // Clear existing data
  try {
    execSync(`wrangler d1 execute DB --local --command "DELETE FROM ${table};"`, { encoding: 'utf-8' });
    console.log(`Cleared existing data in local ${table}`);
  } catch (error) {
    console.log(`Could not clear ${table}, might be empty or have constraints`);
  }
  
  // Import data in batches
  const batchSize = 50;
  let importedCount = 0;
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, Math.min(i + batchSize, data.length));
    const values = batch.map(row => {
      const vals = columns.map(col => {
        const value = row[col];
        if (value === null || value === undefined) return 'NULL';
        if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
        if (typeof value === 'boolean') return value ? '1' : '0';
        return value;
      }).join(',');
      return `(${vals})`;
    }).join(',');
    
    const insertCommand = `wrangler d1 execute DB --local --command "INSERT INTO ${table} (${columns.join(',')}) VALUES ${values};"`;
    
    try {
      execSync(insertCommand, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
      importedCount += batch.length;
      console.log(`Imported ${importedCount}/${data.length} records into ${table}`);
    } catch (error: any) {
      console.error(`Error importing batch for ${table}: ${error.message}`);
      // Try individual inserts for failed batch
      for (const row of batch) {
        const vals = columns.map(col => {
          const value = row[col];
          if (value === null || value === undefined) return 'NULL';
          if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
          if (typeof value === 'boolean') return value ? '1' : '0';
          return value;
        }).join(',');
        
        const singleInsert = `wrangler d1 execute DB --local --command "INSERT INTO ${table} (${columns.join(',')}) VALUES (${vals});"`;
        try {
          execSync(singleInsert, { encoding: 'utf-8' });
          importedCount++;
        } catch (err) {
          console.log(`Failed to insert row in ${table}`);
        }
      }
    }
  }
  
  console.log(`✅ Successfully imported ${importedCount} records into ${table}`);
}

async function main() {
  console.log('==========================================');
  console.log('Remote Dev to Local Database Sync Script');
  console.log('==========================================\n');
  
  // First, sync tables that exist in both
  console.log('📊 Syncing common tables...\n');
  for (const table of TABLES_TO_SYNC) {
    console.log(`\n🔄 Processing table: ${table}`);
    console.log('-'.repeat(40));
    
    const commonColumns = getCommonColumns(table);
    if (commonColumns.length > 0) {
      const data = exportTableData(table);
      importTableData(table, data, commonColumns);
    } else {
      console.log(`Skipping ${table} - no common columns or table doesn't exist`);
    }
  }
  
  // Then, handle remote-only tables
  console.log('\n\n📊 Syncing remote-only tables...\n');
  for (const table of REMOTE_ONLY_TABLES) {
    console.log(`\n🔄 Processing remote-only table: ${table}`);
    console.log('-'.repeat(40));
    
    const remoteColumns = getTableColumns(table, true);
    if (remoteColumns.length > 0) {
      const data = exportTableData(table);
      importTableData(table, data, remoteColumns);
    }
  }
  
  console.log('\n==========================================');
  console.log('✨ Sync completed successfully!');
  console.log('==========================================');
}

// Run the sync
main().catch(console.error);