-- Create measurements for AUO Display device
-- These will be used to store data in device_data table

INSERT INTO measurements (name, unit, data_type, validation_rules) VALUES
-- Electrical measurements
('voltage', 'V', 'numeric', '{"min": 0, "max": 300, "warning_threshold": {"min": 200, "max": 240}}'),
('current', 'A', 'numeric', '{"min": 0, "max": 50, "warning_threshold": {"min": 0.1, "max": 20}}'),
('power_operating', 'W', 'numeric', '{"min": 0, "max": 5000, "warning_threshold": {"min": 10, "max": 3000}}'),
('frequency', 'Hz', 'numeric', '{"min": 45, "max": 65, "warning_threshold": {"min": 49, "max": 51}}'),
('power_factor', '', 'numeric', '{"min": 0, "max": 1, "warning_threshold": {"min": 0.8, "max": 1}}'),

-- Time measurements  
('operating_time', 'hours', 'text', '{"format": "HH:MM:SS"}'),

-- Status measurements (boolean)
('over_voltage_operating', '', 'boolean', '{"alert_on": true}'),
('over_current_operating', '', 'boolean', '{"alert_on": true}'),
('over_power_operating', '', 'boolean', '{"alert_on": true}'),
('status_operating', '', 'boolean', '{"alert_on": false}'),
('under_voltage_operating', '', 'boolean', '{"alert_on": true}'),
('power_socket_status', '', 'boolean', '{"alert_on": false}')

ON CONFLICT (name) DO NOTHING;

-- Select created measurements
SELECT id, name, unit, data_type FROM measurements WHERE name IN (
    'voltage', 'current', 'power_operating', 'frequency', 'power_factor',
    'operating_time', 'over_voltage_operating', 'over_current_operating',
    'over_power_operating', 'status_operating', 'under_voltage_operating',
    'power_socket_status'
) ORDER BY name;