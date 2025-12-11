-- =====================================================
-- Enhancement for Maintenance History Module
-- Adds fields for electrical metrics tracking
-- =====================================================

-- Add electrical metrics fields for BEFORE maintenance
ALTER TABLE maintenance_history 
ADD COLUMN IF NOT EXISTS initial_voltage REAL,
ADD COLUMN IF NOT EXISTS initial_current REAL,
ADD COLUMN IF NOT EXISTS initial_power REAL,
ADD COLUMN IF NOT EXISTS initial_frequency REAL,
ADD COLUMN IF NOT EXISTS initial_power_factor REAL,

-- Add electrical metrics fields for AFTER maintenance
ADD COLUMN IF NOT EXISTS final_voltage REAL,
ADD COLUMN IF NOT EXISTS final_current REAL,
ADD COLUMN IF NOT EXISTS final_power REAL,
ADD COLUMN IF NOT EXISTS final_frequency REAL,
ADD COLUMN IF NOT EXISTS final_power_factor REAL,

-- Add customer/technician issue descriptions
ADD COLUMN IF NOT EXISTS customer_issue TEXT,
ADD COLUMN IF NOT EXISTS technician_issue TEXT,

-- Add conclusion and cause analysis
ADD COLUMN IF NOT EXISTS conclusion TEXT,
ADD COLUMN IF NOT EXISTS root_cause TEXT,

-- Add ticket number for tracking
ADD COLUMN IF NOT EXISTS ticket_number VARCHAR(50),

-- Add socket tracking (for socket-based devices)
ADD COLUMN IF NOT EXISTS socket_id UUID REFERENCES sockets(id) ON DELETE SET NULL,

-- Add timestamps for workflow
ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;

-- Create unique index for ticket numbers
CREATE UNIQUE INDEX IF NOT EXISTS idx_maintenance_ticket_unique 
ON maintenance_history(ticket_number) 
WHERE ticket_number IS NOT NULL;

-- Create index for socket tracking
CREATE INDEX IF NOT EXISTS idx_maintenance_socket 
ON maintenance_history(socket_id);

-- Add index for time range queries
CREATE INDEX IF NOT EXISTS idx_maintenance_time_range 
ON maintenance_history(start_time, end_time);

-- =====================================================
-- Create maintenance_jobs table (sub-tasks)
-- =====================================================
CREATE TABLE IF NOT EXISTS maintenance_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    maintenance_id UUID NOT NULL REFERENCES maintenance_history(id) ON DELETE CASCADE,
    job_number INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100), -- 'nguồn', 'board mạch', 'cảm biến', etc.
    description TEXT,
    
    -- Electrical metrics BEFORE job
    before_voltage REAL,
    before_current REAL,
    before_power REAL,
    before_frequency REAL,
    before_power_factor REAL,
    
    -- Electrical metrics AFTER job
    after_voltage REAL,
    after_current REAL,
    after_power REAL,
    after_frequency REAL,
    after_power_factor REAL,
    
    -- Timing
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    duration_minutes INT,
    
    -- Status and result
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, failed
    result VARCHAR(50), -- success, failed, continue, partial
    
    -- Notes
    notes TEXT,
    issues_found TEXT,
    actions_taken TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT fk_maintenance_jobs_maintenance 
        FOREIGN KEY (maintenance_id) REFERENCES maintenance_history(id) ON DELETE CASCADE
);

-- Indexes for maintenance_jobs
CREATE INDEX IF NOT EXISTS idx_maintenance_jobs_maintenance 
ON maintenance_jobs(maintenance_id);

CREATE INDEX IF NOT EXISTS idx_maintenance_jobs_status 
ON maintenance_jobs(status);

CREATE INDEX IF NOT EXISTS idx_maintenance_jobs_number 
ON maintenance_jobs(maintenance_id, job_number);

-- =====================================================
-- Create trigger to auto-generate ticket numbers
-- =====================================================
CREATE OR REPLACE FUNCTION generate_maintenance_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ticket_number IS NULL THEN
        NEW.ticket_number := 'MT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                           LPAD(NEXTVAL('maintenance_ticket_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create sequence for ticket numbers
CREATE SEQUENCE IF NOT EXISTS maintenance_ticket_seq START 1;

-- Create trigger
DROP TRIGGER IF EXISTS trg_generate_maintenance_ticket ON maintenance_history;
CREATE TRIGGER trg_generate_maintenance_ticket
    BEFORE INSERT ON maintenance_history
    FOR EACH ROW
    EXECUTE FUNCTION generate_maintenance_ticket_number();

-- =====================================================
-- Create view for maintenance summary
-- =====================================================
CREATE OR REPLACE VIEW maintenance_summary AS
SELECT 
    mh.id,
    mh.ticket_number,
    mh.title,
    mh.maintenance_type,
    mh.status,
    mh.severity,
    mh.start_time,
    mh.end_time,
    mh.performed_date,
    mh.duration_minutes,
    mh.organization_id,
    mh.department_id,
    
    -- Device info
    d.serial_number as device_serial,
    dm.name as device_model,
    
    -- Socket info
    s.socket_number,
    pdu.name as pdu_name,
    
    -- Technician info
    u.full_name as technician_name,
    u.email as technician_email,
    
    -- Job count
    (SELECT COUNT(*) FROM maintenance_jobs WHERE maintenance_id = mh.id) as total_jobs,
    (SELECT COUNT(*) FROM maintenance_jobs WHERE maintenance_id = mh.id AND status = 'completed') as completed_jobs,
    
    -- Electrical metrics improvement
    mh.final_power - mh.initial_power as power_improvement,
    
    -- Cost
    mh.cost,
    mh.currency
    
FROM maintenance_history mh
LEFT JOIN device d ON d.id = mh.device_id
LEFT JOIN device_models dm ON dm.id = d.model_id
LEFT JOIN sockets s ON s.id = mh.socket_id
LEFT JOIN power_distribution_units pdu ON pdu.id = s.pdu_id
LEFT JOIN users u ON u.id = mh.performed_by;

-- Grant permissions
GRANT SELECT ON maintenance_summary TO PUBLIC;

COMMENT ON TABLE maintenance_history IS 'Extended maintenance history with electrical metrics tracking';
COMMENT ON TABLE maintenance_jobs IS 'Individual maintenance jobs/tasks within a maintenance session';
COMMENT ON VIEW maintenance_summary IS 'Summary view for maintenance history with aggregated data';
