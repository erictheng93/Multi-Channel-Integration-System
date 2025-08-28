import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

async function createDacitAdmin() {
  // Connect to the local development database
  const dbPath = path.join('.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject', 'dc23354e195c301b4778615a1d18f9e116936b7ddbf1fa5ed62c6ac8bb6640a8.sqlite');
  
  const db = new Database(dbPath, { readonly: false });
  console.log(`Connected to LOCAL DEV database`);
  console.log('=' .repeat(80));
  
  try {
    // Check if admin@dacit.net already exists
    const existing = db.prepare('SELECT id FROM agents WHERE email = ?').get('admin@dacit.net');
    
    if (existing) {
      console.log('Admin user admin@dacit.net already exists. Updating...');
      
      // Hash the password
      const passwordHash = await bcrypt.hash('16011587DaC', 12);
      
      // Update existing user
      const updateResult = db.prepare(`
        UPDATE agents 
        SET password_hash = ?, 
            display_name = ?,
            is_active = 1,
            updated_at = ?
        WHERE email = ?
      `).run(passwordHash, 'System Administrator', new Date().toISOString(), 'admin@dacit.net');
      
      console.log(`✅ Updated admin user with new password`);
      console.log(`   Rows affected: ${updateResult.changes}`);
    } else {
      console.log('Creating new admin user admin@dacit.net...');
      
      // Hash the password
      const passwordHash = await bcrypt.hash('16011587DaC', 12);
      const userId = 'admin-dacit-' + Date.now();
      const now = new Date().toISOString();
      
      // Insert new admin user
      const insertResult = db.prepare(`
        INSERT INTO agents (
          id, 
          email, 
          password_hash, 
          display_name, 
          role, 
          is_active,
          password_policy,
          created_at, 
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        'admin@dacit.net',
        passwordHash,
        'System Administrator',
        'admin',
        1,
        'changeable',
        now,
        now
      );
      
      console.log(`✅ Created new admin user`);
      console.log(`   ID: ${userId}`);
      console.log(`   Rows affected: ${insertResult.changes}`);
    }
    
    // Verify the user can be found and password works
    console.log('\n' + '='.repeat(80));
    console.log('Verifying admin@dacit.net:');
    
    const adminUser = db.prepare('SELECT * FROM agents WHERE email = ?').get('admin@dacit.net');
    if (adminUser) {
      console.log(`✅ User found:`);
      console.log(`   ID: ${adminUser.id}`);
      console.log(`   Email: ${adminUser.email}`);
      console.log(`   Display Name: ${adminUser.display_name}`);
      console.log(`   Role: ${adminUser.role}`);
      console.log(`   Active: ${adminUser.is_active}`);
      
      // Test password
      const passwordValid = await bcrypt.compare('16011587DaC', adminUser.password_hash);
      console.log(`   Password test: ${passwordValid ? '✅ VALID' : '❌ INVALID'}`);
    } else {
      console.log('❌ Failed to create/find user');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    db.close();
    console.log('\n✅ Database operation completed');
  }
}

// Run the script
createDacitAdmin().catch(console.error);