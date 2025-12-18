# Database Migrations for Private Notes

This document explains how database migrations work in this Forge app using Forge SQL's migration system.

## How Forge SQL Migrations Work

Unlike traditional migration systems (Rails, Laravel, etc.), Forge SQL uses a **queue-based migration system** with automatic tracking:

### Key Concepts

1. **Migration Runner** (`migrationRunner` from `@forge/sql`)
   - Queues DDL operations with unique names
   - Tracks which migrations have run on each installation
   - Automatically re-runs failed migrations
   - Handles migration order

2. **Lazy Install-Time Guard (Recommended)**
   - First resolver call invokes a schema guard
   - If schema not ready, migrations are applied and a storage flag is set
   - Ensures schema exists without relying on scheduler or unsupported lifecycle hooks

3. **Per-Installation Tracking**
   - Each Jira site gets its own database instance
   - Migrations are tracked independently per installation
   - Schema versions can differ across installations (but shouldn't)

## Our Migration Structure

```
src/migrations/
├── schema.ts      # All DDL operations (CREATE TABLE statements)
└── runner.ts      # Migration runner logic
```

### Migration Files

**`src/migrations/schema.ts`**
- Contains all DDL operations as constants
- Each operation is a single SQL statement (Forge SQL limitation)
- Named with version prefix: `V001_CREATE_NOTES_TABLE`
- Uses `CREATE TABLE IF NOT EXISTS` for safety

**`src/migrations/runner.ts`**
- Queues all migrations using `migrationRunner.enqueue()`
- Provides `runMigrations()` function called by scheduled trigger
- Logs migration status for debugging

## Current Migrations

| Version | Name | Description |
|---------|------|-------------|
| v001 | create_notes_table | Creates notes table with all fields and indexes |
| v002 | create_note_permissions_table | Creates permissions table for sharing |
| v003 | create_notifications_table | Creates notifications table for user alerts |

## How Migrations Run

1. **App Installation**
   - User installs app on their Jira site
   - Forge creates empty database instance

2. **First Backend Use (Lazy Guard)**
   - The first resolver invocation calls `ensureMigrationsApplied()`
   - The guard checks a storage flag (schema_ready_v003) and `migrationRunner.list()` implicitly
   - If not ready, it runs the migrations and sets the flag

3. **Subsequent Calls**
   - The guard returns immediately because the flag is present
   - Only new migrations after a deploy would be applied (guard can be versioned)

## Adding New Migrations

### Step 1: Create DDL Operation

In `src/migrations/schema.ts`:

```typescript
/**
 * v004: Add index to notes table for better performance
 */
export const V004_ADD_NOTES_PERFORMANCE_INDEX = `
  CREATE INDEX idx_notes_compound ON notes (created_by, issue_key, created_at)
`;
```

### Step 2: Queue the Migration

In `src/migrations/runner.ts`:

```typescript
const queueMigrations = migrationRunner
  .enqueue('v001_create_notes_table', V001_CREATE_NOTES_TABLE)
  .enqueue('v002_create_note_permissions_table', V002_CREATE_NOTE_PERMISSIONS_TABLE)
  .enqueue('v003_create_notifications_table', V003_CREATE_NOTIFICATIONS_TABLE)
  .enqueue('v004_add_notes_performance_index', V004_ADD_NOTES_PERFORMANCE_INDEX); // NEW
```

### Step 3: Deploy

```bash
forge deploy
```

The next scheduled trigger will automatically run the new migration on all installations.

## Important Rules

### ✅ DO

- **Use `CREATE TABLE IF NOT EXISTS`** - Prevents errors on re-runs
- **Use unique operation names** - Required for tracking (format: `v###_descriptive_name`)
- **Make migrations backwards compatible** - Old app versions should work with new schema
- **Use AUTO_INCREMENT for primary keys** - Required for MySQL engine in this app
- **Add indexes for frequently queried columns**
- **Test migrations locally** - Use `forge tunnel` to test against real database

### ❌ DON'T

- **DON'T use foreign keys** - Not supported in Forge SQL
- **DON'T use multiple statements in one migration** - Each DDL must be a single query
- **DON'T use destructive changes** - Avoid `DROP TABLE`, `DROP COLUMN` if possible
- **DON'T use AUTO_INCREMENT** - Use AUTO_RANDOM instead
- **DON'T reorder existing migrations** - Migration order is important
- **DON'T rename operation names** - Will cause migrations to run again

## Forge SQL Limitations

1. **No Foreign Keys** - Cannot enforce referential integrity at database level
   - Solution: Handle cleanup manually in application code

2. **Single Query Per Statement** - Each migration can only contain one SQL statement
   - Solution: Create multiple migrations for complex changes

3. **No Rollbacks** - Cannot undo migrations automatically
   - Solution: Create new migration to reverse changes

4. **Storage Limits**
   - Development: 128 MiB
   - Staging: 256 MiB
   - Production: 1 GiB

5. **Rate Limits**
   - 150 DML requests/second
   - 25 DDL requests/minute

## Monitoring Migrations

### View Migration Status

1. Go to [Forge Developer Console](https://developer.atlassian.com/console/myapps/)
2. Select your app
3. Go to **SQL** → **Manage**
4. Select an installation
5. View **Schema viewer** to see:
   - Which migrations have run
   - Migration timestamps
   - Current table structure

### Check Logs

```bash
forge logs --follow
```

Look for migration log output:
```
=============================================================
Forge SQL Migration Runner
=============================================================
Starting database schema migrations...
✓ Migrations completed successfully: [...]
Migration status:
  ✓ v001_create_notes_table - Mon, 17 Dec 2025 12:34:56 GMT
  ✓ v002_create_note_permissions_table - Mon, 17 Dec 2025 12:34:57 GMT
  ✓ v003_create_notifications_table - Mon, 17 Dec 2025 12:34:58 GMT
=============================================================
```

## Troubleshooting

### Migration Failed

**Check logs:**
```bash
forge logs -e development
```

**Common causes:**
- Syntax error in SQL
- Violated constraint (e.g., UNIQUE)
- Table already exists (use `IF NOT EXISTS`)
- Hit rate limit (retry will happen automatically)

**Solution:** Fix the SQL and deploy. The migration will re-run on next trigger.

### Migration Not Running

**Possible causes:**
1. Scheduled trigger not configured in manifest
2. App not installed on any site
3. Less than 1 hour since installation

**Solution:** Wait for next hourly trigger or check manifest configuration.

### Duplicate Tables

**Cause:** Running DDL outside of migration system

**Solution:** Always use migration runner for schema changes. Never use raw `runSql()` for DDL.

## Best Practices

1. **Version Everything** - Use v### prefix for all migrations
2. **Document Changes** - Add comments explaining why each migration exists
3. **Test Locally** - Use `forge tunnel` to test migrations before deploying
4. **Monitor Logs** - Check logs after deployment to ensure migrations succeed
5. **Keep It Simple** - One logical change per migration
6. **Be Patient** - Migrations run hourly, not instantly

## Example: Complete Migration Workflow

```bash
# 1. Create new migration
edit src/migrations/schema.ts
edit src/migrations/runner.ts

# 2. Test locally
forge tunnel

# 3. Deploy
forge deploy

# 4. Monitor logs
forge logs --follow

# 5. Verify in Developer Console
# Check SQL → Manage → Schema viewer
```

## References

- [Forge SQL Documentation](https://developer.atlassian.com/platform/forge/storage-reference/sql/)
- [Manage Database Schema](https://developer.atlassian.com/platform/forge/storage-reference/sql-api-schema/)
- [Migration Tutorial](https://developer.atlassian.com/platform/forge/storage-reference/sql-tutorial/)
