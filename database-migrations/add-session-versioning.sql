-- Migration: Add version field for optimistic locking and race condition prevention
-- File: add-session-versioning.sql

ALTER TABLE user_sessions 
ADD COLUMN version INTEGER DEFAULT 1 NOT NULL;

-- Add index for performance
CREATE INDEX idx_user_sessions_version ON user_sessions(id, version);

-- Comments
COMMENT ON COLUMN user_sessions.version IS 'Version number for optimistic locking and preventing race conditions during refresh';