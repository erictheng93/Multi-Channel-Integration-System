import bcrypt from 'bcryptjs'

interface AgentSeed {
  id: string
  username: string
  email: string
  password: string
  displayName: string
  role: 'admin' | 'manager' | 'agent'
  passwordPolicy: 'changeable' | 'unchangeable' | 'must_change'
}

// 生成密碼哈希
const agents: AgentSeed[] = [
  {
    id: 'admin-001',
    username: 'admin',
    email: 'admin@dacit.net',
    password: '16011587DaC',
    displayName: 'System Administrator',
    role: 'admin',
    passwordPolicy: 'changeable'
  },
  {
    id: 'test-agent-001',
    username: 'test',
    email: 'test@dacit.net',
    password: 'test123',
    displayName: 'Test User',
    role: 'agent',
    passwordPolicy: 'must_change'
  }
]

function generateSQLStatements(): void {
  console.log('--- SQL INSERT STATEMENTS ---')
  
  agents.forEach(agent => {
    const passwordHash: string = bcrypt.hashSync(agent.password, 10)
    console.log(`${agent.role} password hash:`, passwordHash)
    
    const sql = `INSERT INTO agents (id, username, email, password_hash, display_name, role, is_active, password_policy, created_at, updated_at) VALUES ('${agent.id}', '${agent.username}', '${agent.email}', '${passwordHash}', '${agent.displayName}', '${agent.role}', 1, '${agent.passwordPolicy}', datetime('now'), datetime('now'));`
    
    console.log(sql)
    console.log()
  })
}

generateSQLStatements()