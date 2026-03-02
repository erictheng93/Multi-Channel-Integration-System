# Database Fix Script for LINE Webhook
# PowerShell script to fix database schema issues

Write-Host "🔧 Applying database fixes..." -ForegroundColor Yellow

# 1. Add profile_updated_at column to customers table (remote)
Write-Host "📝 Adding profile_updated_at column to customers table..."
try {
    npx wrangler d1 execute mcis-db --remote --command="ALTER TABLE customers ADD COLUMN profile_updated_at TEXT;"
} catch {
    Write-Host "⚠️  Column might already exist or error occurred: $_" -ForegroundColor Yellow
}

# 2. Check conversations table structure
Write-Host "🔍 Checking conversations table structure..."
npx wrangler d1 execute mcis-db --remote --command="PRAGMA table_info(conversations);"

# 3. Check if conversations table exists, if not create it
Write-Host "🗃️ Ensuring conversations table exists with correct schema..."

# First, try to create conversations table if it doesn't exist
npx wrangler d1 execute mcis-db --remote --command="CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    assigned_team_id INTEGER,
    assigned_user_id INTEGER,
    status TEXT NOT NULL DEFAULT 'active',
    last_message_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);"

# 4. Create indexes
Write-Host "📊 Creating indexes..."
npx wrangler d1 execute mcis-db --remote --command="CREATE INDEX IF NOT EXISTS idx_conversations_customer ON conversations(customer_id);"
npx wrangler d1 execute mcis-db --remote --command="CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);"
npx wrangler d1 execute mcis-db --remote --command="CREATE INDEX IF NOT EXISTS idx_conversations_assigned_user ON conversations(assigned_user_id);"
npx wrangler d1 execute mcis-db --remote --command="CREATE INDEX IF NOT EXISTS idx_conversations_assigned_team ON conversations(assigned_team_id);"

# 5. Verify tables exist
Write-Host "✅ Verifying table structure..."
npx wrangler d1 execute mcis-db --remote --command="SELECT name FROM sqlite_master WHERE type='table';"

Write-Host "✅ Database fixes applied! Now testing deployment..." -ForegroundColor Green

# 6. Deploy fixed code
Write-Host "🚀 Deploying updated code..."
npm run deploy

Write-Host ""
Write-Host "✅ Database and code fixes completed!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Testing Steps:"
Write-Host "1. Send a message to your LINE Bot"
Write-Host "2. Check wrangler tail logs - should not see schema errors"
Write-Host "3. Login to frontend to verify conversations display"
Write-Host ""
Write-Host "🔍 Monitor logs: wrangler tail --format pretty"