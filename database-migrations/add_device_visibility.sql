-- Migration: Add Device Visibility Management
-- Created: 2024-11-18
-- Description: Add visibility field to device table for flexible access control

-- 1. Add device_visibility enum
CREATE TYPE device_visibility AS ENUM ('public', 'department', 'private');
-- Alternative naming could be: ('organization_wide', 'department_only', 'restricted')

-- 2. Add visibility column to device table
ALTER TABLE device ADD COLUMN visibility device_visibility DEFAULT 'department';

-- 3. Create indexes for performance
CREATE INDEX idx_device_visibility ON device(visibility);
CREATE INDEX idx_device_org_visibility ON device(organization_id, visibility);

-- 4. Update existing devices based on department assignment
-- Devices with department -> 'department' visibility (default)
-- Devices without department -> 'public' visibility
UPDATE device 
SET visibility = CASE 
    WHEN department_id IS NULL THEN 'public'::device_visibility
    ELSE 'department'::device_visibility
END;

-- 5. Add comments for documentation
COMMENT ON COLUMN device.visibility IS 'Device visibility scope: public (entire organization), department (department members only), private (restricted access)';
COMMENT ON COLUMN device.department_id IS 'Department assignment: used with visibility=department to determine access scope';
COMMENT ON TYPE device_visibility IS 'Enum for device visibility levels - controls who can see the device';

-- 6. Create view for device visibility summary
CREATE OR REPLACE VIEW device_visibility_summary AS
SELECT 
    o.name as organization_name,
    d.visibility,
    COUNT(*) as device_count,
    COUNT(CASE WHEN d.department_id IS NULL THEN 1 END) as unassigned_count
FROM device d
JOIN organizations o ON d.organization_id = o.id
GROUP BY o.name, d.visibility
ORDER BY o.name, d.visibility;

COMMENT ON VIEW device_visibility_summary IS 'Summary of device visibility distribution by organization';

-- 7. Grant permissions (if needed)
-- GRANT SELECT ON device_visibility_summary TO iomt_read_role;
-- GRANT UPDATE(visibility) ON device TO iomt_write_role;

-- 8. Validation check
DO $$
BEGIN
    -- Ensure all devices have visibility set
    IF EXISTS (SELECT 1 FROM device WHERE visibility IS NULL) THEN
        RAISE EXCEPTION 'Migration failed: Some devices still have NULL visibility';
    END IF;
    
    RAISE NOTICE 'Migration completed successfully. Device visibility field added.';
END $$;