#!/bin/bash

# ==============================================================================
# Web Installer - Security Check Script
# ==============================================================================
# This script performs comprehensive security checks on the Web Installer
# ==============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Configuration
BACKEND_URL=""
FRONTEND_URL=""

# Security score
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Functions
print_banner() {
    echo -e "${MAGENTA}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║         Web Installer Security Audit                     ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_section() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_check() {
    ((TOTAL_CHECKS++))
    echo -e "${CYAN}→ Check #$TOTAL_CHECKS: $1${NC}"
}

print_pass() {
    ((PASSED_CHECKS++))
    echo -e "${GREEN}  ✓ PASS - $1${NC}"
}

print_fail() {
    ((FAILED_CHECKS++))
    echo -e "${RED}  ✗ FAIL - $1${NC}"
}

print_warning() {
    ((WARNING_CHECKS++))
    echo -e "${YELLOW}  ⚠ WARNING - $1${NC}"
}

print_info() {
    echo -e "${CYAN}  ℹ $1${NC}"
}

# ==============================================================================
# SECURITY CHECKS
# ==============================================================================

check_https_enforcement() {
    print_check "HTTPS Enforcement"

    if [[ $BACKEND_URL == https://* ]] && [[ $FRONTEND_URL == https://* ]]; then
        print_pass "Both endpoints use HTTPS"
    else
        print_fail "HTTP detected - HTTPS required for production"
    fi
}

check_security_headers() {
    print_check "Security Headers"

    HEADERS=$(curl -s -I "$BACKEND_URL/health")

    SCORE=0
    MAX_SCORE=6

    # X-Frame-Options
    if echo "$HEADERS" | grep -qi "X-Frame-Options"; then
        print_info "✓ X-Frame-Options present"
        ((SCORE++))
    else
        print_warning "X-Frame-Options missing (clickjacking protection)"
    fi

    # X-Content-Type-Options
    if echo "$HEADERS" | grep -qi "X-Content-Type-Options"; then
        print_info "✓ X-Content-Type-Options present"
        ((SCORE++))
    else
        print_warning "X-Content-Type-Options missing (MIME sniffing protection)"
    fi

    # Strict-Transport-Security
    if echo "$HEADERS" | grep -qi "Strict-Transport-Security"; then
        print_info "✓ HSTS enabled"
        ((SCORE++))
    else
        print_warning "HSTS not detected (HTTPS enforcement)"
    fi

    # Content-Security-Policy
    if echo "$HEADERS" | grep -qi "Content-Security-Policy"; then
        print_info "✓ CSP configured"
        ((SCORE++))
    else
        print_warning "CSP not detected (XSS protection)"
    fi

    # X-XSS-Protection (deprecated but still useful)
    if echo "$HEADERS" | grep -qi "X-XSS-Protection"; then
        print_info "✓ X-XSS-Protection present"
        ((SCORE++))
    else
        print_info "X-XSS-Protection not present (deprecated, CSP preferred)"
    fi

    # Referrer-Policy
    if echo "$HEADERS" | grep -qi "Referrer-Policy"; then
        print_info "✓ Referrer-Policy configured"
        ((SCORE++))
    else
        print_warning "Referrer-Policy missing (privacy protection)"
    fi

    if [ $SCORE -ge 4 ]; then
        print_pass "Security headers score: $SCORE/$MAX_SCORE"
    elif [ $SCORE -ge 2 ]; then
        print_warning "Security headers score: $SCORE/$MAX_SCORE (add more headers)"
    else
        print_fail "Security headers score: $SCORE/$MAX_SCORE (critical headers missing)"
    fi
}

check_cors_configuration() {
    print_check "CORS Configuration"

    # Test with valid origin
    VALID_ORIGIN=$(curl -s -I -H "Origin: https://example.com" "$BACKEND_URL/health" | grep -i "access-control-allow-origin")

    if [ ! -z "$VALID_ORIGIN" ]; then
        print_pass "CORS headers present"

        # Check if wildcard is used
        if echo "$VALID_ORIGIN" | grep -q "*"; then
            print_warning "CORS allows all origins (*) - consider restricting"
        else
            print_info "CORS origin is restricted (good)"
        fi
    else
        print_fail "CORS headers missing"
    fi
}

check_sensitive_data_exposure() {
    print_check "Sensitive Data Exposure"

    # Check if secrets are exposed in responses
    RESPONSE=$(curl -s "$BACKEND_URL/health")

    ISSUES=0

    if echo "$RESPONSE" | grep -qi "secret"; then
        print_fail "Possible secret exposure detected in response"
        ((ISSUES++))
    fi

    if echo "$RESPONSE" | grep -qi "password"; then
        print_fail "Possible password exposure detected in response"
        ((ISSUES++))
    fi

    if echo "$RESPONSE" | grep -qi "apikey\|api_key\|api-key"; then
        print_fail "Possible API key exposure detected in response"
        ((ISSUES++))
    fi

    if [ $ISSUES -eq 0 ]; then
        print_pass "No sensitive data exposed in responses"
    fi
}

check_oauth_pkce() {
    print_check "OAuth PKCE Implementation"

    RESPONSE=$(curl -s "$BACKEND_URL/oauth/authorize?redirect_uri=http://localhost:3000/oauth/callback")

    # Check for state parameter
    if echo "$RESPONSE" | grep -q '"state"'; then
        print_info "✓ State parameter present (CSRF protection)"
    else
        print_fail "State parameter missing (CSRF vulnerability)"
        return
    fi

    # Check for code verifier
    if echo "$RESPONSE" | grep -q '"codeVerifier"'; then
        print_info "✓ Code verifier present (PKCE)"
    else
        print_fail "Code verifier missing (PKCE not implemented)"
        return
    fi

    # Check minimum length
    CODE_VERIFIER=$(echo "$RESPONSE" | grep -o '"codeVerifier":"[^"]*"' | cut -d'"' -f4)
    STATE=$(echo "$RESPONSE" | grep -o '"state":"[^"]*"' | cut -d'"' -f4)

    if [ ${#CODE_VERIFIER} -ge 43 ] && [ ${#STATE} -ge 32 ]; then
        print_pass "PKCE and state parameters meet security requirements"
    else
        print_fail "PKCE or state parameters too short (security risk)"
    fi
}

check_input_validation() {
    print_check "Input Validation"

    # Test with invalid project name (uppercase, spaces)
    RESPONSE1=$(curl -s -X POST "$BACKEND_URL/deployment/start" \
        -H "Content-Type: application/json" \
        -d '{"projectName":"INVALID NAME","adminEmail":"test@test.com"}')

    # Test with invalid email
    RESPONSE2=$(curl -s -X POST "$BACKEND_URL/deployment/start" \
        -H "Content-Type: application/json" \
        -d '{"projectName":"valid-name","adminEmail":"invalid-email"}')

    # Test with SQL injection attempt
    RESPONSE3=$(curl -s -X POST "$BACKEND_URL/deployment/start" \
        -H "Content-Type: application/json" \
        -d '{"projectName":"test'\'' OR '\''1'\''='\''1","adminEmail":"test@test.com"}')

    VALIDATED=0

    if echo "$RESPONSE1" | grep -qi "error"; then
        print_info "✓ Invalid project name rejected"
        ((VALIDATED++))
    else
        print_fail "Invalid project name accepted (security risk)"
    fi

    if echo "$RESPONSE2" | grep -qi "error"; then
        print_info "✓ Invalid email rejected"
        ((VALIDATED++))
    else
        print_fail "Invalid email accepted (security risk)"
    fi

    if echo "$RESPONSE3" | grep -qi "error"; then
        print_info "✓ SQL injection attempt rejected"
        ((VALIDATED++))
    else
        print_fail "SQL injection not detected (critical vulnerability)"
    fi

    if [ $VALIDATED -eq 3 ]; then
        print_pass "Input validation working correctly"
    else
        print_fail "Input validation insufficient ($VALIDATED/3 checks passed)"
    fi
}

check_rate_limiting() {
    print_check "Rate Limiting / DDoS Protection"

    # Send rapid requests
    RESPONSES=""
    for i in {1..20}; do
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health")
        RESPONSES="$RESPONSES $HTTP_CODE"
    done

    # Check if server handled all requests
    if echo "$RESPONSES" | grep -q "429"; then
        print_pass "Rate limiting is active (429 Too Many Requests)"
    else
        # Check if all requests succeeded
        FAILED=$(echo "$RESPONSES" | grep -v "200" | wc -w)

        if [ $FAILED -eq 0 ]; then
            print_warning "No rate limiting detected - consider implementing"
        else
            print_fail "Server struggled with rapid requests ($FAILED/20 failed)"
        fi
    fi
}

check_error_messages() {
    print_check "Error Message Information Disclosure"

    # Test 404
    RESPONSE_404=$(curl -s "$BACKEND_URL/nonexistent-endpoint")

    # Test invalid JSON
    RESPONSE_400=$(curl -s -X POST "$BACKEND_URL/deployment/start" \
        -H "Content-Type: application/json" \
        -d 'invalid json')

    ISSUES=0

    # Check for stack traces
    if echo "$RESPONSE_404" | grep -qi "stack\|trace\|line\s*[0-9]"; then
        print_fail "Stack trace exposed in error message (information disclosure)"
        ((ISSUES++))
    fi

    if echo "$RESPONSE_400" | grep -qi "stack\|trace\|line\s*[0-9]"; then
        print_fail "Stack trace exposed in error message (information disclosure)"
        ((ISSUES++))
    fi

    # Check for internal paths
    if echo "$RESPONSE_404 $RESPONSE_400" | grep -qi "/src/\|/node_modules/\|C:\\\|/home/"; then
        print_fail "Internal file paths exposed (information disclosure)"
        ((ISSUES++))
    fi

    if [ $ISSUES -eq 0 ]; then
        print_pass "Error messages do not leak sensitive information"
    fi
}

check_session_security() {
    print_check "Session Security (Frontend)"

    RESPONSE=$(curl -s "$FRONTEND_URL")

    # Check if session data is exposed in HTML
    if echo "$RESPONSE" | grep -qi "sessionStorage\|localStorage" | grep -qi "token\|secret"; then
        print_warning "Session data handling detected - ensure secure practices"
    else
        print_info "No obvious session data exposure in HTML"
    fi

    # Check if frontend uses secure session storage
    print_info "Frontend uses sessionStorage for OAuth tokens (client-side)"
    print_warning "Ensure tokens are cleared on logout"
}

check_dependencies() {
    print_check "Dependency Vulnerabilities"

    print_info "Checking backend dependencies..."

    cd backend 2>/dev/null || cd ../backend 2>/dev/null || print_warning "Cannot access backend directory"

    if [ -f "package.json" ]; then
        # Check for npm audit
        AUDIT_OUTPUT=$(npm audit --json 2>/dev/null || echo "{\"vulnerabilities\":{}}")

        HIGH_VULNS=$(echo "$AUDIT_OUTPUT" | grep -o '"high":[0-9]*' | cut -d':' -f2)
        CRITICAL_VULNS=$(echo "$AUDIT_OUTPUT" | grep -o '"critical":[0-9]*' | cut -d':' -f2)

        if [ -z "$HIGH_VULNS" ]; then HIGH_VULNS=0; fi
        if [ -z "$CRITICAL_VULNS" ]; then CRITICAL_VULNS=0; fi

        if [ "$CRITICAL_VULNS" -gt 0 ]; then
            print_fail "Critical vulnerabilities found: $CRITICAL_VULNS"
        elif [ "$HIGH_VULNS" -gt 0 ]; then
            print_warning "High vulnerabilities found: $HIGH_VULNS"
        else
            print_pass "No critical or high vulnerabilities detected"
        fi
    else
        print_warning "package.json not found - skipping dependency check"
    fi

    cd - > /dev/null 2>&1
}

check_content_type() {
    print_check "Content-Type Headers"

    HEADERS=$(curl -s -I "$BACKEND_URL/health")

    if echo "$HEADERS" | grep -qi "Content-Type: application/json"; then
        print_pass "JSON endpoints use correct Content-Type"
    else
        print_warning "Content-Type header may be missing"
    fi
}

check_authentication() {
    print_check "Authentication Requirements"

    # Test deployment endpoint without auth
    RESPONSE=$(curl -s -X POST "$BACKEND_URL/deployment/start" \
        -H "Content-Type: application/json" \
        -d '{"projectName":"test","adminEmail":"test@test.com"}')

    # Should fail without OAuth token
    if echo "$RESPONSE" | grep -qi "error\|required\|unauthorized\|authentication"; then
        print_pass "Protected endpoints require authentication"
    else
        print_warning "Endpoint may not require authentication"
    fi
}

# ==============================================================================
# SECURITY SCORE
# ==============================================================================

calculate_security_score() {
    print_section "Security Score"

    TOTAL=$((PASSED_CHECKS + FAILED_CHECKS + WARNING_CHECKS))

    if [ $TOTAL -eq 0 ]; then
        echo "No checks completed"
        return
    fi

    # Calculate score (Pass = 100%, Warning = 50%, Fail = 0%)
    SCORE=$(( (PASSED_CHECKS * 100 + WARNING_CHECKS * 50) / TOTAL ))

    echo ""
    if [ $SCORE -ge 90 ]; then
        echo -e "  Overall Score: ${GREEN}${SCORE}/100 🛡️ 🛡️ 🛡️${NC}"
        echo -e "  Security Level: ${GREEN}EXCELLENT${NC}"
    elif [ $SCORE -ge 75 ]; then
        echo -e "  Overall Score: ${GREEN}${SCORE}/100 🛡️ 🛡️${NC}"
        echo -e "  Security Level: ${GREEN}GOOD${NC}"
    elif [ $SCORE -ge 60 ]; then
        echo -e "  Overall Score: ${YELLOW}${SCORE}/100 🛡️${NC}"
        echo -e "  Security Level: ${YELLOW}FAIR${NC}"
    else
        echo -e "  Overall Score: ${RED}${SCORE}/100${NC}"
        echo -e "  Security Level: ${RED}NEEDS IMPROVEMENT${NC}"
    fi

    echo ""
    echo "  Total Checks:    $TOTAL"
    echo -e "  ${GREEN}Passed:          $PASSED_CHECKS${NC}"
    echo -e "  ${YELLOW}Warnings:        $WARNING_CHECKS${NC}"
    echo -e "  ${RED}Failed:          $FAILED_CHECKS${NC}"
    echo ""
}

# ==============================================================================
# RECOMMENDATIONS
# ==============================================================================

provide_security_recommendations() {
    print_section "Security Recommendations"

    echo "High Priority:"
    echo ""
    echo "  1. ✅ Ensure all secrets are set via 'wrangler secret put'"
    echo "  2. ✅ Rotate OAuth credentials every 90 days"
    echo "  3. ✅ Enable HSTS headers (Strict-Transport-Security)"
    echo "  4. ✅ Implement Content-Security-Policy headers"
    echo "  5. ✅ Add rate limiting to prevent DDoS attacks"
    echo ""
    echo "Medium Priority:"
    echo ""
    echo "  6. ⚠ Add X-Frame-Options header (clickjacking protection)"
    echo "  7. ⚠ Add X-Content-Type-Options header (MIME sniffing)"
    echo "  8. ⚠ Implement request size limits"
    echo "  9. ⚠ Add logging and monitoring for security events"
    echo " 10. ⚠ Regular dependency updates (npm audit)"
    echo ""
    echo "Low Priority:"
    echo ""
    echo " 11. ℹ Configure Referrer-Policy header"
    echo " 12. ℹ Implement session timeout"
    echo " 13. ℹ Add security.txt file"
    echo " 14. ℹ Consider Web Application Firewall (WAF)"
    echo ""
}

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================

clear
print_banner

# Get URLs
if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Enter deployment URLs for security audit:"
    echo ""
    read -p "Backend Worker URL: " BACKEND_URL
    read -p "Frontend Pages URL: " FRONTEND_URL
else
    BACKEND_URL="$1"
    FRONTEND_URL="$2"
fi

if [ -z "$BACKEND_URL" ] || [ -z "$FRONTEND_URL" ]; then
    echo -e "${RED}Error: Both URLs are required${NC}"
    echo "Usage: $0 <backend-url> <frontend-url>"
    exit 1
fi

echo ""
echo "Security Audit Configuration:"
echo "  Backend:  $BACKEND_URL"
echo "  Frontend: $FRONTEND_URL"
echo ""
read -p "Press Enter to start security audit..."

# Run security checks
check_https_enforcement
check_security_headers
check_cors_configuration
check_sensitive_data_exposure
check_oauth_pkce
check_input_validation
check_rate_limiting
check_error_messages
check_session_security
check_content_type
check_authentication
check_dependencies

# Calculate score
calculate_security_score

# Provide recommendations
provide_security_recommendations

# ==============================================================================
# SUMMARY
# ==============================================================================

print_section "Audit Complete"

if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "${GREEN}✓ No critical security issues detected!${NC}"
    echo ""
    echo "Your Web Installer passes security audit."
else
    echo -e "${RED}⚠ Security issues detected!${NC}"
    echo ""
    echo "Please address the failed checks above before production deployment."
fi

echo ""
echo "Next Steps:"
echo "  1. Address all FAIL items immediately"
echo "  2. Review WARNING items and fix if possible"
echo "  3. Run E2E tests: ./e2e-test.sh"
echo "  4. Run performance benchmarks: ./benchmark.sh"
echo ""
