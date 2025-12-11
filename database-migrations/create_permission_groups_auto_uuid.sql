-- ============================================================================
-- PERMISSION GROUPS - PostgreSQL Direct Insert
-- Tạo 12 permission groups với UUID tự động generate
-- ============================================================================

-- Ensure uuid-ossp extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Insert permission groups
INSERT INTO permission_groups (id, name, description, color, icon, sort_order, is_active, created_at, updated_at)
VALUES
    -- Core System Groups
    (uuid_generate_v4(), 'Quản trị hệ thống', 'Các quyền quản trị và cấu hình hệ thống cốt lõi', '#FF5722', 'shield-check', 1, true, NOW(), NOW()),
    (uuid_generate_v4(), 'Quản lý tổ chức', 'Quản lý tổ chức, phòng ban và cấu trúc', '#2196F3', 'building', 2, true, NOW(), NOW()),
    (uuid_generate_v4(), 'Quản lý người dùng', 'Quản lý tài khoản người dùng và thông tin', '#4CAF50', 'users', 3, true, NOW(), NOW()),
    (uuid_generate_v4(), 'Quản lý vai trò & quyền', 'Quản lý roles, permissions và phân quyền', '#9C27B0', 'user-lock', 4, true, NOW(), NOW()),

    -- Business Logic Groups
    (uuid_generate_v4(), 'Quản lý thiết bị', 'Quản lý thiết bị, models và cấu hình thiết bị', '#FF9800', 'devices', 5, true, NOW(), NOW()),
    (uuid_generate_v4(), 'Quản lý dữ liệu', 'Quản lý dữ liệu từ thiết bị và xử lý dữ liệu', '#00BCD4', 'database', 6, true, NOW(), NOW()),
    (uuid_generate_v4(), 'Quản lý dự án', 'Quản lý dự án và thành viên dự án', '#3F51B5', 'folder-open', 7, true, NOW(), NOW()),

    -- Alert & Warning Groups
    (uuid_generate_v4(), 'Cảnh báo & Thông báo', 'Quản lý cảnh báo, thông báo và cấu hình', '#F44336', 'bell', 8, true, NOW(), NOW()),

    -- Reporting & Analytics
    (uuid_generate_v4(), 'Báo cáo & Phân tích', 'Tạo và quản lý báo cáo, phân tích dữ liệu', '#607D8B', 'chart-bar', 9, true, NOW(), NOW()),

    -- Audit & Monitoring
    (uuid_generate_v4(), 'Kiểm toán & Giám sát', 'Xem logs, audit trails và giám sát hệ thống', '#795548', 'clipboard-list', 10, true, NOW(), NOW()),

    -- Dashboard & View
    (uuid_generate_v4(), 'Dashboard & Hiển thị', 'Quản lý dashboard và giao diện hiển thị', '#009688', 'layout-dashboard', 11, true, NOW(), NOW()),

    -- Maintenance
    (uuid_generate_v4(), 'Quản lý Bảo trì', 'Quản lý maintenance logs và lịch sử bảo trì', '#673AB7', 'tools', 12, true, NOW(), NOW())
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    color = EXCLUDED.color,
    icon = EXCLUDED.icon,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- ============================================================================
-- ASSIGN PERMISSIONS TO GROUPS
-- ============================================================================

-- GROUP 1: Quản trị hệ thống
UPDATE permissions 
SET group_id = (SELECT id FROM permission_groups WHERE name = 'Quản trị hệ thống')
WHERE name IN (
    'system.admin',
    'system.configure',
    'system.settings',
    'system.maintenance',
    'system.backup',
    'system.restore',
    'system.logs',
    'system.audit'
);

-- GROUP 2: Quản lý tổ chức
UPDATE permissions 
SET group_id = (SELECT id FROM permission_groups WHERE name = 'Quản lý tổ chức')
WHERE name IN (
    'organization.manage',
    'organization.create',
    'organization.read',
    'organization.update',
    'organization.delete',
    'organization.list',
    'organization.settings',
    'department.manage',
    'department.create',
    'department.read',
    'department.update',
    'department.delete',
    'department.list'
);

-- GROUP 3: Quản lý người dùng
UPDATE permissions 
SET group_id = (SELECT id FROM permission_groups WHERE name = 'Quản lý người dùng')
WHERE name IN (
    'user.manage',
    'user.create',
    'user.read',
    'user.update',
    'user.delete',
    'user.list',
    'user.activate',
    'user.deactivate',
    'user.reset_password'
);

-- GROUP 4: Quản lý vai trò & quyền
UPDATE permissions 
SET group_id = (SELECT id FROM permission_groups WHERE name = 'Quản lý vai trò & quyền')
WHERE name IN (
    'role.manage',
    'role.create',
    'role.read',
    'role.update',
    'role.delete',
    'role.list',
    'role.assign_permission',
    'role.assign',
    'permission.manage',
    'permission.create',
    'permission.read',
    'permission.update',
    'permission.delete',
    'permission.list',
    'permission.assign'
);

-- GROUP 5: Quản lý thiết bị
UPDATE permissions 
SET group_id = (SELECT id FROM permission_groups WHERE name = 'Quản lý thiết bị')
WHERE name IN (
    'device.manage',
    'device.create',
    'device.read',
    'device.update',
    'device.delete',
    'device.list',
    'device.monitor',
    'device.configure',
    'device.calibrate'
);

-- GROUP 6: Quản lý dữ liệu
UPDATE permissions 
SET group_id = (SELECT id FROM permission_groups WHERE name = 'Quản lý dữ liệu')
WHERE name IN (
    'data.manage',
    'data.create',
    'data.read',
    'data.update',
    'data.delete',
    'data.export',
    'data.import'
);

-- GROUP 7: Quản lý dự án
-- (Currently no permissions - for future use)
-- UPDATE permissions 
-- SET group_id = (SELECT id FROM permission_groups WHERE name = 'Quản lý dự án')
-- WHERE name IN ();

-- GROUP 8: Cảnh báo & Thông báo
UPDATE permissions 
SET group_id = (SELECT id FROM permission_groups WHERE name = 'Cảnh báo & Thông báo')
WHERE name IN (
    'warning.manage',
    'warning.read',
    'warning.acknowledge',
    'warning.resolve',
    'warning.configure'
);

-- GROUP 9: Báo cáo & Phân tích
UPDATE permissions 
SET group_id = (SELECT id FROM permission_groups WHERE name = 'Báo cáo & Phân tích')
WHERE name IN (
    'analytics.read',
    'analytics.export',
    'analytics.advanced'
);

-- GROUP 10: Kiểm toán & Giám sát
UPDATE permissions 
SET group_id = (SELECT id FROM permission_groups WHERE name = 'Kiểm toán & Giám sát')
WHERE name IN (
    'audit.list',
    'audit.read',
    'audit.search',
    'audit.export'
);

-- GROUP 11: Dashboard & Hiển thị
UPDATE permissions 
SET group_id = (SELECT id FROM permission_groups WHERE name = 'Dashboard & Hiển thị')
WHERE name IN (
    'dashboard.view'
);

-- GROUP 12: Quản lý Bảo trì
UPDATE permissions 
SET group_id = (SELECT id FROM permission_groups WHERE name = 'Quản lý Bảo trì')
WHERE name IN (
    'maintenance.create',
    'maintenance.read',
    'maintenance.update',
    'maintenance.delete'
);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Count permissions by group
SELECT 
    pg.name AS group_name,
    pg.color,
    pg.icon,
    pg.sort_order,
    COUNT(p.id) AS permission_count
FROM permission_groups pg
LEFT JOIN permissions p ON p.group_id = pg.id
GROUP BY pg.id, pg.name, pg.color, pg.icon, pg.sort_order
ORDER BY pg.sort_order;

-- Show permissions without group (should be empty or minimal)
SELECT 
    id, 
    name, 
    resource, 
    action
FROM permissions
WHERE group_id IS NULL
ORDER BY resource, action;

-- Total statistics
SELECT 
    (SELECT COUNT(*) FROM permission_groups) AS total_groups,
    (SELECT COUNT(*) FROM permission_groups WHERE is_active = true) AS active_groups,
    (SELECT COUNT(*) FROM permissions WHERE group_id IS NOT NULL) AS grouped_permissions,
    (SELECT COUNT(*) FROM permissions WHERE group_id IS NULL) AS ungrouped_permissions,
    (SELECT COUNT(*) FROM permissions) AS total_permissions;
