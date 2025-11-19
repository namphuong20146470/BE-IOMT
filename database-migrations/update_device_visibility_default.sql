-- Update device visibility default from department to private
-- Migration: update_device_visibility_default.sql
-- Date: 2025-01-18

-- Step 1: Alter the column default value
ALTER TABLE device 
ALTER COLUMN visibility SET DEFAULT 'private';

-- Step 2: Update existing devices without department_id to private
UPDATE device 
SET visibility = 'private'
WHERE department_id IS NULL 
  AND visibility = 'department';

-- Step 3: Keep devices with department_id as department visibility
UPDATE device 
SET visibility = 'department'
WHERE department_id IS NOT NULL 
  AND visibility = 'private';

-- Verify the changes
SELECT 
    department_id IS NULL as no_department,
    visibility,
    COUNT(*) as count
FROM device 
GROUP BY department_id IS NULL, visibility
ORDER BY no_department, visibility;