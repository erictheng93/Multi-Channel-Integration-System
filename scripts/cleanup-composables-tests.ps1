# Cleanup script for duplicate/outdated composables test files
# 清理組合式函數測試目錄中的重複/過時檔案

Write-Host "🧹 Cleaning up duplicate composables test files..." -ForegroundColor Yellow

$testDir = "tests/unit/composables"

# Files to keep (essential test files)
$filesToKeep = @(
    "useError.test.ts",
    "useAuthStore.test.ts", 
    "useConversationsStore.test.ts",
    "composables-edge-cases.test.ts",
    "composables-performance.test.ts",
    "composables-integration.test.ts",
    "README.md"
)

# Get all files in the directory
$allFiles = Get-ChildItem -Path $testDir -File | Where-Object { $_.Name -notmatch "^\..*" }

Write-Host "📊 Found $($allFiles.Count) total files" -ForegroundColor Cyan
Write-Host "✅ Keeping $($filesToKeep.Count) essential files" -ForegroundColor Green

$filesToDelete = @()

foreach ($file in $allFiles) {
    if ($file.Name -notin $filesToKeep) {
        $filesToDelete += $file
    }
}

Write-Host "🗑️  Will delete $($filesToDelete.Count) duplicate/outdated files:" -ForegroundColor Red

# Show files that will be deleted
foreach ($file in $filesToDelete) {
    Write-Host "  - $($file.Name)" -ForegroundColor DarkRed
}

# Ask for confirmation
Write-Host ""
$confirmation = Read-Host "Do you want to proceed with deletion? (y/N)"

if ($confirmation -eq 'y' -or $confirmation -eq 'Y') {
    Write-Host "🚀 Deleting files..." -ForegroundColor Yellow
    
    $deletedCount = 0
    foreach ($file in $filesToDelete) {
        try {
            Remove-Item -Path $file.FullName -Force
            Write-Host "  ✅ Deleted: $($file.Name)" -ForegroundColor Green
            $deletedCount++
        }
        catch {
            Write-Host "  ❌ Failed to delete: $($file.Name) - $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "🎉 Cleanup complete!" -ForegroundColor Green
    Write-Host "📈 Deleted $deletedCount files" -ForegroundColor Cyan
    Write-Host "📁 Kept $($filesToKeep.Count) essential files" -ForegroundColor Cyan
    
    # Show remaining files
    Write-Host ""
    Write-Host "📋 Remaining files:" -ForegroundColor Yellow
    $remainingFiles = Get-ChildItem -Path $testDir -File | Where-Object { $_.Name -notmatch "^\..*" }
    foreach ($file in $remainingFiles) {
        Write-Host "  ✅ $($file.Name)" -ForegroundColor Green
    }
    
} else {
    Write-Host "❌ Cleanup cancelled" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "💡 Essential test files structure:" -ForegroundColor Cyan
Write-Host "  📄 useError.test.ts - Error handling composable tests" -ForegroundColor White
Write-Host "  📄 useAuthStore.test.ts - Authentication store tests" -ForegroundColor White  
Write-Host "  📄 useConversationsStore.test.ts - Conversations store tests" -ForegroundColor White
Write-Host "  📄 composables-edge-cases.test.ts - Edge cases and error scenarios" -ForegroundColor White
Write-Host "  📄 composables-performance.test.ts - Performance and scalability tests" -ForegroundColor White
Write-Host "  📄 composables-integration.test.ts - Integration workflows" -ForegroundColor White
Write-Host "  📄 README.md - Documentation and test coverage info" -ForegroundColor White