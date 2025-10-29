# Channel Management API Test Script
# Tests Phase 2 implementation

$baseUrl = "https://multi-channel.imfinethankyouandyou.com"

Write-Host "=== Channel Management API Tests ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Login to get JWT token
Write-Host "[Step 1] Logging in as admin..." -ForegroundColor Yellow
$loginBody = @{
    username = "admin-001"
    password = "Admin123!@#"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" `
        -Method POST `
        -Body $loginBody `
        -ContentType "application/json"

    $token = $loginResponse.token
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }

    Write-Host "✓ Login successful" -ForegroundColor Green
    Write-Host "  User: $($loginResponse.user.displayName)" -ForegroundColor Gray
    Write-Host "  Role: $($loginResponse.user.role)" -ForegroundColor Gray
    Write-Host "  Team ID: $($loginResponse.user.teamId)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "✗ Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: List existing channels
Write-Host "[Step 2] Listing existing channels..." -ForegroundColor Yellow
try {
    $channels = Invoke-RestMethod -Uri "$baseUrl/api/channels" `
        -Method GET `
        -Headers $headers

    Write-Host "✓ Found $($channels.count) channel(s)" -ForegroundColor Green
    if ($channels.count -gt 0) {
        $channels.data | ForEach-Object {
            Write-Host "  - Channel $($_.id): $($_.platform) (Active: $($_.isActive), Verified: $($_.isVerified))" -ForegroundColor Gray
        }
    }
    Write-Host ""
} catch {
    Write-Host "✗ Failed to list channels: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 3: Create a new LINE channel (test configuration)
Write-Host "[Step 3] Creating new LINE channel..." -ForegroundColor Yellow
$channelBody = @{
    platform = "line"
    lineConfig = @{
        channelId = "TEST_CHANNEL_12345"
        channelAccessToken = "TEST_ACCESS_TOKEN_" + (Get-Random -Maximum 9999)
        channelSecret = "TEST_SECRET_" + (Get-Random -Maximum 9999)
    }
    configMetadata = @{
        description = "Test LINE channel for Phase 2 validation"
        createdBy = "API Test Script"
        testChannel = $true
    }
} | ConvertTo-Json -Depth 5

try {
    $createResponse = Invoke-RestMethod -Uri "$baseUrl/api/channels" `
        -Method POST `
        -Headers $headers `
        -Body $channelBody

    if ($createResponse.success) {
        $channelId = $createResponse.data.id
        Write-Host "✓ Channel created successfully" -ForegroundColor Green
        Write-Host "  Channel ID: $channelId" -ForegroundColor Gray
        Write-Host "  Platform: $($createResponse.data.platform)" -ForegroundColor Gray
        Write-Host "  Webhook URL: $($createResponse.webhookUrl)" -ForegroundColor Gray
        Write-Host ""

        # Step 4: Get channel details
        Write-Host "[Step 4] Getting channel details..." -ForegroundColor Yellow
        try {
            $channelDetails = Invoke-RestMethod -Uri "$baseUrl/api/channels/$channelId" `
                -Method GET `
                -Headers $headers

            Write-Host "✓ Channel details retrieved" -ForegroundColor Green
            Write-Host "  Active: $($channelDetails.data.isActive)" -ForegroundColor Gray
            Write-Host "  Verified: $($channelDetails.data.isVerified)" -ForegroundColor Gray
            Write-Host ""
        } catch {
            Write-Host "✗ Failed to get channel details: $($_.Exception.Message)" -ForegroundColor Red
        }

        # Step 5: Get channel statistics
        Write-Host "[Step 5] Getting channel statistics..." -ForegroundColor Yellow
        try {
            $stats = Invoke-RestMethod -Uri "$baseUrl/api/channels/$channelId/stats" `
                -Method GET `
                -Headers $headers

            Write-Host "✓ Statistics retrieved" -ForegroundColor Green
            Write-Host "  Messages Sent: $($stats.data.totalMessagesSent)" -ForegroundColor Gray
            Write-Host "  Messages Received: $($stats.data.totalMessagesReceived)" -ForegroundColor Gray
            Write-Host "  Success Rate: $($stats.data.successRate)%" -ForegroundColor Gray
            Write-Host ""
        } catch {
            Write-Host "✗ Failed to get statistics: $($_.Exception.Message)" -ForegroundColor Red
        }

        # Step 6: Check channel health
        Write-Host "[Step 6] Checking channel health..." -ForegroundColor Yellow
        try {
            $health = Invoke-RestMethod -Uri "$baseUrl/api/channels/$channelId/health" `
                -Method GET `
                -Headers $headers

            Write-Host "✓ Health check completed" -ForegroundColor Green
            Write-Host "  Status: $($health.data.status)" -ForegroundColor Gray
            Write-Host "  Last Check: $($health.data.lastChecked)" -ForegroundColor Gray
            Write-Host ""
        } catch {
            Write-Host "✗ Failed health check: $($_.Exception.Message)" -ForegroundColor Red
        }

        # Step 7: Verify channel (will fail with test credentials, expected)
        Write-Host "[Step 7] Verifying channel configuration..." -ForegroundColor Yellow
        try {
            $verifyResponse = Invoke-RestMethod -Uri "$baseUrl/api/channels/$channelId/verify" `
                -Method POST `
                -Headers $headers `
                -Body "{}"

            if ($verifyResponse.verified) {
                Write-Host "✓ Channel verified successfully" -ForegroundColor Green
            } else {
                Write-Host "⚠ Verification failed (expected with test credentials)" -ForegroundColor Yellow
                Write-Host "  Message: $($verifyResponse.message)" -ForegroundColor Gray
            }
            Write-Host ""
        } catch {
            Write-Host "⚠ Verification endpoint responded with error (expected)" -ForegroundColor Yellow
            Write-Host "  This is normal with test credentials" -ForegroundColor Gray
            Write-Host ""
        }

        # Step 8: Update channel (toggle active status)
        Write-Host "[Step 8] Updating channel..." -ForegroundColor Yellow
        $updateBody = @{
            isActive = $false
            configMetadata = @{
                description = "Updated test channel"
                lastModified = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
            }
        } | ConvertTo-Json -Depth 5

        try {
            $updateResponse = Invoke-RestMethod -Uri "$baseUrl/api/channels/$channelId" `
                -Method PUT `
                -Headers $headers `
                -Body $updateBody

            Write-Host "✓ Channel updated successfully" -ForegroundColor Green
            Write-Host "  New Active Status: $($updateResponse.data.isActive)" -ForegroundColor Gray
            Write-Host ""
        } catch {
            Write-Host "✗ Failed to update channel: $($_.Exception.Message)" -ForegroundColor Red
        }

        # Step 9: Delete (deactivate) channel
        Write-Host "[Step 9] Deactivating channel..." -ForegroundColor Yellow
        try {
            $deleteResponse = Invoke-RestMethod -Uri "$baseUrl/api/channels/$channelId" `
                -Method DELETE `
                -Headers $headers

            Write-Host "✓ Channel deactivated successfully" -ForegroundColor Green
            Write-Host ""
        } catch {
            Write-Host "✗ Failed to deactivate channel: $($_.Exception.Message)" -ForegroundColor Red
        }

    } else {
        Write-Host "✗ Failed to create channel: $($createResponse.error)" -ForegroundColor Red
    }

} catch {
    Write-Host "✗ Failed to create channel: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Error Details: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Tests Completed ===" -ForegroundColor Cyan
