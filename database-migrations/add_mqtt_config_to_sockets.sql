-- Migration: Add MQTT Broker Configuration to Sockets
-- Date: 2025-12-02
-- Description: Thêm các field MQTT broker configuration cho từng socket

-- Bắt đầu transaction
BEGIN;

-- Thêm các cột MQTT broker configuration
ALTER TABLE sockets ADD COLUMN mqtt_broker_host VARCHAR(255);
ALTER TABLE sockets ADD COLUMN mqtt_broker_port INTEGER DEFAULT 1883;
ALTER TABLE sockets ADD COLUMN mqtt_credentials JSONB DEFAULT '{}';
ALTER TABLE sockets ADD COLUMN mqtt_config JSONB DEFAULT '{}';

-- Tạo index cho MQTT broker host để tìm kiếm nhanh
CREATE INDEX idx_sockets_mqtt_broker ON sockets (mqtt_broker_host);

-- Cập nhật dữ liệu mẫu với broker mặc định (nếu cần)
UPDATE sockets 
SET 
    mqtt_broker_host = '18.185.216.219',
    mqtt_broker_port = 1883,
    mqtt_credentials = '{"username": "", "password": "", "ssl_enabled": false}',
    mqtt_config = '{"qos": 1, "retain": false, "keepalive": 60}'
WHERE mqtt_broker_host IS NULL;

-- Comment cho các cột mới
COMMENT ON COLUMN sockets.mqtt_broker_host IS 'MQTT broker hostname or IP address for this socket';
COMMENT ON COLUMN sockets.mqtt_broker_port IS 'MQTT broker port number (default 1883)';
COMMENT ON COLUMN sockets.mqtt_credentials IS 'MQTT authentication credentials (username, password, SSL config)';
COMMENT ON COLUMN sockets.mqtt_config IS 'MQTT connection configuration (QoS, retain, keepalive, etc.)';

-- Commit transaction
COMMIT;

-- Log kết quả
SELECT 'MQTT broker configuration fields added to sockets table at ' || NOW() AS migration_result;