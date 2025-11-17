-- ==== CÂU LỆNH SQL CẬP NHẬT SCHEMA CHO 4 SOCKET TABLES ====
-- Copy và paste từng section vào PostgreSQL client

-- ========== SOCKET 1 DATA ==========
ALTER TABLE socket1_data 
DROP COLUMN IF EXISTS power_operating CASCADE,
DROP COLUMN IF EXISTS operating_time CASCADE,
DROP COLUMN IF EXISTS over_voltage_operating CASCADE,
DROP COLUMN IF EXISTS over_current_operating CASCADE,
DROP COLUMN IF EXISTS over_power_operating CASCADE,
DROP COLUMN IF EXISTS status_operating CASCADE,
DROP COLUMN IF EXISTS under_voltage_operating CASCADE,
DROP COLUMN IF EXISTS power_socket_status CASCADE;

ALTER TABLE socket1_data 
ADD COLUMN IF NOT EXISTS power REAL,
ADD COLUMN IF NOT EXISTS machine_state BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS socket_state BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sensor_state BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS over_voltage BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS under_voltage BOOLEAN DEFAULT FALSE;

-- ========== SOCKET 2 DATA ==========
ALTER TABLE socket2_data 
DROP COLUMN IF EXISTS power_operating CASCADE,
DROP COLUMN IF EXISTS operating_time CASCADE,
DROP COLUMN IF EXISTS over_voltage_operating CASCADE,
DROP COLUMN IF EXISTS over_current_operating CASCADE,
DROP COLUMN IF EXISTS over_power_operating CASCADE,
DROP COLUMN IF EXISTS status_operating CASCADE,
DROP COLUMN IF EXISTS under_voltage_operating CASCADE,
DROP COLUMN IF EXISTS power_socket_status CASCADE;

ALTER TABLE socket2_data 
ADD COLUMN IF NOT EXISTS power REAL,
ADD COLUMN IF NOT EXISTS machine_state BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS socket_state BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sensor_state BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS over_voltage BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS under_voltage BOOLEAN DEFAULT FALSE;

-- ========== SOCKET 3 DATA ==========
ALTER TABLE socket3_data 
DROP COLUMN IF EXISTS power_operating CASCADE,
DROP COLUMN IF EXISTS operating_time CASCADE,
DROP COLUMN IF EXISTS over_voltage_operating CASCADE,
DROP COLUMN IF EXISTS over_current_operating CASCADE,
DROP COLUMN IF EXISTS over_power_operating CASCADE,
DROP COLUMN IF EXISTS status_operating CASCADE,
DROP COLUMN IF EXISTS under_voltage_operating CASCADE,
DROP COLUMN IF EXISTS power_socket_status CASCADE;

ALTER TABLE socket3_data 
ADD COLUMN IF NOT EXISTS power REAL,
ADD COLUMN IF NOT EXISTS machine_state BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS socket_state BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sensor_state BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS over_voltage BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS under_voltage BOOLEAN DEFAULT FALSE;

-- ========== SOCKET 4 DATA ==========
ALTER TABLE socket4_data 
DROP COLUMN IF EXISTS power_operating CASCADE,
DROP COLUMN IF EXISTS operating_time CASCADE,
DROP COLUMN IF EXISTS over_voltage_operating CASCADE,
DROP COLUMN IF EXISTS over_current_operating CASCADE,
DROP COLUMN IF EXISTS over_power_operating CASCADE,
DROP COLUMN IF EXISTS status_operating CASCADE,
DROP COLUMN IF EXISTS under_voltage_operating CASCADE,
DROP COLUMN IF EXISTS power_socket_status CASCADE;

ALTER TABLE socket4_data 
ADD COLUMN IF NOT EXISTS power REAL,
ADD COLUMN IF NOT EXISTS machine_state BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS socket_state BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sensor_state BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS over_voltage BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS under_voltage BOOLEAN DEFAULT FALSE;

-- ========== KẾT QUA KIỂM TRA ==========
-- Kiểm tra cấu trúc bảng sau khi update
\d socket1_data;
\d socket2_data;
\d socket3_data;
\d socket4_data;

-- Kiểm tra có dữ liệu không
SELECT COUNT(*) as total_records FROM socket1_data;
SELECT COUNT(*) as total_records FROM socket2_data;
SELECT COUNT(*) as total_records FROM socket3_data;
SELECT COUNT(*) as total_records FROM socket4_data;