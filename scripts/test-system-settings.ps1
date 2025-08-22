# Test System Settings API
# This script tests the system settings functionality

param(
    [string]$BaseUrl = "http://localhost:8787",
    [string]$Token = ""
)

Write-Host "🧪 Testing System Settings API..." -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl" -ForegroundColor Gray

# Function to make API requests
function Invoke-ApiRequest {
    param(
        [string]$Method,
        [string]$Endpoint,
        [object]$Body = $null,
        [string]$AuthToken = ""
    )
    
    $headers = @{
        "Content-Type" = "application/json"
    }
    
    if ($AuthToken) {
        $headers["Authorization"] = "Bearer $AuthToken"
    }
    
    $params = @{
        Uri = "$BaseUrl$Endpoint"
        Method = $Method
        Headers = $headers
    }
    
    if ($Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 10)
    }
    
    try {
        $response = Invoke-RestMethod @params
        return $response
    }
    catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            $statusCode = $_.Exception.Response.StatusCode
            Write-Host "Status Code: $statusCode" -ForegroundColor Red
        }
        return $null
    }
}

# Test 1: Get System Info
Write-Host "`n📊 Testing Get System Info..." -ForegroundColor Yellow
$systemInfo = Invoke-ApiRequest -Method "GET" -Endpoint "/api/system/info" -AuthToken $Token
if ($systemInfo) {
    Write-Host "✅ System Info retrieved successfully" -ForegroundColor Green
    Write-Host "Version: $($systemInfo.data.version)" -ForegroundColor Gray
} else {
    Write-Host "❌ Failed to get system info" -ForegroundColor Red
}

# Test 2: Get Settings
Write-Host "`n⚙️ Testing Get Settings..." -ForegroundColor Yellow
$settings = Invoke-ApiRequest -Method "GET" -Endpoint "/api/system/settings" -AuthToken $Token
if ($settings) {
    Write-Host "✅ Settings retrieved successfully" -ForegroundColor Green
    Write-Host "System Name: $($settings.data.general.systemName)" -ForegroundColor Gray
    Write-Host "Language: $($settings.data.general.language)" -ForegroundColor Gray
    Write-Host "Timezone: $($settings.data.general.timezone)" -ForegroundColor Gray
} else {
    Write-Host "❌ Failed to get settings" -ForegroundColor Red
}

# Test 3: Update Settings (Language Change)
Write-Host "`n🔄 Testing Update Settings (Language Change)..." -ForegroundColor Yellow
$updateData = @{
    general = @{
        systemName = "Multi-Channel Support"
        contactEmail = "admin@example.com"
        timezone = "Asia/Taipei"
        language = "zh-CN"
    }
}

$updateResult = Invoke-ApiRequest -Method "PUT" -Endpoint "/api/system/settings" -Body $updateData -AuthToken $Token
if ($updateResult -and $updateResult.success) {
    Write-Host "✅ Settings updated successfully" -ForegroundColor Green
    
    # Verify the change
    Start-Sleep -Seconds 1
    $updatedSettings = Invoke-ApiRequest -Method "GET" -Endpoint "/api/system/settings" -AuthToken $Token
    if ($updatedSettings -and $updatedSettings.data.general.language -eq "zh-CN") {
        Write-Host "✅ Language change verified" -ForegroundColor Green
    } else {
        Write-Host "❌ Language change not persisted" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Failed to update settings" -ForegroundColor Red
    if ($updateResult) {
        Write-Host "Error: $($updateResult.error)" -ForegroundColor Red
    }
}

# Test 4: Revert Language Change
Write-Host "`n🔄 Testing Revert Language Change..." -ForegroundColor Yellow
$revertData = @{
    general = @{
        systemName = "Multi-Channel Support"
        contactEmail = "admin@example.com"
        timezone = "Asia/Taipei"
        language = "zh-TW"
    }
}

$revertResult = Invoke-ApiRequest -Method "PUT" -Endpoint "/api/system/settings" -Body $revertData -AuthToken $Token
if ($revertResult -and $revertResult.success) {
    Write-Host "✅ Settings reverted successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to revert settings" -ForegroundColor Red
}

# Test 5: Health Check
Write-Host "`n🏥 Testing Health Check..." -ForegroundColor Yellow
$health = Invoke-ApiRequest -Method "GET" -Endpoint "/api/system/health"
if ($health) {
    Write-Host "✅ Health check completed" -ForegroundColor Green
    Write-Host "Status: $($health.data.status)" -ForegroundColor Gray
} else {
    Write-Host "❌ Health check failed" -ForegroundColor Red
}

Write-Host "`n🎉 System Settings API testing completed!" -ForegroundColor Cyan
Write-Host "Run with authentication token: .\test-system-settings.ps1 -Token 'your-jwt-token'" -ForegroundColor Gray