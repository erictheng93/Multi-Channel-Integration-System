$filePath = "D:\Code\Multi_Channel_Integration_System\frontend\src\components\ui\AppLayout.vue"

# Read the file
$content = Get-Content $filePath -Raw

# Fix the userInitials computed property
$pattern = "return name\.split' '\)\.filter\(n => n\.length > 0\)\.map\(n => n\[0\]\)\.join''\)\.toUpperCase\(\) \|\| 'U'"
$replacement = "return name.split(' ').filter(n => n.length > 0).map(n => n[0]).join('').toUpperCase() || 'U'"

if ($content -match [regex]::Escape($pattern)) {
    $content = $content -replace [regex]::Escape($pattern), $replacement
    Set-Content $filePath -Value $content -NoNewline
    Write-Host "Fixed userInitials computed property successfully!"
} else {
    Write-Host "Pattern not found. Current line:"
    $content -split "`n" | Select-String -Pattern "userInitials" -Context 0,2
}
