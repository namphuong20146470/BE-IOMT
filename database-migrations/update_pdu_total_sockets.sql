-- Migration: Update power_distribution_units table
-- Date: 2025-12-03
-- Description: Cập nhật field total_outlets thành total_sockets trong bảng power_distribution_units

-- Bắt đầu transaction
BEGIN;

-- Kiểm tra bảng power_distribution_units có tồn tại không
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'power_distribution_units') THEN
        RAISE EXCEPTION 'Table power_distribution_units does not exist';
    END IF;
END
$$;

-- Rename column total_outlets thành total_sockets
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'power_distribution_units' AND column_name = 'total_outlets') THEN
        ALTER TABLE power_distribution_units RENAME COLUMN total_outlets TO total_sockets;
    ELSE
        RAISE NOTICE 'Column total_outlets does not exist in power_distribution_units table';
    END IF;
END
$$;

-- Comment để ghi nhận thay đổi
COMMENT ON COLUMN power_distribution_units.total_sockets IS 'Total number of sockets in the PDU (renamed from total_outlets)';

-- Commit transaction
COMMIT;

-- Log kết quả
SELECT 'Updated power_distribution_units: total_outlets -> total_sockets at ' || NOW() AS migration_result;