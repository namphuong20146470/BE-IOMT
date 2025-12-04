-- Migration: Restructure sockets and device_current_state tables
-- Remove data fields from sockets, simplify device_current_state

-- 1. Remove data fields from sockets table
ALTER TABLE sockets 
DROP COLUMN IF EXISTS current_power,
DROP COLUMN IF EXISTS current_voltage, 
DROP COLUMN IF EXISTS current_current,
DROP COLUMN IF EXISTS last_data_at;

-- 2. Drop existing device_current_state and recreate simplified version
DROP TABLE IF EXISTS device_current_state CASCADE;

CREATE TABLE device_current_state (
  device_id UUID PRIMARY KEY,
  socket_id UUID REFERENCES sockets(id),
  active_power REAL,
  apparent_power REAL, 
  voltage REAL,
  current REAL,
  power_factor REAL,
  frequency REAL,
  is_connected BOOLEAN DEFAULT false,
  last_seen_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add indexes for performance
CREATE INDEX idx_device_current_state_socket ON device_current_state(socket_id);
CREATE INDEX idx_device_current_state_updated ON device_current_state(updated_at DESC);
CREATE INDEX idx_device_current_state_connected ON device_current_state(is_connected, last_seen_at DESC);

-- 4. Update foreign key constraint
ALTER TABLE device_current_state
ADD CONSTRAINT fk_device_current_state_device 
FOREIGN KEY (device_id) REFERENCES device(id) ON DELETE CASCADE;

-- 5. Verify structure
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('sockets', 'device_current_state')
  AND table_schema = 'public'
ORDER BY table_name, ordinal_position;