-- Migration: Add Maintenance History Tables
-- Created: 2024-11-17
-- Description: Create tables for maintenance history tracking

-- 1. Add new enums
CREATE TYPE maintenance_status AS ENUM ('completed', 'failed', 'partial', 'cancelled');
CREATE TYPE maintenance_severity AS ENUM ('routine', 'urgent', 'emergency');  
CREATE TYPE device_condition AS ENUM ('excellent', 'good', 'fair', 'poor', 'critical');

-- 2. Create maintenance_history table
CREATE TABLE maintenance_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES device(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES maintenance_schedules(id) ON DELETE SET NULL,
    maintenance_type maintenance_type NOT NULL,
    
    -- Thông tin bảo trì
    title VARCHAR(255) NOT NULL,
    description TEXT,
    performed_date TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER,
    
    -- Người thực hiện  
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    technician_name VARCHAR(255),
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    
    -- Chi phí và linh kiện
    cost DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'VND',
    parts_replaced JSONB DEFAULT '[]',
    consumables_used JSONB DEFAULT '[]',
    
    -- Trạng thái và kết quả
    status maintenance_status DEFAULT 'completed',
    severity maintenance_severity DEFAULT 'routine',
    
    -- Kết quả bảo trì
    issues_found TEXT,
    actions_taken TEXT,
    recommendations TEXT,
    
    -- Đánh giá sau bảo trì
    device_condition device_condition,
    performance_rating INTEGER CHECK (performance_rating >= 1 AND performance_rating <= 5),
    
    -- Lịch bảo trì tiếp theo
    next_maintenance_date DATE,
    next_maintenance_type maintenance_type,
    
    -- File đính kèm
    attachments JSONB DEFAULT '[]',
    photos JSONB DEFAULT '[]',
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
);

-- 3. Create maintenance_parts table
CREATE TABLE maintenance_parts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    maintenance_id UUID NOT NULL REFERENCES maintenance_history(id) ON DELETE CASCADE,
    
    part_name VARCHAR(255) NOT NULL,
    part_number VARCHAR(100),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(12,2),
    total_cost DECIMAL(12,2),
    supplier VARCHAR(255),
    warranty_months INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create indexes for performance
CREATE INDEX idx_maintenance_history_device ON maintenance_history(device_id);
CREATE INDEX idx_maintenance_history_date ON maintenance_history(performed_date DESC);
CREATE INDEX idx_maintenance_history_org ON maintenance_history(organization_id);
CREATE INDEX idx_maintenance_history_type ON maintenance_history(maintenance_type);
CREATE INDEX idx_maintenance_history_status ON maintenance_history(status);
CREATE INDEX idx_maintenance_history_performer ON maintenance_history(performed_by);

-- Composite indexes for common queries
CREATE INDEX idx_maintenance_device_date ON maintenance_history(device_id, performed_date DESC);
CREATE INDEX idx_maintenance_org_type ON maintenance_history(organization_id, maintenance_type);
CREATE INDEX idx_maintenance_status_date ON maintenance_history(status, performed_date DESC);

-- Index for parts
CREATE INDEX idx_maintenance_parts_maintenance ON maintenance_parts(maintenance_id);

-- Full text search index for maintenance descriptions
CREATE INDEX idx_maintenance_search ON maintenance_history 
USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- 5. Update existing maintenance_schedules table to reference history
ALTER TABLE maintenance_schedules ADD COLUMN IF NOT EXISTS maintenance_history_id UUID REFERENCES maintenance_history(id);

-- 6. Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_maintenance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_maintenance_history_updated_at
    BEFORE UPDATE ON maintenance_history
    FOR EACH ROW
    EXECUTE FUNCTION update_maintenance_updated_at();

-- 7. Insert sample data for testing
INSERT INTO maintenance_history (
    device_id, 
    maintenance_type, 
    title, 
    description,
    performed_date,
    duration_minutes,
    technician_name,
    cost,
    status,
    severity,
    issues_found,
    actions_taken,
    device_condition,
    performance_rating,
    organization_id,
    created_by
) 
SELECT 
    d.id as device_id,
    'preventive' as maintenance_type,
    'Initial Preventive Maintenance' as title,
    'Baseline maintenance record for device setup' as description,
    NOW() - INTERVAL '30 days' as performed_date,
    60 as duration_minutes,
    'System Administrator' as technician_name,
    100000 as cost,
    'completed' as status,
    'routine' as severity,
    'No issues found during initial setup' as issues_found,
    'Basic calibration and testing completed' as actions_taken,
    'excellent' as device_condition,
    5 as performance_rating,
    d.organization_id,
    (SELECT id FROM users WHERE username = 'admin' LIMIT 1) as created_by
FROM device d 
WHERE d.status = 'active' 
LIMIT 3;

COMMENT ON TABLE maintenance_history IS 'Stores complete maintenance history for all devices';
COMMENT ON TABLE maintenance_parts IS 'Tracks parts used in maintenance activities';
COMMENT ON COLUMN maintenance_history.parts_replaced IS 'JSON array of parts replaced during maintenance';
COMMENT ON COLUMN maintenance_history.photos IS 'JSON array of before/after photos';
COMMENT ON COLUMN maintenance_history.attachments IS 'JSON array of maintenance documents and reports';