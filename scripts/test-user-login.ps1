param(
    [string]$ApiUrl = 'http://localhost:8787',
    [string]$Username = $env:MCIS_TEST_USERNAME,
    [string]$Password = $env:MCIS_TEST_PASSWORD,
    [string]$ExpectedRole = $env:MCIS_TEST_EXPECTED_ROLE
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($Username) -or [string]::IsNullOrWhiteSpace($Password)) {
    throw 'Set MCIS_TEST_USERNAME and MCIS_TEST_PASSWORD before running this script.'
}

$loginData = @{
    username = $Username
    password = $Password
} | ConvertTo-Json

Write-Host ('Testing login for {0} against {1}' -f $Username, $ApiUrl) -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri ($ApiUrl.TrimEnd('/') + '/api/auth/login') `
        -Method POST `
        -Body $loginData `
        -ContentType 'application/json' `
        -TimeoutSec 10

    if ($response.success -ne $true) {
        throw ('Login failed: {0}' -f $response.error)
    }

    $actualRole = $response.data.user.role
    if ($ExpectedRole -and $actualRole -ne $ExpectedRole) {
        throw ('Unexpected role. Expected {0}, received {1}.' -f $ExpectedRole, $actualRole)
    }

    Write-Host ('Login succeeded for user ID {0} with role {1}.' -f $response.data.user.id, $actualRole) `
        -ForegroundColor Green
} catch {
    Write-Error ('Login request failed: {0}' -f $_.Exception.Message)
    exit 1
}
