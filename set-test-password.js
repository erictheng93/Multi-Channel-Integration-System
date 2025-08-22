import bcrypt from 'bcryptjs';

// Generate hash for password 'test123'
const password = 'test123';
const hash = bcrypt.hashSync(password, 10);

console.log('Password:', password);
console.log('Hash:', hash);
console.log('Verify:', bcrypt.compareSync(password, hash));

// For use in SQL (manually copy this)
console.log('\nFor SQL update:');
console.log(`UPDATE agents SET password_hash = '${hash}' WHERE id = 'test-agent-001';`);