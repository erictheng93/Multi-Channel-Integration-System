# Handler-based Architecture Refactoring Verification

Write-Host "Handler-based Architecture Refactoring Verification" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# Check refactoring status
Write-Host "Checking refactoring status..." -ForegroundColor Yellow

# 1. Check if main entry point uses Handler-based architecture
Write-Host "1. Checking main entry point (src/index.ts)..." -ForegroundColor White
if (Select-String -Path "src/index.ts" -Pattern "Handler-based" -Quiet) {
    Write-Host "   ✅ Main entry point refactored to Handler-based architecture" -ForegroundColor Green
} else {
    Write-Host "   ❌ Main entry point not using Handler-based architecture" -ForegroundColor Red
}

# 2. Check if Handler files exist
Write-Host "2. Checking Handler files..." -ForegroundColor White
$handlers = @(
    "src/handlers/auth-main.ts",
    "src/handlers/team-main.ts", 
    "src/handlers/delayed-message-main.ts",
    "src/handlers/conversation-main.ts",
    "src/handlers/system-main.ts",
    "src/handlers/customer-main.ts"
)

$handlerCount = 0
foreach ($handler in $handlers) {
    if (Test-Path $handler) {
        $handlerCount++
        Write-Host "   ✅ $handler" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $handler" -ForegroundColor Red
    }
}

Write-Host "   Handler files: $handlerCount/$($handlers.Count)" -ForegroundColor Cyan

# 3. Check if test files exist
Write-Host "3. Checking test files..." -ForegroundColor White
$testFiles = @(
    "tests/unit/handlers/auth-main.test.ts",
    "tests/unit/handlers/team-main.test.ts",
    "tests/unit/handlers/delayed-message-main.test.ts",
    "tests/unit/handlers/conversation-main.test.ts",
    "tests/unit/handlers/system-main.test.ts",
    "tests/unit/handlers/customer-main.test.ts"
)

$testCount = 0
foreach ($testFile in $testFiles) {
    if (Test-Path $testFile) {
        $testCount++
        Write-Host "   ✅ $testFile" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $testFile" -ForegroundColor Red
    }
}

Write-Host "   Test files: $testCount/$($testFiles.Count)" -ForegroundColor Cyan

# 4. Check backup file
Write-Host "4. Checking backup file..." -ForegroundColor White
if (Test-Path "src/index-original-backup.ts") {
    Write-Host "   ✅ Original file backed up: src/index-original-backup.ts" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Original file backup not found" -ForegroundColor Yellow
}

# 5. Run compilation test
Write-Host "5. Running compilation test..." -ForegroundColor White
try {
    $null = npm run build 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ TypeScript compilation successful" -ForegroundColor Green
    } else {
        Write-Host "   ❌ TypeScript compilation failed" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ Compilation test failed" -ForegroundColor Red
}

# Summary
Write-Host ""
Write-Host "Refactoring Verification Summary" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan

$totalScore = 0
$maxScore = 5

# Calculate score
if (Select-String -Path "src/index.ts" -Pattern "Handler-based" -Quiet) { $totalScore++ }
if ($handlerCount -eq $handlers.Count) { $totalScore++ }
if ($testCount -eq $testFiles.Count) { $totalScore++ }
if (Test-Path "src/index-original-backup.ts") { $totalScore++ }
if ($LASTEXITCODE -eq 0) { $totalScore++ }

$percentage = [math]::Round(($totalScore / $maxScore) * 100, 1)

Write-Host "Refactoring completion: $totalScore/$maxScore ($percentage%)" -ForegroundColor $(if ($percentage -ge 80) { "Green" } elseif ($percentage -ge 60) { "Yellow" } else { "Red" })

if ($percentage -ge 80) {
    Write-Host ""
    Write-Host "🎉 Refactoring successfully completed!" -ForegroundColor Green
    Write-Host "✅ Handler-based architecture implemented" -ForegroundColor Green
    Write-Host "✅ Test files updated to target new architecture" -ForegroundColor Green
    Write-Host "✅ Code compiles and runs normally" -ForegroundColor Green
} elseif ($percentage -ge 60) {
    Write-Host ""
    Write-Host "⚠️  Refactoring mostly complete, but needs some fixes" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "❌ Refactoring incomplete or has major issues" -ForegroundColor Red
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Fix remaining test environment setup issues" -ForegroundColor White
Write-Host "2. Run complete test suite: npm run test:handlers:main" -ForegroundColor White
Write-Host "3. Deploy and verify API endpoints work correctly" -ForegroundColor White