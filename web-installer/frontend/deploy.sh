#!/bin/bash

# ==============================================================================
# Web Installer Frontend Deployment Script
# ==============================================================================
# This script builds and deploys the Web Installer frontend to Cloudflare Pages
# ==============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${BLUE}===================================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}===================================================${NC}"
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
# PRE-DEPLOYMENT CHECKS
# ==============================================================================

print_header "Pre-Deployment Checks"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    print_error "Wrangler CLI is not installed"
    echo "Install it with: npm install -g wrangler"
    exit 1
fi
print_success "Wrangler CLI is installed"

# Check if logged in to Cloudflare
if ! wrangler whoami &> /dev/null; then
    print_error "Not logged in to Cloudflare"
    echo "Run: wrangler login"
    exit 1
fi
print_success "Logged in to Cloudflare"

# Check if package.json exists
if [ ! -f "package.json" ]; then
    print_error "package.json not found"
    exit 1
fi
print_success "package.json found"

# ==============================================================================
# ENVIRONMENT CONFIGURATION
# ==============================================================================

print_header "Environment Configuration"

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    print_warning ".env.production not found"
    print_info "Creating .env.production from .env.example"

    if [ -f ".env.example" ]; then
        cp .env.example .env.production
        print_warning "Please update .env.production with your production values"
        print_info "Required variables:"
        echo "  - VITE_API_BASE_URL (your deployed Worker URL)"
        echo "  - VITE_OAUTH_REDIRECT_URI (your Pages URL + /oauth/callback)"
        echo ""
        read -p "Have you updated .env.production? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "Deployment cancelled. Please update .env.production first."
            exit 1
        fi
    else
        print_error ".env.example not found. Cannot create .env.production"
        exit 1
    fi
else
    print_success ".env.production found"
fi

# Display current configuration
print_info "Current production configuration:"
cat .env.production | grep -v "^#" | grep -v "^$"
echo ""

# ==============================================================================
# INSTALL DEPENDENCIES
# ==============================================================================

print_header "Installing Dependencies"

npm install
print_success "Dependencies installed"

# ==============================================================================
# TYPE CHECK
# ==============================================================================

print_header "Type Checking"

npm run type-check
print_success "Type check passed"

# ==============================================================================
# BUILD
# ==============================================================================

print_header "Building Production Bundle"

npm run build
print_success "Build completed"

# Check if dist directory exists
if [ ! -d "dist" ]; then
    print_error "dist directory not found. Build may have failed."
    exit 1
fi
print_success "dist directory found"

# ==============================================================================
# DEPLOY TO CLOUDFLARE PAGES
# ==============================================================================

print_header "Deploying to Cloudflare Pages"

# Get project name from package.json or use default
PROJECT_NAME=$(node -p "require('./package.json').name" 2>/dev/null || echo "crm-installer-frontend")
PROJECT_NAME=${PROJECT_NAME#*-} # Remove prefix if any

print_info "Project name: $PROJECT_NAME"
print_info "Deploying to Cloudflare Pages..."

wrangler pages deploy dist --project-name="$PROJECT_NAME"

print_success "Frontend deployed successfully!"

# ==============================================================================
# POST-DEPLOYMENT
# ==============================================================================

print_header "Post-Deployment Information"

# Try to get the deployed URL
print_info "Pages URL: https://$PROJECT_NAME.pages.dev"
print_info "Or check: wrangler pages deployment list --project-name=$PROJECT_NAME"

echo ""
print_warning "Important: Update your Cloudflare OAuth Application!"
echo "Add this redirect URI:"
echo "  https://$PROJECT_NAME.pages.dev/oauth/callback"
echo ""

print_success "Deployment complete!"

# ==============================================================================
# NEXT STEPS
# ==============================================================================

print_header "Next Steps"

echo "1. Update Cloudflare OAuth Application:"
echo "   - Go to: https://dash.cloudflare.com/profile/api-tokens"
echo "   - Edit your OAuth application"
echo "   - Add redirect URI: https://$PROJECT_NAME.pages.dev/oauth/callback"
echo ""
echo "2. Test the deployment:"
echo "   - Open: https://$PROJECT_NAME.pages.dev"
echo "   - Click 'Deploy to Cloudflare'"
echo "   - Complete the OAuth flow"
echo ""
echo "3. Set up custom domain (optional):"
echo "   - wrangler pages project create $PROJECT_NAME"
echo "   - Add custom domain in Cloudflare Dashboard"
echo ""
