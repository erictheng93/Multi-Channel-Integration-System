import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { agents } from './src/db/schema';
import path from 'path';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';

async function createDacitAdmin() {
  // Connect to the local development database
  const dbPath = path.join('.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject', 'dc23354e195c301b4778615a1d18f9e116936b7ddbf1fa5ed62c6ac8bb6640a8.sqlite');

  const sqliteDb = new Database(dbPath, { readonly: false });
  // Use better-sqlite3 adapter with casing configuration
  const db = drizzle(sqliteDb, {
    casing: 'camelCase' // ✅ Unified casing configuration
  });
  console.log(`Connected to LOCAL DEV database`);
  console.log('=' .repeat(80));
  
  try {
    // Check if admin@dacit.net already exists
    const existing = await db.select({ id: agents.id })
      .from(agents)
      .where(eq(agents.email, 'admin@dacit.net'))
      .get();
    
    if (existing) {
      console.log('Admin user admin@dacit.net already exists. Updating...');
      
      // Hash the password
      const passwordHash = await bcrypt.hash('16011587DaC', 12);
      
      // Update existing user
      const updateResult = await db.update(agents)
        .set({
          passwordHash,
          displayName: 'System Administrator',
          isActive: true,
          updatedAt: new Date().toISOString()
        })
        .where(eq(agents.email, 'admin@dacit.net'));
      
      console.log(`✅ Updated admin user with new password`);
      console.log(`   Update completed successfully`);
    } else {
      console.log('Creating new admin user admin@dacit.net...');
      
      // Hash the password
      const passwordHash = await bcrypt.hash('16011587DaC', 12);
      const userId = 'admin-dacit-' + Date.now();
      const now = new Date().toISOString();
      
      // Insert new admin user
      await db.insert(agents).values({
        id: userId,
        email: 'admin@dacit.net',
        passwordHash,
        displayName: 'System Administrator',
        role: 'admin',
        isActive: true,
        passwordPolicy: 'changeable',
        createdAt: now,
        updatedAt: now
      });
      
      console.log(`✅ Created new admin user`);
      console.log(`   ID: ${userId}`);
      console.log(`   Insert completed successfully`);
    }
    
    // Verify the user can be found and password works
    console.log('\n' + '='.repeat(80));
    console.log('Verifying admin@dacit.net:');
    
    const adminUser = await db.select()
      .from(agents)
      .where(eq(agents.email, 'admin@dacit.net'))
      .get();
    if (adminUser) {
      console.log(`✅ User found:`);
      console.log(`   ID: ${adminUser.id}`);
      console.log(`   Email: ${adminUser.email}`);
      console.log(`   Display Name: ${adminUser.displayName}`);
      console.log(`   Role: ${adminUser.role}`);
      console.log(`   Active: ${adminUser.isActive}`);
      
      // Test password
      const passwordValid = await bcrypt.compare('16011587DaC', adminUser.passwordHash);
      console.log(`   Password test: ${passwordValid ? '✅ VALID' : '❌ INVALID'}`);
    } else {
      console.log('❌ Failed to create/find user');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    sqliteDb.close();
    console.log('\n✅ Database operation completed');
  }
}

// Run the script
createDacitAdmin().catch(console.error);