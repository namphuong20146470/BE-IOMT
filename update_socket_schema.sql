-- Update socket tables schema to match new MQTT topic data structure
-- Run this script to update all 4 socket tables

-- Socket 1 Data (auo_display -> socket1_data)
ALTER TABLE socket1_data 
DROP COLUMN IF EXISTS power_operating,
DROP COLUMN IF EXISTS operating_time,
DROP COLUMN IF EXISTS over_voltage_operating,
DROP COLUMN IF EXISTS over_current_operating,
DROP COLUMN IF EXISTS over_power_operating,
DROP COLUMN IF EXISTS status_operating,
DROP COLUMN IF EXISTS under_voltage_operating,
DROP COLUMN IF EXISTS power_socket_status;

ALTER TABLE socket1_data 
ADD COLUMN IF NOT EXISTS power REAL,
ADD COLUMN IF NOT EXISTS machine_state BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS socket_state BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sensor_state BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS over_voltage BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS under_voltage BOOLEAN DEFAULT FALSE;

-- Socket 2 Data (camera_control_unit -> socket2_data)
ALTER TABLE socket2_data 
DROP COLUMN IF EXISTS power_operating,
DROP COLUMN IF EXISTS operating_time,
DROP COLUMN IF EXISTS over_voltage_operating,
DROP COLUMN IF EXISTS over_current_operating,
DROP COLUMN IF EXISTS over_power_operating,
DROP COLUMN IF EXISTS status_operating,
DROP COLUMN IF EXISTS under_voltage_operating,
DROP COLUMN IF EXISTS power_socket_status;

ALTER TABLE socket2_data 
ADD COLUMN IF NOT EXISTS power REAL,
ADD COLUMN IF NOT EXISTS machine_state BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS socket_state BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sensor_state BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS over_voltage BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS under_voltage BOOLEAN DEFAULT FALSE;

-- Socket 3 Data (led_nova_100 -> socket3_data)
ALTER TABLE socket3_data 
DROP COLUMN IF EXISTS power_operating,
DROP COLUMN IF EXISTS operating_time,
DROP COLUMN IF EXISTS over_voltage_operating,
DROP COLUMN IF EXISTS over_current_operating,
DROP COLUMN IF EXISTS over_power_operating,
DROP COLUMN IF EXISTS status_operating,
DROP COLUMN IF EXISTS under_voltage_operating,
DROP COLUMN IF EXISTS power_socket_status;

ALTER TABLE socket3_data 
ADD COLUMN IF NOT EXISTS power REAL,
ADD COLUMN IF NOT EXISTS machine_state BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS socket_state BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sensor_state BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS over_voltage BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS under_voltage BOOLEAN DEFAULT FALSE;

-- Socket 4 Data (electronic_endoflator -> socket4_data)
ALTER TABLE socket4_data 
DROP COLUMN IF EXISTS power_operating,
DROP COLUMN IF EXISTS operating_time,
DROP COLUMN IF EXISTS over_voltage_operating,
DROP COLUMN IF EXISTS over_current_operating,
DROP COLUMN IF EXISTS over_power_operating,
DROP COLUMN IF EXISTS status_operating,
DROP COLUMN IF EXISTS under_voltage_operating,
DROP COLUMN IF EXISTS power_socket_status;

ALTER TABLE socket4_data 
ADD COLUMN IF NOT EXISTS power REAL,
ADD COLUMN IF NOT EXISTS machine_state BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS socket_state BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sensor_state BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS over_voltage BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS under_voltage BOOLEAN DEFAULT FALSE;

-- Update comments for clarity
COMMENT ON TABLE socket1_data IS 'Socket 1 data from hopt/tang3/pkt/socket1';
COMMENT ON TABLE socket2_data IS 'Socket 2 data from hopt/tang3/pkt/socket2';
COMMENT ON TABLE socket3_data IS 'Socket 3 data from hopt/tang3/pkt/socket3';
COMMENT ON TABLE socket4_data IS 'Socket 4 data from hopt/tang3/pkt/socket4';

-- Final schema for all socket tables:
-- id (serial primary key)
-- voltage (real) - Điện áp
-- current (real) - Dòng điện
-- power (real) - Công suất
-- frequency (real) - Tần số
-- power_factor (real) - Hệ số cosphi
-- machine_state (boolean) - Trạng thái thiết bị
-- socket_state (boolean) - Trạng thái ổ cắm
-- sensor_state (boolean) - Trạng thái cảm biến
-- over_voltage (boolean) - Điện áp cao
-- under_voltage (boolean) - Điện áp thấp
-- timestamp (timestamp with time zone) - Thời gian publish