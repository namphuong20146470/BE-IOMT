-- Migration: Update device_warning_logs.acknowledged_by from INT to UUID
-- To be compatible with new users table structure

-- Step 1: Add new UUID column
ALTER TABLE device_warning_logs 
ADD COLUMN acknowledged_by_uuid UUID;

-- Step 2: Copy existing data (if any valid users exist in both old and new tables)
-- This will set NULL for any acknowledged_by values that don't have corresponding UUIDs
UPDATE device_warning_logs 
SET acknowledged_by_uuid = users.id 
FROM users 
WHERE device_warning_logs.acknowledged_by IS NOT NULL 
AND users.username = (
    SELECT username 
    FROM users_backup 
    WHERE users_backup.id = device_warning_logs.acknowledged_by
    LIMIT 1
);

-- Step 3: Drop old column and rename new column
ALTER TABLE device_warning_logs DROP COLUMN acknowledged_by;
ALTER TABLE device_warning_logs RENAME COLUMN acknowledged_by_uuid TO acknowledged_by;

-- Step 4: Add foreign key constraint to new users table
ALTER TABLE device_warning_logs 
ADD CONSTRAINT fk_device_warning_logs_acknowledged_by_users 
FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL;

-- Step 5: Update Prisma schema comment
COMMENT ON COLUMN device_warning_logs.acknowledged_by IS 'UUID reference to users table';