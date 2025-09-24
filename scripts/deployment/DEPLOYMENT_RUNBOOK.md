# WebSocket Migration Deployment Runbook
**專案名稱：Multi-Channel Support MVP - Production Deployment Guide**

## Overview

This runbook provides comprehensive procedures for deploying the WebSocket + Durable Objects migration to production safely and efficiently. It includes pre-deployment checks, step-by-step deployment procedures, monitoring guidelines, and emergency response protocols.

**⚠️ CRITICAL: This is a production deployment affecting all customer communications. Follow ALL procedures exactly.**

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Deployment Phases](#deployment-phases)
3. [Step-by-Step Procedures](#step-by-step-procedures)
4. [Monitoring and Validation](#monitoring-and-validation)
5. [Emergency Procedures](#emergency-procedures)
6. [Post-Deployment Tasks](#post-deployment-tasks)
7. [Rollback Procedures](#rollback-procedures)
8. [Troubleshooting Guide](#troubleshooting-guide)

---

## Pre-Deployment Checklist

### Technical Prerequisites

#### ✅ Code Quality Validation
- [ ] All unit tests passing (132/132 tests)
- [ ] Integration tests passing
- [ ] TypeScript compilation successful (0 errors)
- [ ] ESLint checks passing (0 warnings/errors)
- [ ] Security vulnerability scan clean
- [ ] Performance benchmarks met

#### ✅ Infrastructure Validation
- [ ] Cloudflare Workers environment ready
- [ ] D1 database connectivity verified
- [ ] KV namespace access confirmed
- [ ] R2 storage buckets configured
- [ ] Durable Objects namespace created
- [ ] DNS configurations verified

#### ✅ Feature Flag Preparation
- [ ] WebSocket feature flags configured
- [ ] Rollout percentages set correctly
- [ ] A/B testing framework ready
- [ ] Emergency disable switches prepared
- [ ] Targeting rules validated

#### ✅ Monitoring and Alerting
- [ ] Monitoring dashboards operational
- [ ] Alert thresholds configured
- [ ] Notification channels tested
- [ ] Emergency contacts updated
- [ ] On-call rotation confirmed

#### ✅ Backup and Recovery
- [ ] Database backup completed
- [ ] Configuration backups stored
- [ ] Previous deployment artifacts preserved
- [ ] Rollback procedures validated
- [ ] Recovery time objectives confirmed

### Team Readiness

#### ✅ Personnel
- [ ] Deployment lead assigned
- [ ] Technical team on standby
- [ ] Customer support team briefed
- [ ] Product management informed
- [ ] Executive stakeholders notified

#### ✅ Communication
- [ ] Deployment communication plan ready
- [ ] Customer notification templates prepared
- [ ] Internal status page configured
- [ ] Escalation procedures documented
- [ ] Emergency contact list updated

### Business Validation

#### ✅ Timing
- [ ] No conflicting deployments scheduled
- [ ] Customer support coverage confirmed
- [ ] Peak usage hours avoided
- [ ] Maintenance window approved
- [ ] Rollback window available

#### ✅ Impact Assessment
- [ ] Customer impact analysis completed
- [ ] Business continuity plan reviewed
- [ ] Service level agreements considered
- [ ] Risk mitigation strategies prepared
- [ ] Go/no-go criteria defined

---

## Deployment Phases

### Phase 1: Development Environment
**Duration:** 30 minutes
**Scope:** Internal testing only
**Rollout:** 100% to admin users

**Success Criteria:**
- Error rate < 10%
- Basic functionality working
- No critical errors

### Phase 2: Staging Environment
**Duration:** 2 hours
**Scope:** Extended testing
**Rollout:** 100% to admin + team users

**Success Criteria:**
- Error rate < 5%
- Performance within 200ms of baseline
- End-to-end tests passing

### Phase 3: Production Canary
**Duration:** 1 hour
**Scope:** Limited production users
**Rollout:** 5% to admin users only

**Success Criteria:**
- Error rate < 2%
- No user complaints
- Performance within 100ms of baseline

### Phase 4: Production Early Adopters
**Duration:** 4 hours
**Scope:** Power users and team leaders
**Rollout:** 25% to admin + team + high-activity users

**Success Criteria:**
- Error rate < 2.5%
- Max 2 user complaints
- System stability maintained

### Phase 5: Production Majority
**Duration:** 8 hours
**Scope:** Most users
**Rollout:** 75% to general population

**Success Criteria:**
- Error rate < 3%
- Max 5 user complaints
- SLA targets met

### Phase 6: Production Complete
**Duration:** Permanent
**Scope:** All users
**Rollout:** 100% complete migration

**Success Criteria:**
- Error rate < 2%
- Max 3 user complaints
- Full system stability

---

## Step-by-Step Procedures

### Phase 1: Development Deployment

#### Step 1.1: Environment Preparation
```bash
# 1. Validate prerequisites
npm run lint:check
npm run build
npm run test:run

# 2. Deploy to development
.\scripts\deployment\deploy-websocket-migration.ps1 -TargetStage development -DryRun

# 3. Verify deployment
npm run test:integration
```

#### Step 1.2: Feature Flag Configuration
```bash
# Configure development feature flags
curl -X POST https://your-api.com/api/admin/feature-flags \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "flag": "websocket_connections",
    "enabled": true,
    "rolloutPercentage": 100,
    "targeting": {"includeRoles": ["admin"]}
  }'
```

#### Step 1.3: Validation
- [ ] WebSocket connections establishing
- [ ] Message broadcasting working
- [ ] Durable Objects responding
- [ ] SSE fallback functioning
- [ ] No critical errors in logs

### Phase 2: Staging Deployment

#### Step 2.1: Pre-Deployment Validation
```bash
# Run comprehensive test suite
cd frontend && npm run test:coverage
cd .. && npm run test:handlers
npm run test:performance
```

#### Step 2.2: Staging Deployment
```bash
# Deploy to staging environment
.\scripts\deployment\deploy-websocket-migration.ps1 -TargetStage staging
```

#### Step 2.3: Extended Testing
- [ ] Load testing completed
- [ ] Security testing passed
- [ ] Cross-browser compatibility verified
- [ ] Mobile device testing completed
- [ ] API integration tests passed

### Phase 3: Production Canary

#### Step 3.1: Production Preparation
```bash
# 1. Backup production database
npm run db:backup:prod

# 2. Verify monitoring systems
curl -f https://your-monitoring.com/health

# 3. Test emergency procedures
.\scripts\deployment\rollback-websocket-migration.ps1 -DryRun
```

#### Step 3.2: Canary Deployment
```bash
# Deploy canary with enhanced monitoring
.\scripts\deployment\deploy-websocket-migration.ps1 -TargetStage production_canary
```

#### Step 3.3: Canary Monitoring (60 minutes)
**Every 5 minutes, check:**
- [ ] Error rate < 2%
- [ ] Average latency < baseline + 100ms
- [ ] Connection success rate > 98%
- [ ] No user complaints
- [ ] Resource usage normal

**If any metric fails, immediately execute:**
```bash
.\scripts\deployment\rollback-websocket-migration.ps1 -RollbackType instant -Reason "Canary failure: [specific metric]"
```

### Phase 4: Production Early Adopters

#### Step 4.1: Canary Success Validation
```bash
# Generate canary performance report
curl -X GET https://your-api.com/api/admin/deployment/performance-report?phase=canary
```

**Required approvals:**
- [ ] Technical lead approval
- [ ] Product manager approval
- [ ] Customer support clearance

#### Step 4.2: Early Adopter Deployment
```bash
# Expand to 25% rollout
.\scripts\deployment\deploy-websocket-migration.ps1 -TargetStage production_early
```

#### Step 4.3: Extended Monitoring (4 hours)
**Every 15 minutes, check:**
- [ ] Error rate trends
- [ ] Latency percentiles (P95, P99)
- [ ] User satisfaction metrics
- [ ] Support ticket volume
- [ ] System resource utilization

### Phase 5: Production Majority

#### Step 5.1: Early Adopter Success Validation
```bash
# Generate comprehensive performance report
curl -X GET https://your-api.com/api/admin/deployment/performance-report?phase=early
```

#### Step 5.2: Majority Deployment
```bash
# Expand to 75% rollout
.\scripts\deployment\deploy-websocket-migration.ps1 -TargetStage production_majority
```

#### Step 5.3: Capacity Monitoring (8 hours)
**Every 30 minutes, check:**
- [ ] System capacity metrics
- [ ] Database performance
- [ ] Network bandwidth utilization
- [ ] Durable Object scaling
- [ ] Cost optimization opportunities

### Phase 6: Production Complete

#### Step 6.1: Majority Success Validation
```bash
# Final validation before complete rollout
curl -X GET https://your-api.com/api/admin/deployment/performance-report?phase=majority
```

#### Step 6.2: Complete Deployment
```bash
# Complete 100% rollout
.\scripts\deployment\deploy-websocket-migration.ps1 -TargetStage production_complete
```

#### Step 6.3: SSE Deprecation Planning
- [ ] Monitor SSE usage decline
- [ ] Plan SSE infrastructure scaling down
- [ ] Document migration completion
- [ ] Update system architecture diagrams

---

## Monitoring and Validation

### Real-Time Monitoring Dashboard

**Primary Metrics (Check every 5 minutes during deployment):**
- WebSocket connection success rate
- SSE fallback activation rate
- Average message latency
- Error rate by connection type
- User complaint volume

**Secondary Metrics (Check every 15 minutes):**
- Resource utilization (CPU, Memory)
- Database performance metrics
- API response times
- Durable Object scaling metrics
- Cache hit rates

**Business Metrics (Check every 30 minutes):**
- Customer satisfaction scores
- Support ticket volume
- Feature adoption rates
- Revenue impact indicators
- User engagement metrics

### Automated Alerts

**Critical Alerts (Immediate response required):**
- Error rate > 5%
- Average latency increase > 200ms
- Connection failure rate > 10%
- System availability < 99%

**Warning Alerts (Monitor closely):**
- Error rate > 3%
- Latency increase > 150ms
- Connection failure rate > 8%
- Resource usage > 85%

### Performance Baselines

**Pre-Migration Baselines:**
- Average latency: 65ms (SSE)
- Error rate: 1.5%
- Connection success: 98.5%
- User satisfaction: 4.2/5

**Target Post-Migration:**
- Average latency: 45ms (WebSocket)
- Error rate: < 2%
- Connection success: > 97%
- User satisfaction: > 4.2/5

---

## Emergency Procedures

### 🚨 CRITICAL ALERT RESPONSE

#### Immediate Actions (0-2 minutes)
1. **Acknowledge Alert**
   ```bash
   # Log into monitoring dashboard
   # Verify alert is not false positive
   # Acknowledge alert to stop notifications
   ```

2. **Assess Severity**
   - Critical: Error rate > 5% OR Complete service failure
   - High: Error rate 3-5% OR Significant performance degradation
   - Medium: Error rate 2-3% OR Minor performance issues

3. **Notify Team**
   ```bash
   # Send immediate notification to on-call team
   # Escalate to deployment lead if critical
   # Inform customer support of potential impact
   ```

#### Critical Severity Response (2-5 minutes)
```bash
# Execute immediate emergency rollback
.\scripts\deployment\rollback-websocket-migration.ps1 -RollbackType instant -Reason "Critical alert: [description]" -SkipConfirmation
```

#### High Severity Response (5-15 minutes)
```bash
# Execute gradual rollback
.\scripts\deployment\rollback-websocket-migration.ps1 -RollbackType gradual -Reason "High severity alert: [description]" -GradualDurationMinutes 15
```

#### Medium Severity Response (15-30 minutes)
```bash
# Execute partial rollback for affected users
.\scripts\deployment\rollback-websocket-migration.ps1 -RollbackType partial -TargetUsers @(affected_user_list) -Reason "Medium severity alert: [description]"
```

### 🔄 ROLLBACK DECISION MATRIX

| Condition | Action | Timeline | Approval Required |
|-----------|--------|----------|-------------------|
| Error rate > 5% | Instant Rollback | Immediate | None |
| Error rate 3-5% | Gradual Rollback | 15 minutes | Deployment Lead |
| Latency > +300ms | Instant Rollback | Immediate | None |
| Latency +200-300ms | Gradual Rollback | 30 minutes | Deployment Lead |
| Connection failures > 15% | Instant Rollback | Immediate | None |
| Connection failures 10-15% | Partial Rollback | 10 minutes | Technical Lead |
| User complaints > 15 | Gradual Rollback | 30 minutes | Product Manager |
| System unavailable | Instant Rollback | Immediate | None |

### 📞 ESCALATION PROCEDURES

#### Level 1: On-Call Engineer (0-15 minutes)
- Monitor alerts and metrics
- Execute automated responses
- Perform initial troubleshooting
- Escalate if unresolved in 15 minutes

#### Level 2: Deployment Lead (15-30 minutes)
- Make rollback decisions
- Coordinate with multiple teams
- Communicate with stakeholders
- Escalate if unresolved in 30 minutes

#### Level 3: Technical Director (30-60 minutes)
- Make architectural decisions
- Authorize emergency procedures
- Interface with executive team
- Coordinate external communications

#### Level 4: Executive Team (60+ minutes)
- Business continuity decisions
- Customer communication strategy
- Press and regulatory response
- Long-term recovery planning

---

## Post-Deployment Tasks

### Immediate (0-2 hours after completion)
- [ ] Verify all phase success criteria met
- [ ] Generate deployment success report
- [ ] Update system documentation
- [ ] Notify all stakeholders of completion
- [ ] Schedule post-deployment review meeting

### Short-term (2-24 hours)
- [ ] Monitor system stability
- [ ] Analyze performance metrics
- [ ] Review customer feedback
- [ ] Update capacity planning models
- [ ] Document lessons learned

### Medium-term (1-7 days)
- [ ] Conduct post-deployment retrospective
- [ ] Update deployment procedures
- [ ] Plan SSE infrastructure optimization
- [ ] Implement performance optimizations
- [ ] Update disaster recovery procedures

### Long-term (1-4 weeks)
- [ ] Complete migration assessment
- [ ] Update architecture documentation
- [ ] Plan future enhancements
- [ ] Optimize operational procedures
- [ ] Share knowledge with broader team

---

## Rollback Procedures

### 🔴 INSTANT ROLLBACK (Emergency)
**When:** Critical system failure, error rate > 5%
**Timeline:** 30-60 seconds
**Impact:** All users immediately reverted to SSE

```bash
.\scripts\deployment\rollback-websocket-migration.ps1 -RollbackType instant -Reason "Emergency rollback: [specific reason]" -SkipConfirmation
```

**Post-Rollback Actions:**
1. Verify all users on SSE
2. Check system stability
3. Notify all stakeholders
4. Begin incident investigation
5. Plan recovery strategy

### 🟡 GRADUAL ROLLBACK (Controlled)
**When:** Performance degradation, error rate 3-5%
**Timeline:** 15-30 minutes
**Impact:** Progressive reduction of WebSocket usage

```bash
.\scripts\deployment\rollback-websocket-migration.ps1 -RollbackType gradual -GradualDurationMinutes 30 -Reason "Gradual rollback: [specific reason]"
```

**Monitoring During Rollback:**
- Check metrics every 2 minutes
- Verify error rate trending down
- Ensure user experience improving
- Monitor for additional issues

### 🔵 PARTIAL ROLLBACK (Targeted)
**When:** Specific user/team issues
**Timeline:** 2-5 minutes
**Impact:** Only affected users reverted

```bash
.\scripts\deployment\rollback-websocket-migration.ps1 -RollbackType partial -TargetUsers @("user1", "user2") -TargetTeams @(1, 2) -Reason "Partial rollback: [specific reason]"
```

**Use Cases:**
- Specific geographic regions affected
- Particular user roles experiencing issues
- Individual team/conversation problems
- Browser-specific compatibility issues

---

## Troubleshooting Guide

### Common Issues and Solutions

#### Issue: WebSocket Connections Failing
**Symptoms:**
- High connection failure rate
- Users falling back to SSE frequently
- "Connection failed" errors in logs

**Diagnosis:**
```bash
# Check Durable Object health
curl -X GET https://your-api.com/api/admin/durable-objects/health

# Check WebSocket endpoint connectivity
curl -X GET https://your-api.com/api/health/websocket

# Review connection logs
tail -f /var/log/websocket-connections.log
```

**Solutions:**
1. Restart Durable Objects if unhealthy
2. Check network connectivity issues
3. Verify authentication tokens
4. Scale Durable Object instances if overloaded

#### Issue: High Latency
**Symptoms:**
- Message delivery delays
- Slow connection establishment
- User complaints about responsiveness

**Diagnosis:**
```bash
# Check latency metrics
curl -X GET https://your-api.com/api/admin/metrics/latency

# Check database performance
curl -X GET https://your-api.com/api/admin/database/performance

# Review processing times
grep "processing_time" /var/log/application.log
```

**Solutions:**
1. Optimize database queries
2. Scale Durable Object instances
3. Implement message batching
4. Check for network bottlenecks

#### Issue: Memory/CPU Exhaustion
**Symptoms:**
- High resource utilization alerts
- Slow system response
- Connection timeouts

**Diagnosis:**
```bash
# Check resource metrics
curl -X GET https://your-api.com/api/admin/metrics/resources

# Check Durable Object memory usage
curl -X GET https://your-api.com/api/admin/durable-objects/memory

# Review system performance
top -p $(pgrep -f "cloudflare-worker")
```

**Solutions:**
1. Scale worker instances
2. Implement connection limits
3. Optimize memory usage in code
4. Enable connection pooling

#### Issue: User Complaints
**Symptoms:**
- Increased support tickets
- Feature not working reports
- User experience degradation

**Diagnosis:**
```bash
# Check user experience metrics
curl -X GET https://your-api.com/api/admin/metrics/user-experience

# Review support ticket trends
curl -X GET https://your-api.com/api/admin/support/tickets?filter=websocket

# Check feature flag targeting
curl -X GET https://your-api.com/api/admin/feature-flags/websocket_connections
```

**Solutions:**
1. Adjust feature flag targeting
2. Improve error messaging
3. Enhance fallback mechanisms
4. Provide user education/documentation

### Emergency Contacts

#### Primary On-Call
- **Technical Lead:** [Name] - [Phone] - [Email]
- **DevOps Engineer:** [Name] - [Phone] - [Email]
- **Customer Support Lead:** [Name] - [Phone] - [Email]

#### Secondary Contacts
- **Product Manager:** [Name] - [Phone] - [Email]
- **Engineering Manager:** [Name] - [Phone] - [Email]
- **CTO:** [Name] - [Phone] - [Email]

#### External Contacts
- **Cloudflare Support:** enterprise-support@cloudflare.com
- **Third-party Monitoring:** [Contact Details]
- **Customer Success:** [Contact Details]

---

## Appendix

### Useful Commands

```bash
# Check deployment status
curl -X GET https://your-api.com/api/admin/deployment/status

# Get real-time metrics
curl -X GET https://your-api.com/api/admin/metrics/realtime

# Force SSE for specific user
curl -X POST https://your-api.com/api/admin/users/{userId}/force-sse

# Enable/disable feature flags
curl -X PUT https://your-api.com/api/admin/feature-flags/websocket_connections -d '{"enabled": false}'

# Get recent alerts
curl -X GET https://your-api.com/api/admin/alerts?hours=24

# Check system health
curl -X GET https://your-api.com/api/health
```

### Configuration Files

- `wrangler.toml` - Cloudflare Worker configuration
- `deployment-config.json` - Deployment settings
- `monitoring-config.yaml` - Monitoring configuration
- `feature-flags.json` - Feature flag definitions

### Documentation Links

- [WebSocket Architecture Documentation](./WEBSOCKET_DURABLE_OBJECTS_ARCHITECTURE.md)
- [Feature Flag Management Guide](./docs/feature-flags.md)
- [Monitoring and Alerting Setup](./docs/monitoring.md)
- [Emergency Response Procedures](./docs/emergency-procedures.md)

---

**Document Version:** 1.0
**Last Updated:** [Current Date]
**Next Review:** [Date + 3 months]
**Owned By:** Engineering Team
**Approved By:** Technical Lead, Product Manager, CTO