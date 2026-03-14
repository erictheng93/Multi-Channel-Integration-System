#!/usr/bin/env npx tsx
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface SyncTarget {
  name: string;
  env: string;
  databaseId: string;
}

const SYNC_TARGETS: SyncTarget[] = [
  { name: 'Development', env: 'dev', databaseId: '3b7339f0-80de-49dc-b079-312df4a4c316' },
  { name: 'Production', env: 'production', databaseId: '08ae6790-2494-40a8-a07a-df3920783159' }
];

const TABLES_TO_SYNC = [
  'teams',
  'agents',
  'users',
  'customers',
  'conversations',
  'messages',
  'delayed_messages',
  'file_attachments',
  'invitations',
  'activities',
  'system_settings'
];

function executeCommand(command: string): any {
  try {
    const result = execSync(command, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
    const jsonStart = result.indexOf('[');
    if (jsonStart === -1) {
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

function getTableSchema(table: string): string | null {
  const command = `wrangler d1 execute DB --local --command "SELECT sql FROM sqlite_master WHERE type='table' AND name='${table}';"`;
  
  try {
    const result = executeCommand(command);
    if (result && result[0] && result[0].results && result[0].results.length > 0) {
      return result[0].results[0].sql;
    }
  } catch (error) {
    console.error(`Error getting schema for ${table}`);
  }
  return null;
}

function getTableData(table: string): any[] {
  const command = `wrangler d1 execute DB --local --command "SELECT * FROM ${table};"`;
  
  try {
    const result = executeCommand(command);
    if (result && result[0] && result[0].results) {
      return result[0].results;
    }
  } catch (error) {
    console.error(`Error getting data from ${table}`);
  }
  return [];
}

function dropTableIfExists(table: string, target: SyncTarget): void {
  const envFlag = target.env === 'production' ? '--remote' : `--env ${target.env} --remote`;
  const command = `wrangler d1 execute DB ${envFlag} --command "DROP TABLE IF EXISTS ${table};"`;
  
  try {
    execSync(command, { encoding: 'utf-8' });
    console.log(` Dropped existing table ${table} in ${target.name}`);
  } catch (error) {
    console.log(` Could not drop table ${table} in ${target.name} (might not exist)`);
  }
}

function createTable(table: string, schema: string, target: SyncTarget): boolean {
  const envFlag = target.env === 'production' ? '--remote' : `--env ${target.env} --remote`;
  // Escape quotes in schema for command line
  const escapedSchema = schema.replace(/"/g, '\\"').replace(/\n/g, ' ').replace(/\r/g, '');
  const command = `wrangler d1 execute DB ${envFlag} --command "${escapedSchema}"`;
  
  try {
    execSync(command, { encoding: 'utf-8' });
    console.log(` Created table ${table} in ${target.name}`);
    return true;
  } catch (error: any) {
    console.error(` Failed to create table ${table} in ${target.name}: ${error.message}`);
    return false;
  }
}

function insertData(table: string, data: any[], target: SyncTarget): void {
  if (data.length === 0) {
    console.log(` No data to sync for ${table}`);
    return;
  }

  const envFlag = target.env === 'production' ? '--remote' : `--env ${target.env} --remote`;
  const batchSize = 50;
  let insertedCount = 0;
  let failedCount = 0;

  // Get column names from first row
  const columns = Object.keys(data[0]);

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, Math.min(i + batchSize, data.length));
    
    // Build INSERT statement
    const values = batch.map(row => {
      const vals = columns.map(col => {
        const value = row[col];
        if (value === null || value === undefined) return 'NULL';
        if (typeof value === 'string') {
          // Escape single quotes and handle special characters
          return `'${value.replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
        }
        if (typeof value === 'boolean') return value ? '1' : '0';
        return value;
      }).join(',');
      return `(${vals})`;
    }).join(',');

    const insertCommand = `wrangler d1 execute DB ${envFlag} --command "INSERT INTO ${table} (${columns.join(',')}) VALUES ${values};"`;

    try {
      execSync(insertCommand, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
      insertedCount += batch.length;
      process.stdout.write(`\r  → Inserting data: ${insertedCount}/${data.length} records`);
    } catch (error: any) {
      // Try individual inserts for failed batch
      for (const row of batch) {
        const vals = columns.map(col => {
          const value = row[col];
          if (value === null || value === undefined) return 'NULL';
          if (typeof value === 'string') {
            return `'${value.replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
          }
          if (typeof value === 'boolean') return value ? '1' : '0';
          return value;
        }).join(',');

        const singleInsert = `wrangler d1 execute DB ${envFlag} --command "INSERT INTO ${table} (${columns.join(',')}) VALUES (${vals});"`;
        
        try {
          execSync(singleInsert, { encoding: 'utf-8' });
          insertedCount++;
          process.stdout.write(`\r  → Inserting data: ${insertedCount}/${data.length} records`);
        } catch (err) {
          failedCount++;
        }
      }
    }
  }

  console.log(`\n Inserted ${insertedCount} records, ${failedCount} failed`);
}

async function syncToTarget(target: SyncTarget) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(` Syncing to ${target.name} Environment`);
  console.log(`${'='.repeat(50)}\n`);

  for (const table of TABLES_TO_SYNC) {
    console.log(`\n Processing table: ${table}`);
    console.log(`${'-'.repeat(30)}`);

    // Step 1: Get local table schema
    const schema = getTableSchema(table);
    if (!schema) {
      console.log(` Table ${table} doesn't exist locally, skipping`);
      continue;
    }

    // Step 2: Get local table data
    const data = getTableData(table);
    console.log(` Found ${data.length} records in local database`);

    // Step 3: Drop existing table in remote
    dropTableIfExists(table, target);

    // Step 4: Create table in remote
    const created = createTable(table, schema, target);
    if (!created) {
      console.log(` Skipping data sync for ${table} due to schema creation failure`);
      continue;
    }

    // Step 5: Insert data into remote
    insertData(table, data, target);
  }

  console.log(`\n Sync to ${target.name} completed!`);
}

async function main() {
  console.log('==========================================');
  console.log('Local to Remote Database Sync Script');
  console.log('==========================================\n');

  console.log(' Tables to sync:');
  TABLES_TO_SYNC.forEach(table => console.log(`  - ${table}`));

  for (const target of SYNC_TARGETS) {
    await syncToTarget(target);
  }

  console.log('\n==========================================');
  console.log(' All synchronization completed!');
  console.log('==========================================');
}

// Run the sync
main().catch(console.error);