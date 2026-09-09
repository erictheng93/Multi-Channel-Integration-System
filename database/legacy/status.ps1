# database/status.ps1
# Check database status script
# Project: Multi-Channel Support MVP

Write-Host "Database Status Check..." -ForegroundColor Green

# Check local database
Write-Host "`nLocal Database Status:" -ForegroundColor Cyan
try {
    Write-Host "Tables:" -ForegroundColor Yellow
    wrangler d1 execute omni-channel-platform --local --command="SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name;"
    
    Write-Host "`nTest Data:" -ForegroundColor Yellow
    wrangler d1 execute omni-channel-platform --local --command="SELECT COUNT(*) as agent_count FROM agents;"
} catch {
    Write-Host "Local database connection failed" -ForegroundColor Red
}

# Check remote database
Write-Host "`nRemote Database Status:" -ForegroundColor Cyan
try {
    Write-Host "Tables:" -ForegroundColor Yellow
    wrangler d1 execute omni-channel-platform --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name;"
    
    Write-Host "`nTest Data:" -ForegroundColor Yellow
    wrangler d1 execute omni-channel-platform --remote --command="SELECT COUNT(*) as agent_count FROM agents;"
} catch {
    Write-Host "Remote database connection failed" -ForegroundColor Red
}

Write-Host "`nStatus check completed!" -ForegroundColor Green