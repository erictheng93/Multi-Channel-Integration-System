# Test Security Guidelines

## Environment Configuration

### Required Environment Variables
Create a `.env` file in the `tests/` directory with the following variables:

```bash
TEST_BASE_URL=http://localhost:8787
TEST_ADMIN_EMAIL=test-admin@example.com
TEST_ADMIN_PASSWORD=secure-test-password-123
TEST_AGENT_EMAIL=test-agent@example.com
TEST_AGENT_PASSWORD=secure-test-password-456
```

### Security Best Practices

1. **Never commit real credentials** to version control
2. **Use test-specific accounts** that don't have production access
3. **Rotate test credentials** regularly
4. **Use environment variables** for all configuration
5. **Sanitize error messages** to prevent information disclosure

### Test Account Setup

For testing, create dedicated test accounts with minimal privileges:
- Test accounts should only have access to test data
- Use strong, unique passwords for test accounts
- Regularly audit and rotate test credentials

### Running Tests Securely

```bash
# Load environment variables
export TEST_BASE_URL="http://localhost:8787"
export TEST_ADMIN_EMAIL="test-admin@example.com"
export TEST_ADMIN_PASSWORD="secure-test-password-123"
export TEST_AGENT_EMAIL="test-agent@example.com"
export TEST_AGENT_PASSWORD="secure-test-password-456"

# Run tests
node tests/verify-api-endpoints.js
```

## Security Checklist

- [ ] No hardcoded credentials in test files
- [ ] Environment variables used for configuration
- [ ] Test accounts have minimal privileges
- [ ] Error messages are sanitized
- [ ] Tests run against test environment only
- [ ] Credentials are rotated regularly