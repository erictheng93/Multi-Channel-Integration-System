#!/bin/bash

# ==============================================================================
# Web Installer - Complete Deployment Script
# ==============================================================================
# This script deploys both backend (Worker) and frontend (Pages) in sequence
# ==============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Functions
print_banner() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║       Multi-Channel CRM Web Installer Deployment         ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_header() {
    echo ""
    echo -e "${BLUE}┌───────────────────────────────────────────────────────────┐${NC}"
    echo -e "${BLUE}│  $1${NC}"
    echo -e "${BLUE}└───────────────────────────────────────────────────────────┘${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# ==============================================================================
# START
# ==============================================================================

clear
print_banner

print_info "This script will deploy:"
echo "  1. Backend (Cloudflare Worker)"
echo "  2. Frontend (Cloudflare Pages)"
echo ""
print_warning "Make sure you have:"
echo "  - Configured OAuth credentials"
echo "  - Set required secrets (CF_CLIENT_ID, CF_CLIENT_SECRET, RESEND_API_KEY)"
echo "  - Updated .env files with correct values"
echo ""

read -p "Continue with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Deployment cancelled."
    exit 0
fi

# ==============================================================================
# DEPLOY BACKEND
# ==============================================================================

print_header "Step 1/2: Deploying Backend Worker"

cd backend

if [ ! -f "deploy.sh" ]; then
    print_error "backend/deploy.sh not found"
    exit 1
fi

chmod +x deploy.sh
./deploy.sh

if [ $? -ne 0 ]; then
    print_error "Backend deployment failed"
    exit 1
fi

cd ..

print_success "Backend deployment completed"
echo ""
print_info "Please copy your Worker URL for the next step"
read -p "Enter your Worker URL (e.g., https://xxx.workers.dev): " WORKER_URL

if [ -z "$WORKER_URL" ]; then
    print_error "Worker URL is required"
    exit 1
fi

# ==============================================================================
# UPDATE FRONTEND CONFIGURATION
# ==============================================================================

print_header "Updating Frontend Configuration"

cd frontend

# Update .env.production with Worker URL
if [ -f ".env.production" ]; then
    print_info "Updating VITE_API_BASE_URL in .env.production"

    # Use sed to update or add VITE_API_BASE_URL
    if grep -q "VITE_API_BASE_URL=" .env.production; then
        sed -i.bak "s|VITE_API_BASE_URL=.*|VITE_API_BASE_URL=$WORKER_URL|" .env.production
    else
        echo "VITE_API_BASE_URL=$WORKER_URL" >> .env.production
    fi

    print_success "Updated .env.production"
else
    print_info "Creating .env.production"
    cat > .env.production << EOF
# Production Environment Variables
VITE_API_BASE_URL=$WORKER_URL
VITE_OAUTH_REDIRECT_URI=https://crm-installer-frontend.pages.dev/oauth/callback
VITE_ENVIRONMENT=production
EOF
    print_success "Created .env.production"
fi

cd ..

# ==============================================================================
# DEPLOY FRONTEND
# ==============================================================================

print_header "Step 2/2: Deploying Frontend Pages"

cd frontend

if [ ! -f "deploy.sh" ]; then
    print_error "frontend/deploy.sh not found"
    exit 1
fi

chmod +x deploy.sh
./deploy.sh

if [ $? -ne 0 ]; then
    print_error "Frontend deployment failed"
    exit 1
fi

cd ..

print_success "Frontend deployment completed"

# ==============================================================================
# DEPLOYMENT SUMMARY
# ==============================================================================

print_header "Deployment Summary"

echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                           ║${NC}"
echo -e "${GREEN}║            ✓ DEPLOYMENT SUCCESSFUL!                      ║${NC}"
echo -e "${GREEN}║                                                           ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

print_info "Backend Worker URL:"
echo "  $WORKER_URL"
echo ""

print_info "Frontend Pages URL:"
echo "  https://crm-installer-frontend.pages.dev"
echo "  (or your custom domain if configured)"
echo ""

print_warning "IMPORTANT: Complete OAuth Configuration!"
echo ""
echo "1. Go to: https://dash.cloudflare.com/profile/api-tokens"
echo "2. Edit your OAuth application"
echo "3. Add this redirect URI:"
echo "   https://crm-installer-frontend.pages.dev/oauth/callback"
echo ""

# ==============================================================================
# TESTING INSTRUCTIONS
# ==============================================================================

print_header "Testing Your Deployment"

echo "1. Test Backend Health:"
echo "   curl $WORKER_URL/health"
echo ""
echo "2. Test Frontend:"
echo "   Open: https://crm-installer-frontend.pages.dev"
echo "   Click: 'Deploy to Cloudflare'"
echo ""
echo "3. Monitor Logs:"
echo "   Backend: wrangler tail (in backend directory)"
echo "   Frontend: Check browser console"
echo ""

# ==============================================================================
# NEXT STEPS
# ==============================================================================

print_header "Next Steps"

echo "✓ Update OAuth redirect URIs in Cloudflare Dashboard"
echo "✓ Test the complete deployment flow"
echo "✓ Set up custom domain (optional)"
echo "✓ Configure monitoring and alerts"
echo "✓ Share the installer URL with your users"
echo ""

print_success "All done! Your Web Installer is now live! 🎉"
echo ""
