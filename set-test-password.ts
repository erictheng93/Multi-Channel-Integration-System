import bcrypt from 'bcryptjs'

interface PasswordTest {
  password: string
  agentId: string
}

// Generate hash for password 'test123'
function setTestPassword(): void {
  const testConfig: PasswordTest = {
    password: 'test123',
    agentId: 'test-agent-001'
  }
  
  const hash: string = bcrypt.hashSync(testConfig.password, 10)
  const isValid: boolean = bcrypt.compareSync(testConfig.password, hash)

  console.log('Password:', testConfig.password)
  console.log('Hash:', hash)
  console.log('Verify:', isValid)

  // For use in SQL (manually copy this)
  console.log('\nFor SQL update:')
  console.log(`UPDATE agents SET password_hash = '${hash}' WHERE id = '${testConfig.agentId}';`)
}

setTestPassword()