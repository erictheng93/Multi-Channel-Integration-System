# PowerShell script to fix loading state in ConversationDetail.vue
$filePath = "D:\Code\Multi_Channel_Integration_System\frontend\src\views\ConversationDetail.vue"

# Read the file
$content = Get-Content $filePath -Raw

# Define the search pattern
$searchPattern = "    console.log\('✅ \[loadConversation\] Messages loaded, VirtualMessageList will auto-scroll'\)"

# Define the replacement (original + new code)
$replacement = @"
    console.log('✅ [loadConversation] Messages loaded, VirtualMessageList will auto-scroll')

    // 🎯 方案 B：強制清除載入畫面（治標）
    // 即使 SSE 連接失敗，HTTP 成功載入訊息後也應該顯示內容
    if (httpMessages.messages.value.length > 0) {
      hasLoadedInitially.value = true
      isInitialLoading.value = false
      console.log('✅ [方案 B] 強制清除載入畫面 - HTTP 已載入', httpMessages.messages.value.length, '條訊息')
    }
"@

# Check if the fix is already applied
if ($content -match "方案 B：強制清除載入畫面") {
    Write-Host "Fix already applied!" -ForegroundColor Yellow
    exit 0
}

# Replace
$newContent = $content -replace [regex]::Escape($searchPattern), $replacement

# Write back
Set-Content -Path $filePath -Value $newContent -NoNewline -Encoding UTF8

Write-Host "✅ Successfully applied fix to ConversationDetail.vue" -ForegroundColor Green
