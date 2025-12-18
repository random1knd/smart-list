-- Create notes table
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
);