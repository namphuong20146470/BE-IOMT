-- Migration: Remove specifications and specification_fields tables, update device_models
-- Created: 2025-11-10
-- Description: Remove legacy specifications tables and move specifications to JSONB column in device_models

-- ===================================================================
-- STEP 1: DROP OLD TABLES
-- ===================================================================

-- Xóa các bảng cũ (CASCADE để xóa foreign key constraints)
DROP TABLE IF EXISTS "specifications" CASCADE;
DROP TABLE IF EXISTS "specification_fields" CASCADE;

-- ===================================================================
-- STEP 2: UPDATE DEVICE_MODELS TABLE
-- ===================================================================

-- Reset cột specifications trong device_models
ALTER TABLE "device_models" DROP COLUMN IF EXISTS "specifications";
ALTER TABLE "device_models" ADD COLUMN "specifications" JSONB DEFAULT '{}'::jsonb;

-- Thêm timestamps nếu chưa có
ALTER TABLE "device_models" 
    ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ===================================================================
-- STEP 3: CREATE INDEXES
-- ===================================================================

-- Tạo GIN index cho JSONB column để tối ưu query
CREATE INDEX IF NOT EXISTS idx_device_models_specifications ON device_models USING GIN (specifications);

-- ===================================================================
-- STEP 4: SAMPLE DATA STRUCTURE
-- ===================================================================

-- Example of how specifications should be structured in JSONB:
/*
{
  "dimensions": {
    "width": "200mm",
    "height": "150mm", 
    "depth": "100mm",
    "weight": "2.5kg"
  },
  "electrical": {
    "voltage": "220V",
    "frequency": "50Hz",
    "power_consumption": "50W"
  },
  "performance": {
    "accuracy": "±0.1%",
    "resolution": "0.01",
    "response_time": "2s"
  },
  "environmental": {
    "operating_temperature": "0-40°C",
    "humidity": "10-90% RH",
    "protection_rating": "IP65"
  },
  "connectivity": {
    "interfaces": ["RS232", "Ethernet", "USB"],
    "protocols": ["TCP/IP", "Modbus RTU"]
  },
  "certifications": {
    "safety": ["CE", "FDA"],
    "quality": ["ISO 9001", "ISO 13485"]
  }
}
*/

-- ===================================================================
-- VERIFICATION QUERIES
-- ===================================================================

-- Verify the changes
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'device_models' 
    AND column_name IN ('specifications', 'created_at', 'updated_at')
ORDER BY column_name;

-- Check indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'device_models' 
    AND indexname = 'idx_device_models_specifications';

-- Verify tables are dropped
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('specifications', 'specification_fields')
    AND table_schema = 'public';

COMMIT;