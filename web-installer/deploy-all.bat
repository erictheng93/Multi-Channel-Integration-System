@echo off
REM ==============================================================================
REM Web Installer - Complete Deployment Script (Windows)
REM ==============================================================================
REM This script deploys both backend (Worker) and frontend (Pages) in sequence
REM ==============================================================================

setlocal enabledelayedexpansion

echo.
echo ========================================================================
echo.
echo       Multi-Channel CRM Web Installer Deployment (Windows)
echo.
echo ========================================================================
echo.

echo This script will deploy:
echo   1. Backend (Cloudflare Worker)
echo   2. Frontend (Cloudflare Pages)
echo.
echo Make sure you have:
echo   - Configured OAuth credentials
echo   - Set required secrets (CF_CLIENT_ID, CF_CLIENT_SECRET, RESEND_API_KEY)
echo   - Updated .env files with correct values
echo.

set /p CONTINUE="Continue with deployment? (Y/N): "
if /i not "%CONTINUE%"=="Y" (
    echo Deployment cancelled.
    exit /b 0
)

REM ==============================================================================
REM CHECK PREREQUISITES
REM ==============================================================================

echo.
echo Checking prerequisites...
echo.

where wrangler >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Wrangler CLI is not installed
    echo Install it with: npm install -g wrangler
    exit /b 1
)
echo [OK] Wrangler CLI is installed

wrangler whoami >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Not logged in to Cloudflare
    echo Run: wrangler login
    exit /b 1
)
echo [OK] Logged in to Cloudflare

REM ==============================================================================
REM DEPLOY BACKEND
REM ==============================================================================

echo.
echo ========================================================================
echo Step 1/2: Deploying Backend Worker
echo ========================================================================
echo.

cd backend

if not exist "package.json" (
    echo [ERROR] backend/package.json not found
    cd ..
    exit /b 1
)

echo Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install backend dependencies
    cd ..
    exit /b 1
)

echo.
echo Type checking...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Type check failed
    cd ..
    exit /b 1
)

echo.
echo Deploying to Cloudflare Workers...
call wrangler deploy
if %errorlevel% neq 0 (
    echo [ERROR] Backend deployment failed
    cd ..
    exit /b 1
)

cd ..

echo.
echo [SUCCESS] Backend deployment completed
echo.
set /p WORKER_URL="Enter your Worker URL (e.g., https://xxx.workers.dev): "

if "%WORKER_URL%"=="" (
    echo [ERROR] Worker URL is required
    exit /b 1
)

REM ==============================================================================
REM UPDATE FRONTEND CONFIGURATION
REM ==============================================================================

echo.
echo Updating Frontend Configuration...
echo.

cd frontend

if not exist ".env.production" (
    echo Creating .env.production...
    (
        echo # Production Environment Variables
        echo VITE_API_BASE_URL=%WORKER_URL%
        echo VITE_OAUTH_REDIRECT_URI=https://crm-installer-frontend.pages.dev/oauth/callback
        echo VITE_ENVIRONMENT=production
    ) > .env.production
) else (
    echo Updating .env.production...
    powershell -Command "(Get-Content .env.production) -replace 'VITE_API_BASE_URL=.*', 'VITE_API_BASE_URL=%WORKER_URL%' | Set-Content .env.production"
)

cd ..

REM ==============================================================================
REM DEPLOY FRONTEND
REM ==============================================================================

echo.
echo ========================================================================
echo Step 2/2: Deploying Frontend Pages
echo ========================================================================
echo.

cd frontend

if not exist "package.json" (
    echo [ERROR] frontend/package.json not found
    cd ..
    exit /b 1
)

echo Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install frontend dependencies
    cd ..
    exit /b 1
)

echo.
echo Type checking...
call npm run type-check
if %errorlevel% neq 0 (
    echo [ERROR] Type check failed
    cd ..
    exit /b 1
)

echo.
echo Building production bundle...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed
    cd ..
    exit /b 1
)

echo.
echo Deploying to Cloudflare Pages...
call wrangler pages deploy dist --project-name=crm-installer-frontend
if %errorlevel% neq 0 (
    echo [ERROR] Frontend deployment failed
    cd ..
    exit /b 1
)

cd ..

echo.
echo [SUCCESS] Frontend deployment completed

REM ==============================================================================
REM DEPLOYMENT SUMMARY
REM ==============================================================================

echo.
echo ========================================================================
echo                    DEPLOYMENT SUCCESSFUL!
echo ========================================================================
echo.
echo Backend Worker URL:
echo   %WORKER_URL%
echo.
echo Frontend Pages URL:
echo   https://crm-installer-frontend.pages.dev
echo.
echo.
echo IMPORTANT: Complete OAuth Configuration!
echo.
echo 1. Go to: https://dash.cloudflare.com/profile/api-tokens
echo 2. Edit your OAuth application
echo 3. Add this redirect URI:
echo    https://crm-installer-frontend.pages.dev/oauth/callback
echo.
echo.
echo Testing Your Deployment:
echo.
echo 1. Test Backend Health:
echo    curl %WORKER_URL%/health
echo.
echo 2. Test Frontend:
echo    Open: https://crm-installer-frontend.pages.dev
echo    Click: 'Deploy to Cloudflare'
echo.
echo.
echo All done! Your Web Installer is now live!
echo.

pause
