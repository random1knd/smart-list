-- Create note_permissions table for sharing functionality
CREATE TABLE IF NOT EXISTS note_permissions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  note_id BIGINT NOT NULL,
  user_account_id VARCHAR(128) NOT NULL,
  permission_type VARCHAR(50) DEFAULT 'read',
  granted_by VARCHAR(128) NOT NULL,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_note (note_id, user_account_id),
  INDEX idx_note_id (note_id),
  INDEX idx_user_account_id (user_account_id)
);