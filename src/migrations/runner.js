const { migrationRunner } = require('@forge/sql');
const { storage } = require('@forge/api');
const {
  V001_CREATE_NOTES_TABLE,
  V002_CREATE_NOTE_PERMISSIONS_TABLE,
  V003_CREATE_NOTIFICATIONS_TABLE
} = require('./schema');

/**
 * Queue all migrations for execution
 * Each migration is tracked individually by Forge SQL
 */
const queueMigrations = () => {
  return migrationRunner
    .enqueue('v001_create_notes_table', V001_CREATE_NOTES_TABLE)
    .enqueue('v002_create_note_permissions_table', V002_CREATE_NOTE_PERMISSIONS_TABLE)
    .enqueue('v003_create_notifications_table', V003_CREATE_NOTIFICATIONS_TABLE);
};

/**
 * Runs all queued migrations
 * Should be called on first resolver use or scheduled trigger
 */
const runMigrations = async () => {
  console.log('=============================================================');
  console.log('Forge SQL Migration Runner');
  console.log('=============================================================');
  console.log('Starting database schema migrations...');

  try {
    // Queue all migrations
    await queueMigrations();
    
    // Get migration status
    const migrations = await migrationRunner.list();
    
    console.log('✓ Migrations completed successfully:', migrations.map(m => m.name));
    console.log('Migration status:');
    migrations.forEach(migration => {
      const status = migration.executed_at ? '✓' : '⏳';
      const timestamp = migration.executed_at || 'pending';
      console.log(`  ${status} ${migration.name} - ${timestamp}`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    console.log('=============================================================');
  }
};

/**
 * Lazy guard to ensure migrations are applied before any database operations
 * Uses storage flag to avoid checking on every request
 */
const ensureMigrationsApplied = async () => {
  const SCHEMA_VERSION_KEY = 'schema_ready_v003';
  
  try {
    // Check if we've already run migrations for this version
    const schemaReady = await storage.get(SCHEMA_VERSION_KEY);
    
    if (schemaReady) {
      console.log('Database schema is ready (cached)');
      return true;
    }
    
    console.log('Applying database migrations...');
    await runMigrations();
    
    // Set flag to indicate schema is ready
    await storage.set(SCHEMA_VERSION_KEY, true);
    console.log('Database schema setup completed');
    
    return true;
  } catch (error) {
    console.error('Failed to ensure database migrations:', error);
    throw error;
  }
};

module.exports = {
  runMigrations,
  ensureMigrationsApplied,
  queueMigrations
};