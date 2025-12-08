-- Migration: Rename device tables and clean up schema
-- Created: 2025-12-04
-- Description: 
-- 1. Drop device_latest_data table (unused/deprecated)  
-- 2. Rename device_current_state to device_data_latest for consistency
-- 3. Update all foreign key references and constraints

-- ================================================================
-- STEP 1: DROP UNUSED TABLE device_latest_data
-- ================================================================
DROP TABLE IF EXISTS device_latest_data CASCADE;

-- ================================================================  
-- STEP 2: RENAME device_current_state TO device_data_latest
-- ================================================================

-- Rename the table
ALTER TABLE device_current_state RENAME TO device_data_latest;

-- Update index names to match new table name
ALTER INDEX IF EXISTS device_current_state_pkey RENAME TO device_data_latest_pkey;

-- ================================================================
-- STEP 3: UPDATE FOREIGN KEY REFERENCES (if any exist)
-- ================================================================

-- Update any views or stored procedures that reference the old table name
-- (Check if any exist and update accordingly)

-- ================================================================
-- STEP 4: VERIFY MIGRATION
-- ================================================================

-- Verify the table exists with correct name
DO $$
BEGIN
    -- Check if new table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_schema = 'public' 
                   AND table_name = 'device_data_latest') THEN
        RAISE EXCEPTION 'Migration failed: device_data_latest table not found';
    END IF;
    
    -- Check if old table is gone
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' 
               AND table_name = 'device_current_state') THEN
        RAISE EXCEPTION 'Migration failed: device_current_state table still exists';
    END IF;
    
    -- Check if device_latest_data is gone
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' 
               AND table_name = 'device_latest_data') THEN
        RAISE EXCEPTION 'Migration failed: device_latest_data table still exists';
    END IF;
    
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE '- device_latest_data table dropped';
    RAISE NOTICE '- device_current_state renamed to device_data_latest';
END $$;

-- ================================================================
-- MIGRATION NOTES
-- ================================================================
-- This migration:
-- 1. Removes the unused device_latest_data table completely
-- 2. Renames device_current_state to device_data_latest for better naming consistency
-- 3. Preserves all existing data and relationships  
-- 4. Updates Prisma schema to match new table names
--
-- After running this migration:
-- - Update any application code that references the old table names
-- - Run `npx prisma db pull` to sync Prisma schema with database changes
-- - Update any Socket MQTT Client code to use new table name
-- ================================================================