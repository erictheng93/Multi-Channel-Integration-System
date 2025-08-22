#!/usr/bin/env pwsh

<#
.SYNOPSIS
    API 測試 PowerShell 腳本
    
.DESCRIPTION
    這個腳本提供了一個方便的方式來測試所有 API 端點
    支持本地開發環境和生產環境的測試
    
.PARAMETER Environment
    指定測試環境 (local, dev, prod)
    
.PARAMETER TestType
    指定測試類型 (all, endpoints, integration, load)
    
.PARAMETER Verbose
    啟用詳細輸出
    
.PARAMETER BaseUrl
    自定義測試目標 URL
    
.EXAMPLE
    .\test-all-apis.ps1
    執行所有測試 (預設本地環境)
    
.EXAMPLE
    .\test-all-apis.ps1 -Environment prod -TestType endpoints
    在生產環境執行端點測試
    
.EXAMPLE
    .\test-all-apis.ps1 -BaseUrl "https://my-api.example.com" -Verbose
    使用自定義 URL 執行測試並顯示詳細輸出
#>

param(
    [Parameter()]
    [ValidateSet("local", "dev", "prod")]
    [string]$Environment = "local",
    
    [Parameter()]
    [ValidateSet("all", "endpoints", "integration", "load")]
    [string]$TestType = "all",
    
    [Parameter()]
    [switch]$Verbose,
    
    [Parameter()]
    [string]$BaseUrl
)

# 設定錯誤處理
$ErrorActionPreference = "Stop"

# 顏色輸出函數
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    
    $colorMap = @{
        "Red" = [ConsoleColor]::Red
        "Green" = [ConsoleColor]::Green
        "Yellow" = [ConsoleColor]::Yellow
        "Blue" = [ConsoleColor]::Blue
        "Cyan" = [ConsoleColor]::Cyan
        "Magenta" = [ConsoleColor]::Magenta
        "White" = [ConsoleColor]::White
    }
    
    Write-Host $Message -ForegroundColor $colorMap[$Color]
}

# 獲取環境 URL
function Get-EnvironmentUrl {
    param([string]$env)
    
    switch ($env) {
        "local" { return "http://localhost:8787" }
        "dev" { return "https://your-dev-api.example.com" }
        "prod" { return "https://your-prod-api.example.com" }
        default { return "http://localhost:8787" }
    }
}

# 檢查必要工具
function Test-Prerequisites {
    Write-ColorOutput "🔍 檢查必要工具..." "Blue"
    
    # 檢查 Node.js
    try {
        $nodeVersion = node --version
        Write-ColorOutput "✅ Node.js: $nodeVersion" "Green"
    }
    catch {
        Write-ColorOutput "❌ Node.js 未安裝或不在 PATH 中" "Red"
        throw "請安裝 Node.js"
    }
    
    # 檢查 npm
    try {
        $npmVersion = npm --version
        Write-ColorOutput "✅ npm: $npmVersion" "Green"
    }
    catch {
        Write-ColorOutput "❌ npm 未安裝或不在 PATH 中" "Red"
        throw "請安裝 npm"
    }
    
    # 檢查測試目錄
    $testDir = Join-Path $PSScriptRoot ".." "tests"
    if (-not (Test-Path $testDir)) {
        Write-ColorOutput "❌ 測試目錄不存在: $testDir" "Red"
        throw "測試目錄不存在"
    }
    
    Write-ColorOutput "✅ 所有必要工具檢查完成" "Green"
}

# 檢查服務可用性
function Test-ServiceAvailability {
    param([string]$url)
    
    Write-ColorOutput "🔍 檢查服務可用性: $url" "Blue"
    
    try {
        $response = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 10 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-ColorOutput "✅ 服務可用" "Green"
            return $true
        }
        else {
            Write-ColorOutput "❌ 服務回應異常: HTTP $($response.StatusCode)" "Red"
            return $false
        }
    }
    catch {
        Write-ColorOutput "❌ 服務不可用: $($_.Exception.Message)" "Red"
        return $false
    }
}

# 執行測試
function Invoke-ApiTests {
    param(
        [string]$url,
        [string]$testType,
        [bool]$verboseOutput
    )
    
    $testDir = Join-Path $PSScriptRoot ".." "tests"
    Push-Location $testDir
    
    try {
        Write-ColorOutput "🚀 開始執行 API 測試..." "Blue"
        Write-ColorOutput "   測試目標: $url" "Cyan"
        Write-ColorOutput "   測試類型: $testType" "Cyan"
        Write-ColorOutput "   詳細輸出: $(if($verboseOutput) { '啟用' } else { '停用' })" "Cyan"
        
        $arguments = @()
        
        # 根據測試類型設定參數
        switch ($testType) {
            "all" {
                $arguments += "run-api-tests.ts"
            }
            "endpoints" {
                $arguments += "api-endpoints-test.ts"
            }
            "integration" {
                $arguments += "api-integration-test.ts"
            }
            "load" {
                $arguments += "api-load-test.ts"
            }
        }
        
        # 添加 URL 參數
        if ($testType -eq "all") {
            $arguments += "--url", $url
        } else {
            $arguments += $url
        }
        
        # 添加詳細輸出參數
        if ($verboseOutput -and $testType -eq "all") {
            $arguments += "--verbose"
        }
        
        # 執行測試
        Write-ColorOutput "📋 執行命令: node --loader tsx $($arguments -join ' ')" "Yellow"
        
        $process = Start-Process -FilePath "node" -ArgumentList @("--loader", "tsx") + $arguments -Wait -PassThru -NoNewWindow
        
        if ($process.ExitCode -eq 0) {
            Write-ColorOutput "✅ 測試執行成功" "Green"
        }
        else {
            Write-ColorOutput "❌ 測試執行失敗 (退出碼: $($process.ExitCode))" "Red"
            throw "測試失敗"
        }
    }
    finally {
        Pop-Location
    }
}

# 生成測試報告摘要
function Show-TestReports {
    Write-ColorOutput "📄 檢查測試報告..." "Blue"
    
    $reportFiles = @(
        "api-test-report.json",
        "integration-test-report.json", 
        "load-test-report.json",
        "api-test-summary.json"
    )
    
    $foundReports = @()
    
    foreach ($reportFile in $reportFiles) {
        $reportPath = Join-Path $PSScriptRoot ".." $reportFile
        if (Test-Path $reportPath) {
            $foundReports += $reportPath
            Write-ColorOutput "✅ 找到報告: $reportFile" "Green"
        }
    }
    
    if ($foundReports.Count -eq 0) {
        Write-ColorOutput "⚠️  沒有找到測試報告文件" "Yellow"
    }
    else {
        Write-ColorOutput "📊 共找到 $($foundReports.Count) 個測試報告" "Cyan"
        
        # 顯示摘要報告內容
        $summaryPath = Join-Path $PSScriptRoot ".." "api-test-summary.json"
        if (Test-Path $summaryPath) {
            try {
                $summary = Get-Content $summaryPath | ConvertFrom-Json
                Write-ColorOutput "`n📈 測試摘要:" "Blue"
                Write-ColorOutput "   時間戳: $($summary.timestamp)" "White"
                Write-ColorOutput "   測試目標: $($summary.baseUrl)" "White"
                Write-ColorOutput "   總測試套件: $($summary.summary.totalSuites)" "White"
                Write-ColorOutput "   成功套件: $($summary.summary.successfulSuites)" "Green"
                Write-ColorOutput "   失敗套件: $($summary.summary.failedSuites)" "Red"
                
                if ($summary.summary.totalSuites -gt 0) {
                    $successRate = ($summary.summary.successfulSuites / $summary.summary.totalSuites) * 100
                    Write-ColorOutput "   成功率: $($successRate.ToString('F1'))%" "Cyan"
                }
            }
            catch {
                Write-ColorOutput "⚠️  無法解析摘要報告" "Yellow"
            }
        }
    }
}

# 主執行邏輯
function Main {
    try {
        Write-ColorOutput "🎯 API 測試執行器" "Magenta"
        Write-ColorOutput "==================" "Magenta"
        
        # 檢查必要工具
        Test-Prerequisites
        
        # 確定測試 URL
        $testUrl = if ($BaseUrl) { $BaseUrl } else { Get-EnvironmentUrl $Environment }
        
        # 檢查服務可用性
        $serviceAvailable = Test-ServiceAvailability $testUrl
        if (-not $serviceAvailable) {
            Write-ColorOutput "❌ 服務不可用，無法執行測試" "Red"
            Write-ColorOutput "請確保服務正在運行，然後重試" "Yellow"
            exit 1
        }
        
        # 執行測試
        Invoke-ApiTests -url $testUrl -testType $TestType -verboseOutput $Verbose.IsPresent
        
        # 顯示測試報告
        Show-TestReports
        
        Write-ColorOutput "`n🎉 API 測試完成！" "Green"
        
    }
    catch {
        Write-ColorOutput "❌ 執行失敗: $($_.Exception.Message)" "Red"
        exit 1
    }
}

# 顯示幫助信息
function Show-Help {
    Write-ColorOutput @"
🎯 API 測試執行器

用法:
    .\test-all-apis.ps1 [參數]

參數:
    -Environment <env>    指定測試環境 (local, dev, prod)
    -TestType <type>      指定測試類型 (all, endpoints, integration, load)
    -BaseUrl <url>        自定義測試目標 URL
    -Verbose              啟用詳細輸出

範例:
    .\test-all-apis.ps1
    .\test-all-apis.ps1 -Environment prod -TestType endpoints
    .\test-all-apis.ps1 -BaseUrl "https://my-api.example.com" -Verbose

測試類型說明:
    all           執行所有測試套件
    endpoints     API 端點功能測試
    integration   API 整合流程測試
    load          API 負載壓力測試

環境說明:
    local         本地開發環境 (http://localhost:8787)
    dev           開發環境
    prod          生產環境
"@ "Cyan"
}

# 檢查是否請求幫助
if ($args -contains "-h" -or $args -contains "--help" -or $args -contains "help") {
    Show-Help
    exit 0
}

# 執行主邏輯
Main