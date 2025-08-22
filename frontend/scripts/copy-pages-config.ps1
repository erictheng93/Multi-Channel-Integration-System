# PowerShell 腳本：複製 Cloudflare Pages 配置檔案到 dist 目錄

Write-Host "Copying Cloudflare Pages config files..." -ForegroundColor Green

# 確保 dist 目錄存在
if (-not (Test-Path "dist")) {
    New-Item -ItemType Directory -Path "dist" -Force
    Write-Host "Created dist directory" -ForegroundColor Yellow
}

# 複製 _redirects 檔案
if (Test-Path "_redirects") {
    Copy-Item "_redirects" "dist\_redirects" -Force
    Write-Host "Copied _redirects file" -ForegroundColor Green
} else {
    Write-Host "Warning: _redirects file not found" -ForegroundColor Yellow
}

# 複製 _headers 檔案
if (Test-Path "_headers") {
    Copy-Item "_headers" "dist\_headers" -Force
    Write-Host "Copied _headers file" -ForegroundColor Green
} else {
    Write-Host "Warning: _headers file not found" -ForegroundColor Yellow
}

# 複製 functions 目錄
if (Test-Path "functions") {
    if (Test-Path "dist\functions") {
        Remove-Item "dist\functions" -Recurse -Force
    }
    Copy-Item "functions" "dist\functions" -Recurse -Force
    Write-Host "Copied functions directory" -ForegroundColor Green
} else {
    Write-Host "Warning: functions directory not found" -ForegroundColor Yellow
}

# 複製 .pages.toml 檔案（如果存在）
if (Test-Path ".pages.toml") {
    Copy-Item ".pages.toml" "dist\.pages.toml" -Force
    Write-Host "Copied .pages.toml file" -ForegroundColor Green
}

Write-Host "Cloudflare Pages config files copied successfully!" -ForegroundColor Green