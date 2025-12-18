/**
 * Database schema migrations for Private Notes app
 * Each migration should be a single SQL statement
 */

/**
 * v001: Create notes table with all necessary fields and indexes
 */
const V001_CREATE_NOTES_TABLE = `
CREATE TABLE IF NOT EXISTS notes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  issue_key VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  content TEXT,
  created_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deadline TIMESTAMP NULL,
  is_public BOOLEAN DEFAULT FALSE,
  status VARCHAR(50) DEFAULT 'open',
  INDEX idx_issue_key (issue_key),
  INDEX idx_created_by (created_by),
  INDEX idx_is_public (is_public)
)`;

/**
 * v002: Create note_permissions table for sharing functionality
 */
const V002_CREATE_NOTE_PERMISSIONS_TABLE = `
CREATE TABLE IF NOT EXISTS note_permissions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  note_id BIGINT NOT NULL,
  user_account_id VARCHAR(128) NOT NULL,
  permission_type VARCHAR(50) DEFAULT 'read',
  granted_by VARCHAR(128) NOT NULL,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_note_id (note_id),
  INDEX idx_user_account_id (user_account_id),
  UNIQUE KEY unique_user_note (note_id, user_account_id)
)`;

/**
 * v003: Create notifications table for deadline and sharing notifications
 */
const V003_CREATE_NOTIFICATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_account_id VARCHAR(128) NOT NULL,
  note_id BIGINT,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(500) NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_account_id (user_account_id),
  INDEX idx_note_id (note_id),
  INDEX idx_is_read (is_read),
  INDEX idx_created_at (created_at)
)`;

module.exports = {
  V001_CREATE_NOTES_TABLE,
  V002_CREATE_NOTE_PERMISSIONS_TABLE,
  V003_CREATE_NOTIFICATIONS_TABLE
};