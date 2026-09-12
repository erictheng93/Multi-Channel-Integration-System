# Hard-coded Credentials Audit

Date: 2026-09-12

## Executive summary

The current tree contained predictable accounts, a JWT-secret fallback, fixed bcrypt hashes,
and authentication rows in database backups. They were removed or changed to require
operator-supplied values. Git history was not rewritten.

## Findings

### HC-001

- Severity: High
- Location: scripts/test-user-login.ps1:1; scripts/admin/get-test-token.ts:20;
  scripts/admin/login-and-test.ts:10; scripts/admin/seed-agents.ts:12;
  scripts/create-test-users.ps1:1; scripts/migrate-to-drizzle.ts:71
- Evidence: operational scripts embedded account identifiers and plaintext defaults.
- Impact: deployments could be accessed with repository-known credentials.
- Fix: environment variables are required; missing values fail closed.
- Mitigation: rotate accounts created by the old scripts.
- False positive notes: synthetic unit-test fixtures were excluded.

### HC-002

- Severity: Critical
- Location: scripts/admin/generate-test-token.ts:4
- Evidence: a committed JWT signing fallback existed.
- Impact: reuse could allow administrator-token forgery.
- Fix: JWT_SECRET and TEST_USERNAME are mandatory.
- Mitigation: rotate JWT_SECRET if the fallback was ever used.
- False positive notes: none.

### HC-003

- Severity: High
- Location: database/schema.sql:125; database/legacy/create-admin.sql:3;
  docs/architecture/database/backup/remote-backup.sql:39;
  docs/architecture/database/backup/production-sync-20250903-103829.sql:38
- Evidence: committed account rows included fixed bcrypt hashes.
- Impact: hashes allow offline cracking and persist authentication material in every clone.
- Fix: schema/backup rows were removed; legacy seed SQL now uses placeholders.
- Mitigation: rotate affected passwords and exclude agent rows from future dumps.
- False positive notes: constant-time dummy hashes are not account credentials.

### HC-004

- Severity: High
- Location: src/utils/password-hash.ts:69;
  scripts/database/verify-password-hash.ts:3
- Evidence: helper utilities used fixed password, email, or hash values.
- Impact: operators could unknowingly reuse a repository-known credential.
- Fix: explicit arguments or environment variables are required.
- Mitigation: source values from a password manager or secret store.
- False positive notes: none.

## Method and regression control

The current tree was scanned with codebase-memory plus masked credential and provider-signature
patterns. Gitleaks was unavailable. tests/unit/security/audit-regressions.test.ts now scans
operational paths without printing matched values. Required names are documented in
config/operational-credentials.env.example.

If any removed value was real, rotate it. A coordinated history rewrite may also be needed,
but it is intentionally outside this patch because it disrupts every clone.
