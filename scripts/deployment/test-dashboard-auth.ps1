# Test Dashboard Authentication
Write-Host "Getting authentication token..." -ForegroundColor Cyan

$loginBody = @{
    email = "admin@dacit.net"
    password = "16011587DaC"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "https://your-api-domain.example.com/api/auth/login" `
        -Method Post `
        -Headers @{"Content-Type"="application/json"} `
        -Body $loginBody

    $token = $response.data.token
    Write-Host "??Token obtained successfully" -ForegroundColor Green
    Write-Host "Token: $($token.Substring(0,50))..." -ForegroundColor Gray

    Write-Host "`nTesting Dashboard metrics endpoint..." -ForegroundColor Cyan

    $dashboardResponse = Invoke-RestMethod -Uri "https://your-api-domain.example.com/api/websocket/dashboard/metrics" `
        -Headers @{"Authorization"="Bearer $token"}

    Write-Host "??Dashboard endpoint accessible with authentication!" -ForegroundColor Green
    Write-Host "`nDashboard Metrics:" -ForegroundColor Yellow
    $dashboardResponse | ConvertTo-Json -Depth 10
}
catch {
    Write-Host "??Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}
