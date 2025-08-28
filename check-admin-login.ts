import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

// Connect to the local development database
const dbPath = path.join('.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject', 'dc23354e195c301b4778615a1d18f9e116936b7ddbf1fa5ed62c6ac8bb6640a8.sqlite');

try {
  const db = new Database(dbPath, { readonly: true });
  console.log(`Connected to LOCAL DEV database`);
  console.log(`Database path: ${dbPath}`);
  console.log('=' .repeat(80));
  
  // Check admin users
  const adminQuery = `SELECT id, email, password_hash, display_name, role, is_active FROM agents WHERE role = 'admin' OR email LIKE '%admin%' OR email LIKE '%dacit%'`;
  const admins = db.prepare(adminQuery).all();
  
  console.log(`\nFound ${admins.length} admin user(s):`);
  console.log('-'.repeat(80));
  
  for (const admin of admins) {
    console.log(`\nAdmin User:`);
    console.log(`  ID: ${admin.id}`);
    console.log(`  Email: ${admin.email}`);
    console.log(`  Display Name: ${admin.display_name}`);
    console.log(`  Role: ${admin.role}`);
    console.log(`  Active: ${admin.is_active}`);
    console.log(`  Password Hash: ${admin.password_hash?.substring(0, 30)}...`);
    
    // Test password verification
    const testPasswords = [
      '16011587DaC',
      'admin123',
      'password',
      'Admin123!',
      '123456'
    ];
    
    console.log(`\n  Testing passwords:`);
    for (const testPassword of testPasswords) {
      try {
        // Check if it's a bcrypt hash
        if (admin.password_hash?.startsWith('$2')) {
          const isValid = await bcrypt.compare(testPassword, admin.password_hash);
          if (isValid) {
            console.log(`    ✅ Password "${testPassword}" is VALID`);
          } else {
            console.log(`    ❌ Password "${testPassword}" is invalid`);
          }
        } else {
          console.log(`    ⚠️ Non-bcrypt hash format detected`);
        }
      } catch (err) {
        console.log(`    ⚠️ Error testing "${testPassword}": ${err}`);
      }
    }
  }
  
  // Check for specific email
  console.log('\n' + '='.repeat(80));
  console.log('Checking for admin@dacit.net specifically:');
  const dacitQuery = `SELECT * FROM agents WHERE email = 'admin@dacit.net'`;
  const dacitAdmin = db.prepare(dacitQuery).get();
  
  if (dacitAdmin) {
    console.log('✅ Found admin@dacit.net');
    console.log(dacitAdmin);
  } else {
    console.log('❌ admin@dacit.net NOT found in database');
    console.log('\nAll existing emails in agents table:');
    const allEmails = db.prepare('SELECT email, role FROM agents').all();
    allEmails.forEach(row => {
      console.log(`  - ${row.email} (${row.role})`);
    });
  }
  
  db.close();
} catch (error) {
  console.error('Error:', error);
}