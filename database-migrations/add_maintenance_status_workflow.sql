-- Add pending and in_progress to maintenance_status enum
-- Migration: Add maintenance workflow statuses

-- Step 1: Add new enum values (Postgres 9.1+)
DO $$ 
BEGIN
    -- Add 'pending' if not exists
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'pending' AND enumtypid = 'maintenance_status'::regtype) THEN
        ALTER TYPE maintenance_status ADD VALUE 'pending' BEFORE 'completed';
    END IF;
    
    -- Add 'in_progress' if not exists  
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'in_progress' AND enumtypid = 'maintenance_status'::regtype) THEN
        ALTER TYPE maintenance_status ADD VALUE 'in_progress' BEFORE 'completed';
    END IF;
END $$;

-- Step 2: Update default value for new records
ALTER TABLE maintenance_history ALTER COLUMN status SET DEFAULT 'pending';

-- Step 3: Optional - Update existing completed records that might should be pending
-- (Comment out if you want to keep existing data as-is)
-- UPDATE maintenance_history 
-- SET status = 'pending' 
-- WHERE status = 'completed' 
--   AND performed_date > NOW();

COMMENT ON COLUMN maintenance_history.status IS 'Maintenance status workflow: pending → in_progress → completed/failed/partial/cancelled';
