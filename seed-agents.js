import bcrypt from 'bcryptjs';

// Generate password hashes
const adminHash = bcrypt.hashSync('16011587DaC', 10);
const testHash = bcrypt.hashSync('test123', 10);

console.log('Admin password hash:', adminHash);
console.log('Test password hash:', testHash);

// SQL statements to insert agents
console.log('\n--- SQL INSERT STATEMENTS ---');
console.log(`INSERT INTO agents (id, username, email, password_hash, display_name, role, is_active, password_policy, created_at, updated_at) VALUES ('admin-001', 'admin', 'admin@dacit.net', '${adminHash}', 'System Administrator', 'admin', 1, 'changeable', datetime('now'), datetime('now'));`);

console.log(`INSERT INTO agents (id, username, email, password_hash, display_name, role, is_active, password_policy, created_at, updated_at) VALUES ('test-agent-001', 'test', 'test@dacit.net', '${testHash}', 'Test User', 'agent', 1, 'must_change', datetime('now'), datetime('now'));`);