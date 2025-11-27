# Backups Directory

This directory is now minimal after cleanup on 2025-11-27.

## Current Status

**All feature backups have been removed** as all features are stable in production:
- WebSocket: Using modern Durable Objects architecture
- Session: Using modular `src/modules/session/`
- QRCode: Using `src/modules/qrcode/`
- Realtime: Integrated into WebSocket infrastructure

## Database Backups (Preserved)

Database backups are stored in separate locations:
- `archive/remote_backup.sql` - Archive database snapshot
- `database/remote-database-backup.sql` - Database backup
- `docs/database/backup/` - Documentation database backups

## Backup Policy

### For Code
- **No code backups needed** - Use git history for recovery
- All transitional files (`.backup`, `-simplified.ts`, `-Enhanced.ts`) should be avoided
- Use feature branches for experimental code

### For Database
- Keep production database backups
- Document restoration procedures
- Verify backup integrity periodically

## Cleanup History

- **2025-11-27**: Major cleanup
  - Removed: timestamp backups, feature backups, .backup files
  - Removed: 28+ files, ~19,000 lines of code
  - All features confirmed stable

- **2025-10-22**: Consolidated backup/ and backups/ directories

## Recovery

If you need to recover deleted files:
```bash
# View deleted files in git history
git log --diff-filter=D --summary

# Restore a specific file from history
git checkout <commit-hash>^ -- <file-path>

# Or use the rollback stash from cleanup
git stash list  # Find "Rollback point before backup cleanup"
git stash show -p stash@{N}  # View contents
```
