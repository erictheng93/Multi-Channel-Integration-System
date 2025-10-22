# Backups Directory

This directory contains historical backups of code and database files for recovery purposes.

## Directory Structure

### Timestamped Backups
- `2025-09-25T10-11-48-117Z/` - Code snapshot from September 25, 2025
- `2025-09-25T11-05-20-566Z/` - Code snapshot from September 25, 2025

### Feature-specific Backups
- `old-migrations/` - Historical database migration files (150KB)
- `phase2-cleanup/` - Backup from phase 2 cleanup process
- `qrcode-simple-backup-20250930/` - QR code module backup from September 30, 2025
- `realtime-handlers-backup/` - Real-time handlers backup

### File Backups
- `session-main.ts.backup` - Session handler backup (968 bytes)
- `session-utils.ts.backup` - Session utilities backup (11.4KB)

## Backup Policy

### Retention
- Keep timestamped backups for 30 days
- Keep feature-specific backups until feature is stable
- Archive old backups to external storage if needed

### Usage
- Only restore backups when necessary for recovery
- Document any restoration in CHANGELOG.md
- Verify backup integrity before restoration

## Total Size
- Current total: ~614KB

## Last Updated
- 2025-10-22: Consolidated backup/ and backups/ directories
