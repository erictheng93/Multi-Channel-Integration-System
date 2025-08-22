// 測試登入
import bcrypt from 'bcryptjs'

interface LoginTest {
  password: string
  saltRounds: number
}

async function testPassword(): Promise<void> {
  const testConfig: LoginTest = {
    password: '16011587DaC',
    saltRounds: 12
  }
  
  try {
    const hash: string = await bcrypt.hash(testConfig.password, testConfig.saltRounds)
    console.log('New hash:', hash)
    
    const isValid: boolean = await bcrypt.compare(testConfig.password, hash)
    console.log('Verification:', isValid)
  } catch (error: unknown) {
    console.error('Error during password test:', error instanceof Error ? error.message : String(error))
  }
}

testPassword()