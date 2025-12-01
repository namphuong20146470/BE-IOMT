P-- Enhanced Email Notification System Tables
-- Run these queries to create the necessary tables

-- ====================================================================
-- EMAIL NOTIFICATION LOGS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS email_notification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warning_id UUID,
    device_id VARCHAR(255) NOT NULL,
    warning_type VARCHAR(100) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL, -- sent, failed, error, digest_sent, resolution_sent
    message_id VARCHAR(255), -- SMTP message ID
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for email_notification_logs
CREATE INDEX IF NOT EXISTS idx_email_logs_warning_id ON email_notification_logs(warning_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_device_id ON email_notification_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_notification_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_notification_logs(created_at);

-- ====================================================================
-- WARNING EMAIL QUEUE TABLE (for scheduled/delayed emails)
-- ====================================================================
CREATE TABLE IF NOT EXISTS warning_email_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warning_id UUID,
    device_id VARCHAR(255) NOT NULL,
    device_name VARCHAR(255) NOT NULL,
    warning_type VARCHAR(100) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    notification_data JSONB NOT NULL, -- Complete notification data
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'scheduled', -- scheduled, processing, sent, failed, cancelled
    attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for warning_email_queue
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled_time ON warning_email_queue(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON warning_email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_warning_id ON warning_email_queue(warning_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_device_id ON warning_email_queue(device_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_warning_email_queue_updated_at 
    BEFORE UPDATE ON warning_email_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ====================================================================
-- WARNING NOTIFICATIONS TABLE (enhanced from existing)
-- ====================================================================
CREATE TABLE IF NOT EXISTS warning_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warning_id UUID NOT NULL,
    level INTEGER NOT NULL, -- 1, 2, 3, 4, 5 (escalation levels)
    send_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'scheduled', -- scheduled, sent, failed, cancelled
    notification_type VARCHAR(50) NOT NULL DEFAULT 'email', -- email, sms, push
    attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    message_id VARCHAR(255),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for warning_notifications
CREATE INDEX IF NOT EXISTS idx_warning_notifications_warning_id ON warning_notifications(warning_id);
CREATE INDEX IF NOT EXISTS idx_warning_notifications_send_time ON warning_notifications(send_time);
CREATE INDEX IF NOT EXISTS idx_warning_notifications_status ON warning_notifications(status);
CREATE INDEX IF NOT EXISTS idx_warning_notifications_level ON warning_notifications(level);

-- Trigger for updated_at
CREATE TRIGGER update_warning_notifications_updated_at 
    BEFORE UPDATE ON warning_notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ====================================================================
-- EMAIL TEMPLATES TABLE (optional - for customizable templates)
-- ====================================================================
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    template_type VARCHAR(50) NOT NULL, -- warning, digest, resolution, maintenance
    subject_template TEXT NOT NULL,
    html_template TEXT NOT NULL,
    text_template TEXT,
    variables JSONB, -- Available template variables
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for email_templates
CREATE INDEX IF NOT EXISTS idx_email_templates_type ON email_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active);

-- Trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at 
    BEFORE UPDATE ON email_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ====================================================================
-- EMAIL RECIPIENTS TABLE (for managing recipient lists)
-- ====================================================================
CREATE TABLE IF NOT EXISTS email_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_name VARCHAR(100) NOT NULL,
    email_address VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    severity_filter JSONB, -- Which severities this recipient should receive
    warning_type_filter JSONB, -- Which warning types this recipient should receive
    time_filter JSONB, -- Time-based filters (working hours, etc.)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for email_recipients
CREATE INDEX IF NOT EXISTS idx_email_recipients_group ON email_recipients(group_name);
CREATE INDEX IF NOT EXISTS idx_email_recipients_active ON email_recipients(is_active);
CREATE INDEX IF NOT EXISTS idx_email_recipients_email ON email_recipients(email_address);

-- Trigger for updated_at
CREATE TRIGGER update_email_recipients_updated_at 
    BEFORE UPDATE ON email_recipients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ====================================================================
-- SAMPLE DATA INSERTS
-- ====================================================================

-- Insert default email templates
INSERT INTO email_templates (name, template_type, subject_template, html_template, text_template) 
VALUES 
('default_warning', 'warning', '{{severity_icon}} Cảnh báo thiết bị: {{device_name}} - {{warning_type}}', 
 '<h1>{{severity_icon}} CẢNH BÁO THIẾT BỊ IoMT</h1><p>{{warning_type}} tại {{device_name}}</p>', 
 '{{severity_icon}} CẢNH BÁO: {{warning_type}} tại {{device_name}}'),

('default_digest', 'digest', '📊 Tổng hợp cảnh báo: {{warning_count}} cảnh báo', 
 '<h1>📊 TỔNG HỢP CẢNH BÁO IoT</h1><p>{{warning_count}} cảnh báo trong khoảng thời gian qua</p>', 
 '📊 TỔNG HỢP: {{warning_count}} cảnh báo'),

('default_resolution', 'resolution', '✅ ĐÃ GIẢI QUYẾT: {{device_name}} - {{warning_type}}', 
 '<h1>✅ ĐÃ GIẢI QUYẾT CẢNH BÁO</h1><p>{{warning_type}} tại {{device_name}} đã được giải quyết</p>', 
 '✅ ĐÃ GIẢI QUYẾT: {{warning_type}} tại {{device_name}}')
ON CONFLICT (name) DO NOTHING;

-- Insert default recipient groups
INSERT INTO email_recipients (group_name, email_address, recipient_name, severity_filter, is_active) 
VALUES 
('administrators', 'admin@bvdakhoatp.vn', 'Administrator', '["critical", "high", "medium", "low"]', true),
('technicians', 'kythuat@bvdakhoatp.vn', 'Kỹ thuật', '["critical", "high", "medium"]', true),
('maintenance', 'baotri@bvdakhoatp.vn', 'Bảo trì', '["critical", "high"]', true),
('emergency', 'emergency@bvdakhoatp.vn', 'Khẩn cấp', '["critical"]', true)
ON CONFLICT DO NOTHING;

-- ====================================================================
-- UTILITY FUNCTIONS
-- ====================================================================

-- Function to get email statistics
CREATE OR REPLACE FUNCTION get_email_statistics(time_range INTERVAL DEFAULT '24 hours')
RETURNS TABLE (
    status VARCHAR,
    severity VARCHAR,
    count BIGINT,
    success_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        enl.status,
        enl.severity,
        COUNT(*) as count,
        ROUND(
            COUNT(CASE WHEN enl.status = 'sent' THEN 1 END) * 100.0 / COUNT(*), 2
        ) as success_rate
    FROM email_notification_logs enl
    WHERE enl.created_at >= CURRENT_TIMESTAMP - time_range
    GROUP BY enl.status, enl.severity
    ORDER BY enl.severity, enl.status;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old email logs
CREATE OR REPLACE FUNCTION cleanup_old_email_logs(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM email_notification_logs 
    WHERE created_at < CURRENT_TIMESTAMP - (days_to_keep || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- VIEWS FOR REPORTING
-- ====================================================================

-- Email performance view
CREATE OR REPLACE VIEW email_performance_summary AS
SELECT 
    DATE_TRUNC('day', sent_at) as date,
    COUNT(*) as total_emails,
    COUNT(CASE WHEN status = 'sent' THEN 1 END) as successful_emails,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_emails,
    ROUND(
        COUNT(CASE WHEN status = 'sent' THEN 1 END) * 100.0 / COUNT(*), 2
    ) as success_rate
FROM email_notification_logs
WHERE sent_at IS NOT NULL
GROUP BY DATE_TRUNC('day', sent_at)
ORDER BY date DESC;

-- Warning notification summary
CREATE OR REPLACE VIEW warning_notification_summary AS
SELECT 
    w.device_type,
    w.warning_type,
    w.warning_severity,
    COUNT(DISTINCT w.id) as total_warnings,
    COUNT(e.id) as email_notifications,
    COUNT(CASE WHEN e.status = 'sent' THEN 1 END) as emails_sent,
    COUNT(CASE WHEN e.status = 'failed' THEN 1 END) as emails_failed
FROM device_warning_logs w
LEFT JOIN email_notification_logs e ON w.id::text = e.warning_id::text
WHERE w.timestamp >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY w.device_type, w.warning_type, w.warning_severity
ORDER BY total_warnings DESC;

COMMENT ON TABLE email_notification_logs IS 'Logs all email notifications sent by the system';
COMMENT ON TABLE warning_email_queue IS 'Queue for scheduled and delayed email notifications';
COMMENT ON TABLE warning_notifications IS 'Enhanced notification scheduling with escalation levels';
COMMENT ON TABLE email_templates IS 'Customizable email templates for different notification types';
COMMENT ON TABLE email_recipients IS 'Recipient management with filtering capabilities';
