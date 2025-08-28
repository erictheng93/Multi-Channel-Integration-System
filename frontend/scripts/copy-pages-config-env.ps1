# PowerShell 腳本：複製 Cloudflare Pages 配置檔案到 dist 目錄（支持環境參數）

param(
    [string]$Environment = "production"
)

Write-Host "Copying Cloudflare Pages config files for $Environment environment..." -ForegroundColor Green

# 確保 dist 目錄存在
if (-not (Test-Path "dist")) {
    New-Item -ItemType Directory -Path "dist" -Force
    Write-Host "Created dist directory" -ForegroundColor Yellow
}

# 根據環境複製對應的 _redirects 檔案
if ($Environment -eq "development") {
    if (Test-Path "_redirects.dev") {
        Copy-Item "_redirects.dev" "dist\_redirects" -Force
        Write-Host "Copied _redirects.dev file as _redirects" -ForegroundColor Green
    } else {
        Write-Host "Warning: _redirects.dev file not found" -ForegroundColor Yellow
    }
} else {
    if (Test-Path "_redirects") {
        Copy-Item "_redirects" "dist\_redirects" -Force
        Write-Host "Copied _redirects file" -ForegroundColor Green
    } else {
        Write-Host "Warning: _redirects file not found" -ForegroundColor Yellow
    }
}

# 根據環境複製對應的 _headers 檔案
if ($Environment -eq "development") {
    if (Test-Path "_headers.dev") {
        Copy-Item "_headers.dev" "dist\_headers" -Force
        Write-Host "Copied _headers.dev file as _headers" -ForegroundColor Green
    } elseif (Test-Path "_headers") {
        Copy-Item "_headers" "dist\_headers" -Force
        Write-Host "Copied _headers file (fallback)" -ForegroundColor Yellow
    } else {
        Write-Host "Warning: Neither _headers.dev nor _headers file found" -ForegroundColor Yellow
    }
} else {
    if (Test-Path "_headers") {
        Copy-Item "_headers" "dist\_headers" -Force
        Write-Host "Copied _headers file" -ForegroundColor Green
    } else {
        Write-Host "Warning: _headers file not found" -ForegroundColor Yellow
    }
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

Write-Host "Cloudflare Pages config files copied successfully for $Environment environment!" -ForegroundColor Green