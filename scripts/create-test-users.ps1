$ErrorActionPreference = 'Stop'

$requiredVariables = @(
    'ADMIN_EMAIL',
    'ADMIN_PASSWORD',
    'AGENT_EMAIL',
    'AGENT_PASSWORD'
)

foreach ($name in $requiredVariables) {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
        throw ('Set {0} before generating account seed SQL.' -f $name)
    }
}

Write-Host 'Generating account seed SQL from environment variables.' -ForegroundColor Cyan
Write-Host 'Review the SQL before applying it with Wrangler.' -ForegroundColor Yellow

bun scripts/admin/seed-agents.ts
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
