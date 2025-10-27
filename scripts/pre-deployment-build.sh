#!/bin/bash
# Pre-deployment Build Script
# 這個腳本會在 Terraform 部署前準備所有必要的文件

set -e  # 遇到錯誤立即退出

echo "======================================"
echo "  多渠道客服系統 - 部署前準備"
echo "======================================"
echo ""

# 檢查必要的工具
echo "🔍 檢查必要工具..."
command -v node >/dev/null 2>&1 || { echo "❌ 錯誤: 需要安裝 Node.js"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ 錯誤: 需要安裝 npm"; exit 1; }
command -v wrangler >/dev/null 2>&1 || { echo "❌ 錯誤: 需要安裝 Wrangler CLI"; exit 1; }
command -v terraform >/dev/null 2>&1 || { echo "❌ 錯誤: 需要安裝 Terraform"; exit 1; }
echo "✅ 所有必要工具已安裝"
echo ""

# 檢查 Cloudflare API Token
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "⚠️  警告: 未設置 CLOUDFLARE_API_TOKEN 環境變數"
    echo "   請執行: export CLOUDFLARE_API_TOKEN=\"your-token-here\""
    echo ""
fi

# 安裝後端依賴
echo "📦 安裝後端依賴..."
npm install
echo "✅ 後端依賴安裝完成"
echo ""

# 安裝前端依賴
echo "📦 安裝前端依賴..."
cd frontend
npm install
cd ..
echo "✅ 前端依賴安裝完成"
echo ""

# TypeScript 編譯檢查
echo "🔨 執行 TypeScript 編譯檢查..."
npm run build
echo "✅ TypeScript 編譯檢查通過"
echo ""

# 建置 Worker
echo "🏗️  建置 Cloudflare Worker..."
if [ ! -d "dist" ]; then
    mkdir -p dist
fi

# 使用 esbuild 打包 (Wrangler 會在部署時自動打包，但 Terraform 需要 dist/index.js)
npx wrangler deploy --dry-run --outdir=dist
echo "✅ Worker 建置完成"
echo ""

# 建置前端
echo "🎨 建置前端應用..."
cd frontend
npm run build
cd ..
echo "✅ 前端建置完成"
echo ""

# 驗證必要文件存在
echo "✅ 驗證建置產物..."
if [ ! -f "dist/index.js" ]; then
    echo "❌ 錯誤: dist/index.js 不存在"
    exit 1
fi

if [ ! -d "frontend/dist" ]; then
    echo "❌ 錯誤: frontend/dist 不存在"
    exit 1
fi
echo "✅ 所有建置產物就緒"
echo ""

# 檢查 terraform.tfvars
if [ ! -f "terraform.tfvars" ]; then
    echo "⚠️  警告: terraform.tfvars 不存在"
    echo "   建議執行: cp terraform.tfvars.example terraform.tfvars"
    echo "   然後編輯 terraform.tfvars 填入實際配置"
    echo ""
fi

echo "======================================"
echo "  ✅ 部署前準備完成！"
echo "======================================"
echo ""
echo "下一步："
echo "  1. 確保已設置 CLOUDFLARE_API_TOKEN"
echo "  2. 檢查 terraform.tfvars 配置"
echo "  3. 執行 terraform init"
echo "  4. 執行 terraform plan"
echo "  5. 執行 terraform apply"
echo ""
