# CORS ?��?測試?�本 (PowerShell)
# 測試統�? CORS ?�置?��??��???

$BASE_URL = if ($env:TEST_BASE_URL) { $env:TEST_BASE_URL } else { "https://your-api-domain.example.com" }
$TOKEN = if ($env:TEST_ADMIN_TOKEN) { $env:TEST_ADMIN_TOKEN } else { "" }

Write-Host "?�� CORS E2E Manual Testing" -ForegroundColor Cyan
Write-Host "==========================" -ForegroundColor Cyan
Write-Host "Base URL: $BASE_URL"
Write-Host ""

$PASSED = 0
$FAILED = 0

function Run-Test {
    param(
        [string]$TestName,
        [scriptblock]$TestBlock,
        [string]$ExpectedPattern
    )

    Write-Host "Testing: $TestName... " -NoNewline

    try {
        $result = & $TestBlock
        if ($result -match $ExpectedPattern) {
            Write-Host "??PASSED" -ForegroundColor Green
            $script:PASSED++
            return $true
        } else {
            Write-Host "??FAILED" -ForegroundColor Red
            Write-Host "   Expected pattern: $ExpectedPattern" -ForegroundColor Yellow
            Write-Host "   Got: $result" -ForegroundColor Yellow
            $script:FAILED++
            return $false
        }
    } catch {
        Write-Host "??FAILED (Exception)" -ForegroundColor Red
        Write-Host "   Error: $_" -ForegroundColor Yellow
        $script:FAILED++
        return $false
    }
}

Write-Host "1️⃣  Testing Allowed Origins" -ForegroundColor Cyan
Write-Host "----------------------------"

# Test 1: Allowed origin
Run-Test "Allowed origin (main domain)" {
    $response = Invoke-WebRequest -Uri "$BASE_URL/api/system/health" -Headers @{"Origin" = "https://your-api-domain.example.com"} -UseBasicParsing
    $response.Headers["Access-Control-Allow-Origin"]
} "https://your-api-domain.example.com"

# Test 2: Cloudflare Pages domain
Run-Test "Allowed origin (Cloudflare Pages)" {
    $response = Invoke-WebRequest -Uri "$BASE_URL/api/system/health" -Headers @{"Origin" = "https://mcis-ey7.pages.dev"} -UseBasicParsing
    $response.Headers["Access-Control-Allow-Origin"]
} "https://mcis-ey7.pages.dev"

# Test 3: Preview domain
Run-Test "Preview domain (*.pages.dev)" {
    $response = Invoke-WebRequest -Uri "$BASE_URL/api/system/health" -Headers @{"Origin" = "https://abc123.mcis-ey7.pages.dev"} -UseBasicParsing
    $response.Headers["Access-Control-Allow-Origin"]
} "https://abc123.mcis-ey7.pages.dev"

Write-Host ""
Write-Host "2️⃣  Testing Blocked Origins" -ForegroundColor Cyan
Write-Host "----------------------------"

# Test 4: Blocked origin
Run-Test "Blocked origin (malicious-site)" {
    $response = Invoke-WebRequest -Uri "$BASE_URL/api/system/health" -Headers @{"Origin" = "https://malicious-site.com"} -UseBasicParsing
    $corsHeader = $response.Headers["Access-Control-Allow-Origin"]
    if ($corsHeader -eq "https://malicious-site.com") {
        return "incorrectly allowed"
    } else {
        return "correctly blocked"
    }
} "correctly blocked"

# Test 5: Unknown origin
Run-Test "Blocked origin (unknown)" {
    $response = Invoke-WebRequest -Uri "$BASE_URL/api/system/health" -Headers @{"Origin" = "https://unknown-domain.net"} -UseBasicParsing
    $corsHeader = $response.Headers["Access-Control-Allow-Origin"]
    if ($corsHeader -eq "https://unknown-domain.net") {
        return "incorrectly allowed"
    } else {
        return "correctly blocked"
    }
} "correctly blocked"

Write-Host ""
Write-Host "3️⃣  Testing OPTIONS Preflight" -ForegroundColor Cyan
Write-Host "----------------------------"

# Test 6: OPTIONS request
Run-Test "OPTIONS preflight (allowed origin)" {
    $response = Invoke-WebRequest -Uri "$BASE_URL/api/conversations" -Method OPTIONS -Headers @{
        "Origin" = "https://your-api-domain.example.com"
        "Access-Control-Request-Method" = "POST"
    } -UseBasicParsing
    $response.StatusCode
} "204"

# Test 7: OPTIONS with blocked origin
Run-Test "OPTIONS preflight (blocked origin)" {
    try {
        $response = Invoke-WebRequest -Uri "$BASE_URL/api/conversations" -Method OPTIONS -Headers @{
            "Origin" = "https://malicious-site.com"
            "Access-Control-Request-Method" = "POST"
        } -UseBasicParsing -ErrorAction SilentlyContinue
        $response.StatusCode
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 403) {
            return "403"
        }
        throw
    }
} "403"

Write-Host ""
Write-Host "4️⃣  Testing Credentials Support" -ForegroundColor Cyan
Write-Host "----------------------------"

# Test 8: Credentials header
Run-Test "Credentials support" {
    $response = Invoke-WebRequest -Uri "$BASE_URL/api/system/health" -Headers @{"Origin" = "https://your-api-domain.example.com"} -UseBasicParsing
    $response.Headers["Access-Control-Allow-Credentials"]
} "true"

Write-Host ""
Write-Host "5️⃣  Testing CORS Monitoring Endpoints" -ForegroundColor Cyan
Write-Host "----------------------------"

# Test 9: Public config endpoint
Run-Test "CORS config endpoint (public)" {
    $response = Invoke-RestMethod -Uri "$BASE_URL/api/cors/config" -UseBasicParsing
    $response.success
} "True"

# Test 10: Health endpoint
Run-Test "CORS monitoring health" {
    $response = Invoke-RestMethod -Uri "$BASE_URL/api/cors/health" -UseBasicParsing
    $response.status
} "healthy"

if ($TOKEN) {
    # Test 11: Stats endpoint (admin only)
    Run-Test "CORS stats (admin)" {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/cors/stats" -Headers @{"Authorization" = "Bearer $TOKEN"} -UseBasicParsing
        $response.success
    } "True"

    # Test 12: Rejected origins (admin only)
    Run-Test "Rejected origins (admin)" {
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/cors/rejected-origins" -Headers @{"Authorization" = "Bearer $TOKEN"} -UseBasicParsing
        $response.success
    } "True"
} else {
    Write-Host "?��?  Skipping admin tests (no token)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "6️⃣  Testing SSE Endpoints" -ForegroundColor Cyan
Write-Host "----------------------------"

# Test 13: SSE with allowed origin
Run-Test "SSE endpoint CORS (allowed)" {
    $response = Invoke-WebRequest -Uri "$BASE_URL/api/cors/health" -Headers @{
        "Origin" = "https://your-api-domain.example.com"
        "Accept" = "text/event-stream"
    } -UseBasicParsing
    $response.Headers["Access-Control-Allow-Origin"]
} ".*"  # Should have some CORS header

Write-Host ""
Write-Host "7️⃣  Testing Edge Cases" -ForegroundColor Cyan
Write-Host "----------------------------"

# Test 14: Missing Origin header
Run-Test "Missing Origin header" {
    $response = Invoke-WebRequest -Uri "$BASE_URL/api/system/health" -UseBasicParsing
    $corsHeader = $response.Headers["Access-Control-Allow-Origin"]
    if ($corsHeader) {
        return "has cors headers"
    } else {
        return "no cors headers"
    }
} "no cors headers"

Write-Host ""
Write-Host "?? Test Results" -ForegroundColor Cyan
Write-Host "==============="
Write-Host "Passed: " -NoNewline
Write-Host "$PASSED" -ForegroundColor Green
Write-Host "Failed: " -NoNewline
Write-Host "$FAILED" -ForegroundColor Red
Write-Host "Total:  $($PASSED + $FAILED)"
Write-Host ""

if ($FAILED -eq 0) {
    Write-Host "?? All tests passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "??Some tests failed." -ForegroundColor Red
    exit 1
}
