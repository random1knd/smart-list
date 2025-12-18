const { migrationRunner } = require('@forge/sql');
const { storage } = require('@forge/api');
const {
  V001_CREATE_NOTES_TABLE,
  V002_CREATE_NOTE_PERMISSIONS_TABLE,
  V003_CREATE_NOTIFICATIONS_TABLE,
  V004_ALTER_NOTES_ADD_COLUMNS,
  V005_ALTER_PERMISSIONS_ADD_COLUMNS,
  V006_ALTER_NOTIFICATIONS_ADD_COLUMNS
} = require('./schema');

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
    // Chain migrations and execute - this is the correct Forge SQL pattern
    console.log('Queueing and executing migrations...');

    const migrationChain = migrationRunner
      .enqueue('v001_create_notes_minimal', V001_CREATE_NOTES_TABLE)
      .enqueue('v002_create_permissions_minimal', V002_CREATE_NOTE_PERMISSIONS_TABLE)
      .enqueue('v003_create_notifications_minimal', V003_CREATE_NOTIFICATIONS_TABLE)
      .enqueue('v004_alter_notes_add_columns', V004_ALTER_NOTES_ADD_COLUMNS)
      .enqueue('v005_alter_permissions_add_columns', V005_ALTER_PERMISSIONS_ADD_COLUMNS)
      .enqueue('v006_alter_notifications_add_columns', V006_ALTER_NOTIFICATIONS_ADD_COLUMNS);

    console.log('✓ Migrations queued successfully');
    console.log('Executing migration chain...');

    const successfulMigrations = await migrationChain.run();
    console.log('✓ Migration execution completed');
    console.log('Migrations result:', successfulMigrations);

    // If run() completes without throwing, migrations succeeded or tables already exist
    // Empty array means tables already exist (CREATE TABLE IF NOT EXISTS skipped)
    console.log('✅ All migrations completed successfully (tables exist)');
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
const ensureMigrationsApplied = async (forceReset = false) => {
  const SCHEMA_VERSION_KEY = 'schema_ready_v006_complete';
  
  try {
    // Force reset if requested
    if (forceReset) {
      console.log('Force reset requested, clearing migration cache...');
      await storage.delete(SCHEMA_VERSION_KEY);
    }
    
    // Check if we've already run migrations for this version
    const schemaReady = await storage.get(SCHEMA_VERSION_KEY);
    
    if (schemaReady) {
      console.log('Database schema is ready (cached)');
      // Double check that tables actually exist
      try {
        const migrations = await migrationRunner.list();
        const completedMigrations = migrations.filter(m => m.executed_at);
        console.log(`Verified ${completedMigrations.length} completed migrations`);
        
        // If no migrations have completed, clear cache and retry
        if (completedMigrations.length === 0) {
          console.log('Cache flag set but no migrations completed, clearing cache and retrying...');
          await storage.delete(SCHEMA_VERSION_KEY);
        } else {
          return true;
        }
      } catch (verifyError) {
        console.log('Cache flag set but tables missing, re-running migrations...');
        // Clear the flag and retry
        await storage.delete(SCHEMA_VERSION_KEY);
      }
    }
    
    console.log('Applying database migrations...');
    await runMigrations();
    
    // Set flag to indicate schema is ready
    await storage.set(SCHEMA_VERSION_KEY, true);
    console.log('Database schema setup completed');
    
    return true;
  } catch (error) {
    console.error('Failed to ensure database migrations:', error);
    // Clear the flag on failure so we retry next time
    await storage.delete(SCHEMA_VERSION_KEY);
    throw error;
  }
};

module.exports = {
  runMigrations,
  ensureMigrationsApplied
};