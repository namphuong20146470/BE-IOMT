-- Migration: Rename outlets to sockets
-- Date: 2025-12-02
-- Description: Đổi tên bảng outlets thành sockets và cập nhật các trường liên quan

-- Bắt đầu transaction để rollback nếu có lỗi
BEGIN;

-- Kiểm tra bảng outlets có tồn tại không
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'outlets') THEN
        RAISE EXCEPTION 'Table outlets does not exist';
    END IF;
END
$$;

-- Đầu tiên, rename bảng outlets thành sockets
ALTER TABLE outlets RENAME TO sockets;

-- Rename các cột trong bảng sockets (kiểm tra tồn tại trước)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sockets' AND column_name = 'outlet_number') THEN
        ALTER TABLE sockets RENAME COLUMN outlet_number TO socket_number;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sockets' AND column_name = 'outlet_type') THEN
        ALTER TABLE sockets RENAME COLUMN outlet_type TO socket_type;
    END IF;
    
    -- Note: outlet_status column không tồn tại, chỉ có enum type
END
$$;

-- Cập nhật enum type name (kiểm tra tồn tại trước)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outlet_status') THEN
        ALTER TYPE outlet_status RENAME TO socket_status;
    END IF;
END
$$;

-- Rename constraints và indexes (kiểm tra tồn tại trước)
DO $$
BEGIN
    -- Rename indexes nếu tồn tại
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'unique_pdu_outlet') THEN
        ALTER INDEX unique_pdu_outlet RENAME TO unique_pdu_socket;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_outlets_pdu') THEN
        ALTER INDEX idx_outlets_pdu RENAME TO idx_sockets_pdu;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_outlets_device') THEN
        ALTER INDEX idx_outlets_device RENAME TO idx_sockets_device;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_outlets_status') THEN
        ALTER INDEX idx_outlets_status RENAME TO idx_sockets_status;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_outlets_enabled') THEN
        ALTER INDEX idx_outlets_enabled RENAME TO idx_sockets_enabled;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_outlets_number') THEN
        ALTER INDEX idx_outlets_number RENAME TO idx_sockets_number;
    END IF;
END
$$;

-- Cập nhật foreign key references trong các bảng (kiểm tra tồn tại trước)
DO $$
BEGIN
    -- Rename outlet_id trong bảng device_data
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'device_data' AND column_name = 'outlet_id') THEN
        ALTER TABLE device_data RENAME COLUMN outlet_id TO socket_id;
    END IF;
    
    -- Rename outlet_id trong bảng device_data_logs
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'device_data_logs' AND column_name = 'outlet_id') THEN
        ALTER TABLE device_data_logs RENAME COLUMN outlet_id TO socket_id;
    END IF;
END
$$;

-- Đổi tên foreign key constraints nếu cần
-- PostgreSQL tự động update tên constraint khi rename table

-- Cập nhật indexes cho các bảng có tham chiếu
DROP INDEX IF EXISTS idx_device_data_outlet_time;
CREATE INDEX idx_device_data_socket_time ON device_data (socket_id, timestamp DESC);

DROP INDEX IF EXISTS idx_device_data_logs_outlet_time;
CREATE INDEX idx_device_data_logs_socket_time ON device_data_logs (socket_id, timestamp DESC);

-- Comment để ghi nhận thay đổi
COMMENT ON TABLE sockets IS 'Renamed from outlets table - Power outlet/socket management for PDUs';
COMMENT ON COLUMN sockets.socket_number IS 'Socket number within the PDU (renamed from outlet_number)';

-- Kiểm tra socket_type column có tồn tại không trước khi comment
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sockets' AND column_name = 'socket_type') THEN
        COMMENT ON COLUMN sockets.socket_type IS 'Type of socket connection (renamed from outlet_type)';
    END IF;
END
$$;

-- Commit transaction nếu mọi thứ thành công
COMMIT;

-- Migration completed successfully
-- Renamed outlets table to sockets and updated all related references
SELECT 'Migration rename_outlets_to_sockets completed successfully at ' || NOW() AS migration_result;