#!/bin/bash

# ==============================================================================
# Web Installer Backend Deployment Script
# ==============================================================================
# This script deploys the Web Installer backend to Cloudflare Workers
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

# Check if wrangler.toml exists
if [ ! -f "wrangler.toml" ]; then
    print_error "wrangler.toml not found"
    exit 1
fi
print_success "wrangler.toml found"

# Check if package.json exists
if [ ! -f "package.json" ]; then
    print_error "package.json not found"
    exit 1
fi
print_success "package.json found"

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

npm run build
print_success "Type check passed"

# ==============================================================================
# CHECK SECRETS
# ==============================================================================

print_header "Checking Required Secrets"

print_info "Checking if required secrets are set..."

# Note: We can't directly check if secrets are set, but we can remind the user
print_warning "Make sure you have set the following secrets:"
echo "  - CF_CLIENT_ID (Cloudflare OAuth Client ID)"
echo "  - CF_CLIENT_SECRET (Cloudflare OAuth Client Secret)"
echo "  - RESEND_API_KEY (Email service API key)"
echo ""
echo "Set secrets with: wrangler secret put <SECRET_NAME>"
echo ""
read -p "Have you set all required secrets? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_error "Deployment cancelled. Please set required secrets first."
    exit 1
fi

# ==============================================================================
# DEPLOY TO CLOUDFLARE WORKERS
# ==============================================================================

print_header "Deploying to Cloudflare Workers"

wrangler deploy

print_success "Backend deployed successfully!"

# ==============================================================================
# POST-DEPLOYMENT
# ==============================================================================

print_header "Post-Deployment Information"

# Get the deployed URL
WORKER_URL=$(wrangler deployments list 2>/dev/null | grep "https://" | head -1 | awk '{print $2}' || echo "")

if [ -z "$WORKER_URL" ]; then
    # Fallback: try to get from wrangler.toml
    WORKER_NAME=$(grep "name" wrangler.toml | head -1 | cut -d'"' -f2)
    print_info "Worker Name: $WORKER_NAME"
    print_info "URL: https://$WORKER_NAME.<your-subdomain>.workers.dev"
else
    print_success "Worker URL: $WORKER_URL"
fi

print_info "Test the deployment with:"
echo "  curl $WORKER_URL/health"
echo ""
print_info "View logs with:"
echo "  wrangler tail"
echo ""

print_success "Deployment complete!"

# ==============================================================================
# NEXT STEPS
# ==============================================================================

print_header "Next Steps"

echo "1. Test the health endpoint:"
echo "   curl <worker-url>/health"
echo ""
echo "2. Update your frontend .env.production with the Worker URL:"
echo "   VITE_API_BASE_URL=<worker-url>"
echo ""
echo "3. Deploy the frontend:"
echo "   cd ../frontend && ./deploy.sh"
echo ""
