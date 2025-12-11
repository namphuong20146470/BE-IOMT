-- =====================================================
-- Convert electrical metrics to JSONB format
-- Consolidate individual metric columns into JSON objects
-- =====================================================

-- Drop dependent views first
DROP VIEW IF EXISTS maintenance_summary CASCADE;

-- Step 1: Add JSONB columns to maintenance_history
ALTER TABLE maintenance_history 
ADD COLUMN IF NOT EXISTS initial_metrics JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS final_metrics JSONB DEFAULT '{}';

-- Step 2: Migrate existing data to JSONB
UPDATE maintenance_history 
SET initial_metrics = jsonb_build_object(
    'voltage', initial_voltage,
    'current', initial_current,
    'power', initial_power,
    'frequency', initial_frequency,
    'power_factor', initial_power_factor
)
WHERE initial_voltage IS NOT NULL 
   OR initial_current IS NOT NULL 
   OR initial_power IS NOT NULL 
   OR initial_frequency IS NOT NULL 
   OR initial_power_factor IS NOT NULL;

UPDATE maintenance_history 
SET final_metrics = jsonb_build_object(
    'voltage', final_voltage,
    'current', final_current,
    'power', final_power,
    'frequency', final_frequency,
    'power_factor', final_power_factor
)
WHERE final_voltage IS NOT NULL 
   OR final_current IS NOT NULL 
   OR final_power IS NOT NULL 
   OR final_frequency IS NOT NULL 
   OR final_power_factor IS NOT NULL;

-- Step 3: Drop old individual metric columns from maintenance_history
ALTER TABLE maintenance_history 
DROP COLUMN IF EXISTS initial_voltage,
DROP COLUMN IF EXISTS initial_current,
DROP COLUMN IF EXISTS initial_power,
DROP COLUMN IF EXISTS initial_frequency,
DROP COLUMN IF EXISTS initial_power_factor,
DROP COLUMN IF EXISTS final_voltage,
DROP COLUMN IF EXISTS final_current,
DROP COLUMN IF EXISTS final_power,
DROP COLUMN IF EXISTS final_frequency,
DROP COLUMN IF EXISTS final_power_factor;

-- Step 4: Add JSONB columns to maintenance_jobs
ALTER TABLE maintenance_jobs 
ADD COLUMN IF NOT EXISTS before_metrics JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS after_metrics JSONB DEFAULT '{}';

-- Step 5: Migrate existing data to JSONB for maintenance_jobs
UPDATE maintenance_jobs 
SET before_metrics = jsonb_build_object(
    'voltage', before_voltage,
    'current', before_current,
    'power', before_power,
    'frequency', before_frequency,
    'power_factor', before_power_factor
)
WHERE before_voltage IS NOT NULL 
   OR before_current IS NOT NULL 
   OR before_power IS NOT NULL 
   OR before_frequency IS NOT NULL 
   OR before_power_factor IS NOT NULL;

UPDATE maintenance_jobs 
SET after_metrics = jsonb_build_object(
    'voltage', after_voltage,
    'current', after_current,
    'power', after_power,
    'frequency', after_frequency,
    'power_factor', after_power_factor
)
WHERE after_voltage IS NOT NULL 
   OR after_current IS NOT NULL 
   OR after_power IS NOT NULL 
   OR after_frequency IS NOT NULL 
   OR after_power_factor IS NOT NULL;

-- Step 6: Drop old individual metric columns from maintenance_jobs
ALTER TABLE maintenance_jobs 
DROP COLUMN IF EXISTS before_voltage,
DROP COLUMN IF EXISTS before_current,
DROP COLUMN IF EXISTS before_power,
DROP COLUMN IF EXISTS before_frequency,
DROP COLUMN IF EXISTS before_power_factor,
DROP COLUMN IF EXISTS after_voltage,
DROP COLUMN IF EXISTS after_current,
DROP COLUMN IF EXISTS after_power,
DROP COLUMN IF EXISTS after_frequency,
DROP COLUMN IF EXISTS after_power_factor;

-- Step 7: Create indexes on JSONB columns for better query performance
CREATE INDEX IF NOT EXISTS idx_maintenance_history_initial_metrics 
ON maintenance_history USING GIN (initial_metrics);

CREATE INDEX IF NOT EXISTS idx_maintenance_history_final_metrics 
ON maintenance_history USING GIN (final_metrics);

CREATE INDEX IF NOT EXISTS idx_maintenance_jobs_before_metrics 
ON maintenance_jobs USING GIN (before_metrics);

CREATE INDEX IF NOT EXISTS idx_maintenance_jobs_after_metrics 
ON maintenance_jobs USING GIN (after_metrics);

-- Step 8: Add comments for documentation
COMMENT ON COLUMN maintenance_history.initial_metrics IS 'Initial electrical metrics before maintenance (voltage, current, power, frequency, power_factor)';
COMMENT ON COLUMN maintenance_history.final_metrics IS 'Final electrical metrics after maintenance (voltage, current, power, frequency, power_factor)';
COMMENT ON COLUMN maintenance_jobs.before_metrics IS 'Electrical metrics before job execution (voltage, current, power, frequency, power_factor)';
COMMENT ON COLUMN maintenance_jobs.after_metrics IS 'Electrical metrics after job execution (voltage, current, power, frequency, power_factor)';

-- =====================================================
-- Migration complete
-- =====================================================
-- Example queries after migration:
-- 
-- Get initial voltage:
-- SELECT initial_metrics->>'voltage' AS voltage FROM maintenance_history;
--
-- Filter by voltage range:
-- SELECT * FROM maintenance_history 
-- WHERE (initial_metrics->>'voltage')::float BETWEEN 220 AND 240;
--
-- Update specific metric:
-- UPDATE maintenance_history 
-- SET initial_metrics = jsonb_set(initial_metrics, '{voltage}', '230.5')
-- WHERE id = 'some-uuid';
-- =====================================================
