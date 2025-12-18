-- =====================================================
-- Migration: Add Soft Delete and Archive Support to Device
-- Purpose: Enable safe device deletion with data preservation for research
-- Date: 2025-12-18
-- =====================================================

-- Step 1: Add 'archived' status to device_status enum
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'device_status' AND e.enumlabel = 'archived'
    ) THEN
        ALTER TYPE device_status ADD VALUE 'archived';
        RAISE NOTICE 'Added "archived" to device_status enum';
    ELSE
        RAISE NOTICE '"archived" already exists in device_status enum';
    END IF;
END
$$;

-- Step 2: Add soft delete columns to device table
ALTER TABLE device 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID NULL,
ADD COLUMN IF NOT EXISTS deletion_reason TEXT NULL;

-- Step 3: Add foreign key for deleted_by (references users table)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_device_deleted_by_user'
    ) THEN
        ALTER TABLE device 
        ADD CONSTRAINT fk_device_deleted_by_user 
        FOREIGN KEY (deleted_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL;
        
        RAISE NOTICE 'Added foreign key constraint for deleted_by';
    ELSE
        RAISE NOTICE 'Foreign key constraint for deleted_by already exists';
    END IF;
END
$$;

-- Step 4: Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_device_deleted_at ON device(deleted_at);
CREATE INDEX IF NOT EXISTS idx_device_deleted_by ON device(deleted_by);
CREATE INDEX IF NOT EXISTS idx_device_status ON device(status);

-- Step 5: Create composite index for common queries (active devices)
CREATE INDEX IF NOT EXISTS idx_device_active_lookup 
ON device(organization_id, status, deleted_at) 
WHERE deleted_at IS NULL;

-- Step 6: Add comment documentation
COMMENT ON COLUMN device.deleted_at IS 'Timestamp when device was soft deleted. NULL means device is active.';
COMMENT ON COLUMN device.deleted_by IS 'User ID who deleted the device. References users(id).';
COMMENT ON COLUMN device.deletion_reason IS 'Reason for deleting the device for audit purposes.';

-- Step 7: Create audit trigger for device deletions (optional but recommended)
CREATE OR REPLACE FUNCTION log_device_deletion()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
        -- Log to audit_logs when device is soft deleted
        INSERT INTO audit_logs (
            action,
            resource_type,
            resource_id,
            user_id,
            details,
            created_at
        ) VALUES (
            'soft_delete_device',
            'device',
            NEW.id,
            NEW.deleted_by,
            jsonb_build_object(
                'serial_number', NEW.serial_number,
                'status', NEW.status,
                'deletion_reason', NEW.deletion_reason,
                'deleted_at', NEW.deleted_at
            ),
            NOW()
        );
    END IF;
    
    IF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
        -- Log to audit_logs when device is restored
        INSERT INTO audit_logs (
            action,
            resource_type,
            resource_id,
            user_id,
            details,
            created_at
        ) VALUES (
            'restore_device',
            'device',
            NEW.id,
            NEW.deleted_by, -- Will be set to restoring user
            jsonb_build_object(
                'serial_number', NEW.serial_number,
                'status', NEW.status,
                'original_deletion_reason', OLD.deletion_reason,
                'restored_at', NOW()
            ),
            NOW()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_device_deletion_audit ON device;
CREATE TRIGGER trigger_device_deletion_audit
    AFTER UPDATE ON device
    FOR EACH ROW
    WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
    EXECUTE FUNCTION log_device_deletion();

-- Step 8: Update existing device_data, alerts, maintenance_history to NOT cascade delete
-- (Preserve historical data when device is deleted)
ALTER TABLE device_data 
DROP CONSTRAINT IF EXISTS device_data_device_id_fkey,
ADD CONSTRAINT device_data_device_id_fkey 
    FOREIGN KEY (device_id) 
    REFERENCES device(id) 
    ON DELETE RESTRICT;  -- Prevent hard delete if data exists

ALTER TABLE alerts 
DROP CONSTRAINT IF EXISTS alerts_device_id_fkey,
ADD CONSTRAINT alerts_device_id_fkey 
    FOREIGN KEY (device_id) 
    REFERENCES device(id) 
    ON DELETE RESTRICT;  -- Prevent hard delete if alerts exist

ALTER TABLE maintenance_history 
DROP CONSTRAINT IF EXISTS maintenance_history_device_id_fkey,
ADD CONSTRAINT maintenance_history_device_id_fkey 
    FOREIGN KEY (device_id) 
    REFERENCES device(id) 
    ON DELETE RESTRICT;  -- Prevent hard delete if maintenance records exist

-- Step 9: Create view for active devices (convenience)
CREATE OR REPLACE VIEW active_devices AS
SELECT 
    d.*,
    dm.name as model_name,
    dm.model_number,
    o.name as organization_name,
    dept.name as department_name
FROM device d
LEFT JOIN device_models dm ON d.model_id = dm.id
LEFT JOIN organizations o ON d.organization_id = o.id
LEFT JOIN departments dept ON d.department_id = dept.id
WHERE d.deleted_at IS NULL
ORDER BY d.created_at DESC;

-- Step 10: Create view for deleted devices (for restore interface)
CREATE OR REPLACE VIEW deleted_devices AS
SELECT 
    d.*,
    dm.name as model_name,
    dm.model_number,
    o.name as organization_name,
    dept.name as department_name,
    u.full_name as deleted_by_name,
    u.email as deleted_by_email,
    (SELECT COUNT(*) FROM device_data WHERE device_id = d.id) as data_count,
    (SELECT COUNT(*) FROM alerts WHERE device_id = d.id) as alerts_count,
    (SELECT COUNT(*) FROM maintenance_history WHERE device_id = d.id) as maintenance_count
FROM device d
LEFT JOIN device_models dm ON d.model_id = dm.id
LEFT JOIN organizations o ON d.organization_id = o.id
LEFT JOIN departments dept ON d.department_id = dept.id
LEFT JOIN users u ON d.deleted_by = u.id
WHERE d.deleted_at IS NOT NULL
ORDER BY d.deleted_at DESC;

-- Step 11: Grant permissions
GRANT SELECT ON active_devices TO PUBLIC;
GRANT SELECT ON deleted_devices TO PUBLIC;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

RAISE NOTICE '✅ Soft delete migration completed successfully!';
RAISE NOTICE '📊 Views created: active_devices, deleted_devices';
RAISE NOTICE '🔒 Foreign key constraints updated to RESTRICT (prevents accidental hard delete)';
RAISE NOTICE '📝 Audit triggers installed for automatic logging';
