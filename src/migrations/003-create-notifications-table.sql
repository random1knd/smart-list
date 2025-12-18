-- Create notifications table for deadline and sharing notifications
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_account_id VARCHAR(128) NOT NULL,
  note_id BIGINT,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(500) NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  INDEX idx_user_account_id (user_account_id),
  INDEX idx_note_id (note_id),
  INDEX idx_is_read (is_read),
  INDEX idx_created_at (created_at)
);