import bcrypt from 'bcryptjs';

/**
 * Password hashing utility for generating bcrypt hashes
 * Used for creating password hashes for new agents or password resets
 */

const SALT_ROUNDS = 12;

/**
 * Validate password meets security requirements
 * @param password - The password to validate
 * @throws Error if password doesn't meet requirements
 */
function validatePassword(password: string): void {
  if (!password || typeof password !== 'string') {
    throw new Error('Password is required and must be a string');
  }
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }
  if (password.length > 128) {
    throw new Error('Password too long (max 128 characters)');
  }
}

/**
 * Generate a bcrypt hash for a password
 * @param password - The plain text password to hash
 * @returns Promise<string> - The bcrypt hash
 */
export async function generatePasswordHash(password: string): Promise<string> {
  validatePassword(password);
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 * @param password - The plain text password
 * @param hash - The bcrypt hash to compare against
 * @returns Promise<boolean> - True if password matches hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/**
 * Generate hash for multiple passwords (useful for batch operations)
 * @param passwords - Array of objects with name and password
 * @returns Promise<Array> - Array of objects with name and hash (password excluded for security)
 */
export async function generateMultipleHashes(
  passwords: Array<{ name: string; password: string }>
): Promise<Array<{ name: string; hash: string }>> {
  const results = [];
  
  for (const { name, password } of passwords) {
    const hash = await generatePasswordHash(password);
    results.push({ name, hash }); // Don't return plain password
  }
  
  return results;
}

/**
 * CLI utility function for generating hashes (for development use only)
 * WARNING: This function logs passwords - should not be used in production
 */
export async function generateHashCLI(password?: string): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('generateHashCLI should not be used in production');
  }
  
  if (!password) {
    throw new Error('A password argument is required');
  }

  const targetPassword = password;
  
  try {
    const hash = await generatePasswordHash(targetPassword);
    console.log('Password hash generated successfully');
    console.log('Hash:', hash);
    
    // Verify the hash
    const isValid = await verifyPassword(targetPassword, hash);
    console.log('Verification:', isValid);
  } catch (error) {
    console.error('Error generating hash:', error);
  }
}

/**
 * CLI utility function for generating multiple hashes (for development use only)
 * WARNING: This function logs passwords - should not be used in production
 */
export async function generateMultipleHashesCLI(
  passwords: Array<{ name: string; password: string }>
): Promise<Array<{ name: string; password: string; hash: string }>> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('generateMultipleHashesCLI should not be used in production');
  }
  
  const results = [];
  
  for (const { name, password } of passwords) {
    const hash = await generatePasswordHash(password);
    results.push({ name, password, hash }); // Include password for CLI display
  }
  
  return results;
}

// Export for use in other modules
