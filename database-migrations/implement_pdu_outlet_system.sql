-- Migration: Implement PDU & Outlet System
-- Created: 2025-11-25
-- Description: Add Power Distribution Units and Outlets management system

BEGIN;

-- 1. Create outlet_status enum
DO $$ BEGIN
    CREATE TYPE outlet_status AS ENUM ('active', 'idle', 'inactive', 'error', 'maintenance');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create pdu_type enum  
DO $$ BEGIN
    CREATE TYPE pdu_type AS ENUM ('cart', 'wall_mount', 'floor_stand', 'ceiling', 'rack', 'extension');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Create power_distribution_units table
CREATE TABLE IF NOT EXISTS power_distribution_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    department_id UUID,
    
    -- Thông tin cơ bản
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50),
    type pdu_type DEFAULT 'cart',
    description VARCHAR(255),
    
    -- Vị trí
    location VARCHAR(255),
    floor VARCHAR(50),
    building VARCHAR(100),
    
    -- Thông số kỹ thuật
    total_outlets INTEGER DEFAULT 4,
    max_power_watts REAL DEFAULT 10000,
    voltage_rating REAL DEFAULT 220,
    
    -- MQTT base topic cho PDU này
    mqtt_base_topic VARCHAR(255),
    
    -- Thông tin thiết bị
    manufacturer VARCHAR(100),
    model_number VARCHAR(100),
    serial_number VARCHAR(100),
    
    -- Status
    is_mobile BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    specifications JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID,
    
    -- Foreign keys
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    
    -- Constraints
    CONSTRAINT unique_org_pdu_code UNIQUE (organization_id, code)
);

-- 4. Create outlets table
CREATE TABLE IF NOT EXISTS outlets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pdu_id UUID NOT NULL,
    outlet_number INTEGER NOT NULL,
    
    -- Configuration (static)
    name VARCHAR(100),
    description VARCHAR(255),
    mqtt_topic_suffix VARCHAR(100) NOT NULL,
    max_power_watts REAL DEFAULT 3000,
    outlet_type VARCHAR(50),
    
    -- Assignment (dynamic)
    device_id UUID UNIQUE, -- One-to-one relationship
    assigned_at TIMESTAMPTZ,
    assigned_by UUID,
    
    -- Status tracking
    status outlet_status DEFAULT 'inactive',
    last_data_at TIMESTAMPTZ,
    current_power REAL,
    current_voltage REAL,
    current_current REAL,
    
    -- Metadata
    is_enabled BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 1,
    notes VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Foreign keys
    FOREIGN KEY (pdu_id) REFERENCES power_distribution_units(id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES device(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_by) REFERENCES users(id),
    
    -- Constraints
    CONSTRAINT unique_pdu_outlet UNIQUE (pdu_id, outlet_number)
);

-- 5. Add outlet_id column to device_data table
DO $$ BEGIN
    ALTER TABLE device_data ADD COLUMN outlet_id UUID;
    ALTER TABLE device_data ADD FOREIGN KEY (outlet_id) REFERENCES outlets(id);
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- 6. Add outlet_id column to device_data_logs table
DO $$ BEGIN
    ALTER TABLE device_data_logs ADD COLUMN outlet_id UUID;
    ALTER TABLE device_data_logs ADD FOREIGN KEY (outlet_id) REFERENCES outlets(id);
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- 7. Remove deprecated columns from device_connectivity
DO $$ BEGIN
    ALTER TABLE device_connectivity DROP COLUMN IF EXISTS outlet_number;
    ALTER TABLE device_connectivity DROP COLUMN IF EXISTS mqtt_topic_map;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

-- 8. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pdu_org ON power_distribution_units(organization_id);
CREATE INDEX IF NOT EXISTS idx_pdu_dept ON power_distribution_units(department_id);
CREATE INDEX IF NOT EXISTS idx_pdu_type ON power_distribution_units(type);
CREATE INDEX IF NOT EXISTS idx_pdu_active ON power_distribution_units(is_active);
CREATE INDEX IF NOT EXISTS idx_pdu_location ON power_distribution_units(location);

CREATE INDEX IF NOT EXISTS idx_outlets_pdu ON outlets(pdu_id);
CREATE INDEX IF NOT EXISTS idx_outlets_device ON outlets(device_id);
CREATE INDEX IF NOT EXISTS idx_outlets_status ON outlets(status);
CREATE INDEX IF NOT EXISTS idx_outlets_enabled ON outlets(is_enabled);
CREATE INDEX IF NOT EXISTS idx_outlets_number ON outlets(outlet_number);

-- Update device_data indexes
DROP INDEX IF EXISTS idx_device_data_device_outlet_time;
CREATE INDEX IF NOT EXISTS idx_device_data_outlet_time ON device_data(outlet_id, timestamp DESC);

-- Update device_data_logs indexes  
DROP INDEX IF EXISTS idx_device_data_logs_device_outlet_time;
CREATE INDEX IF NOT EXISTS idx_device_data_logs_outlet_time ON device_data_logs(outlet_id, timestamp);

-- 9. Add comments for documentation
COMMENT ON TABLE power_distribution_units IS 'Power Distribution Units - Xe đặt máy hoặc ổ điện cố định';
COMMENT ON TABLE outlets IS 'Individual outlets within PDUs - combines configuration and assignment';

COMMENT ON COLUMN power_distribution_units.type IS 'Type of PDU: cart (xe đặt máy), wall_mount, floor_stand, ceiling, rack, extension';
COMMENT ON COLUMN power_distribution_units.mqtt_base_topic IS 'Base MQTT topic for this PDU, outlets will append suffix';
COMMENT ON COLUMN power_distribution_units.total_outlets IS 'Number of physical outlets available on this PDU';

COMMENT ON COLUMN outlets.outlet_number IS 'Physical outlet number on the PDU (1, 2, 3, 4...)';
COMMENT ON COLUMN outlets.mqtt_topic_suffix IS 'MQTT topic suffix (socket1, outlet_a) - combined with PDU base topic';
COMMENT ON COLUMN outlets.device_id IS 'Device assigned to this outlet (one-to-one relationship)';
COMMENT ON COLUMN outlets.status IS 'Real-time outlet status: active, idle, inactive, error, maintenance';

-- 10. Create trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_pdu_updated_at BEFORE UPDATE ON power_distribution_units
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_outlets_updated_at BEFORE UPDATE ON outlets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 11. Create view for PDU outlet summary
CREATE OR REPLACE VIEW pdu_outlet_summary AS
SELECT 
    p.id as pdu_id,
    p.name as pdu_name,
    p.code as pdu_code,
    p.type as pdu_type,
    p.location,
    p.total_outlets,
    COUNT(o.id) as configured_outlets,
    COUNT(o.device_id) as assigned_outlets,
    COUNT(CASE WHEN o.status = 'active' THEN 1 END) as active_outlets,
    SUM(o.current_power) as total_power_usage,
    o.name as organization_name,
    d.name as department_name
FROM power_distribution_units p
LEFT JOIN outlets o ON p.id = o.pdu_id
LEFT JOIN organizations org ON p.organization_id = org.id  
LEFT JOIN departments d ON p.department_id = d.id
GROUP BY p.id, p.name, p.code, p.type, p.location, p.total_outlets, org.name, d.name;

COMMENT ON VIEW pdu_outlet_summary IS 'Summary view showing PDU status and outlet utilization';

-- 12. Validation checks
DO $$
BEGIN
    -- Check if tables were created successfully
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'power_distribution_units') THEN
        RAISE EXCEPTION 'Migration failed: power_distribution_units table not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'outlets') THEN
        RAISE EXCEPTION 'Migration failed: outlets table not created';  
    END IF;
    
    -- Check if enums were created
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outlet_status') THEN
        RAISE EXCEPTION 'Migration failed: outlet_status enum not created';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pdu_type') THEN
        RAISE EXCEPTION 'Migration failed: pdu_type enum not created';
    END IF;
    
    RAISE NOTICE 'PDU & Outlet System migration completed successfully!';
    RAISE NOTICE 'Created tables: power_distribution_units, outlets';
    RAISE NOTICE 'Created enums: outlet_status, pdu_type'; 
    RAISE NOTICE 'Added outlet_id columns to device_data and device_data_logs';
    RAISE NOTICE 'Created indexes and triggers for performance';
END $$;

COMMIT;