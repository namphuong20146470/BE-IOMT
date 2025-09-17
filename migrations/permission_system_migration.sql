-- ====================================================================
-- MIGRATION SCRIPT: Transition to New Permission System
-- File: prisma/migrations/[timestamp]_permission_system_migration/migration.sql
-- ====================================================================

-- First create the permission cache table that's missing from schema
CREATE TABLE IF NOT EXISTS user_permission_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_hash VARCHAR(255) NOT NULL,
    permissions_json JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Index for permission cache
CREATE INDEX IF NOT EXISTS idx_user_permission_cache_user ON user_permission_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permission_cache_expires ON user_permission_cache(expires_at);

-- ====================================================================
-- MIGRATE EXISTING USERS TO users (if needed)
-- ====================================================================

-- Check if we need to migrate from old users table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
        -- Migrate users from old table to users (only if users is empty or specific users don't exist)
        INSERT INTO users (
            id,
            username, 
            password_hash, 
            full_name, 
            email, 
            phone,
            organization_id,
            department_id,
            is_active,
            created_at,
            updated_at
        )
        SELECT 
            CASE 
                WHEN u.id::text ~ '^[0-9]+$' THEN uuid_generate_v4() -- Generate UUID for integer IDs
                ELSE u.id::uuid -- Keep existing UUIDs
            END as id,
            u.username,
            u.password_hash,
            u.full_name,
            u.email,
            u.phone,
            COALESCE(u.organization_id, (SELECT id FROM organizations LIMIT 1)) as organization_id, -- Default to first org if null
            u.department_id,
            COALESCE(u.is_active, true) as is_active,
            CURRENT_TIMESTAMP as created_at,
            CURRENT_TIMESTAMP as updated_at
        FROM users u
        WHERE NOT EXISTS (
            SELECT 1 FROM users u2 WHERE u2.username = u.username
        );
        
        RAISE NOTICE 'Migrated users from legacy users table to users';
    END IF;
END $$;

-- ====================================================================
-- SEED DEFAULT PERMISSION GROUPS
-- ====================================================================

INSERT INTO permission_groups (name, description, color, icon, sort_order) VALUES
('User Management', 'Quản lý người dùng và tài khoản', '#3B82F6', 'users', 1),
('Role Management', 'Quản lý vai trò và phân quyền', '#10B981', 'shield', 2),
('Organization', 'Quản lý tổ chức và phòng ban', '#8B5CF6', 'building', 3),
('Device Management', 'Quản lý thiết bị IoMT', '#F59E0B', 'device-tablet', 4),
('Monitoring & Alerts', 'Giám sát và cảnh báo', '#EF4444', 'bell', 5),
('Reports & Analytics', 'Báo cáo và phân tích', '#06B6D4', 'chart-bar', 6),
('System Administration', 'Quản trị hệ thống', '#6B7280', 'cog', 7),
('Content Management', 'Quản lý nội dung', '#EC4899', 'document', 8)
ON CONFLICT (name) DO NOTHING;

-- ====================================================================
-- SEED CORE PERMISSIONS
-- ====================================================================

INSERT INTO permissions (name, description, resource, action, group_id, priority) VALUES
-- User Management permissions
('user.create', 'Tạo người dùng mới', 'user', 'create', (SELECT id FROM permission_groups WHERE name = 'User Management'), 10),
('user.read', 'Xem thông tin người dùng', 'user', 'read', (SELECT id FROM permission_groups WHERE name = 'User Management'), 1),
('user.update', 'Cập nhật thông tin người dùng', 'user', 'update', (SELECT id FROM permission_groups WHERE name = 'User Management'), 5),
('user.delete', 'Xóa người dùng', 'user', 'delete', (SELECT id FROM permission_groups WHERE name = 'User Management'), 10),
('user.list', 'Xem danh sách người dùng', 'user', 'list', (SELECT id FROM permission_groups WHERE name = 'User Management'), 1),
('user.manage', 'Quản lý toàn bộ người dùng', 'user', 'manage', (SELECT id FROM permission_groups WHERE name = 'User Management'), 10),

-- Role Management permissions  
('role.create', 'Tạo vai trò mới', 'role', 'create', (SELECT id FROM permission_groups WHERE name = 'Role Management'), 10),
('role.read', 'Xem thông tin vai trò', 'role', 'read', (SELECT id FROM permission_groups WHERE name = 'Role Management'), 1),
('role.update', 'Cập nhật vai trò', 'role', 'update', (SELECT id FROM permission_groups WHERE name = 'Role Management'), 5),
('role.delete', 'Xóa vai trò', 'role', 'delete', (SELECT id FROM permission_groups WHERE name = 'Role Management'), 10),
('role.assign', 'Gán vai trò cho người dùng', 'role', 'assign', (SELECT id FROM permission_groups WHERE name = 'Role Management'), 8),
('role.manage', 'Quản lý toàn bộ vai trò', 'role', 'manage', (SELECT id FROM permission_groups WHERE name = 'Role Management'), 10),

-- Organization permissions
('organization.create', 'Tạo tổ chức mới', 'organization', 'create', (SELECT id FROM permission_groups WHERE name = 'Organization'), 10),
('organization.read', 'Xem thông tin tổ chức', 'organization', 'read', (SELECT id FROM permission_groups WHERE name = 'Organization'), 1),
('organization.update', 'Cập nhật tổ chức', 'organization', 'update', (SELECT id FROM permission_groups WHERE name = 'Organization'), 5),
('organization.delete', 'Xóa tổ chức', 'organization', 'delete', (SELECT id FROM permission_groups WHERE name = 'Organization'), 10),
('organization.manage', 'Quản lý toàn bộ tổ chức', 'organization', 'manage', (SELECT id FROM permission_groups WHERE name = 'Organization'), 10),

-- Department permissions
('department.create', 'Tạo phòng ban mới', 'department', 'create', (SELECT id FROM permission_groups WHERE name = 'Organization'), 8),
('department.read', 'Xem thông tin phòng ban', 'department', 'read', (SELECT id FROM permission_groups WHERE name = 'Organization'), 1),
('department.update', 'Cập nhật phòng ban', 'department', 'update', (SELECT id FROM permission_groups WHERE name = 'Organization'), 5),
('department.delete', 'Xóa phòng ban', 'department', 'delete', (SELECT id FROM permission_groups WHERE name = 'Organization'), 8),
('department.manage', 'Quản lý toàn bộ phòng ban', 'department', 'manage', (SELECT id FROM permission_groups WHERE name = 'Organization'), 8),

-- Device Management permissions
('device.create', 'Thêm thiết bị mới', 'device', 'create', (SELECT id FROM permission_groups WHERE name = 'Device Management'), 8),
('device.read', 'Xem thông tin thiết bị', 'device', 'read', (SELECT id FROM permission_groups WHERE name = 'Device Management'), 1),
('device.update', 'Cập nhật thiết bị', 'device', 'update', (SELECT id FROM permission_groups WHERE name = 'Device Management'), 5),
('device.delete', 'Xóa thiết bị', 'device', 'delete', (SELECT id FROM permission_groups WHERE name = 'Device Management'), 10),
('device.manage', 'Quản lý toàn bộ thiết bị', 'device', 'manage', (SELECT id FROM permission_groups WHERE name = 'Device Management'), 10),
('device.configure', 'Cấu hình thiết bị', 'device', 'configure', (SELECT id FROM permission_groups WHERE name = 'Device Management'), 8),

-- Device Categories
('device_category.create', 'Tạo danh mục thiết bị', 'device_category', 'create', (SELECT id FROM permission_groups WHERE name = 'Device Management'), 8),
('device_category.read', 'Xem danh mục thiết bị', 'device_category', 'read', (SELECT id FROM permission_groups WHERE name = 'Device Management'), 1),
('device_category.update', 'Cập nhật danh mục thiết bị', 'device_category', 'update', (SELECT id FROM permission_groups WHERE name = 'Device Management'), 5),
('device_category.delete', 'Xóa danh mục thiết bị', 'device_category', 'delete', (SELECT id FROM permission_groups WHERE name = 'Device Management'), 8),

-- Monitoring & Alerts permissions
('alert.read', 'Xem cảnh báo', 'alert', 'read', (SELECT id FROM permission_groups WHERE name = 'Monitoring & Alerts'), 1),
('alert.acknowledge', 'Xác nhận cảnh báo', 'alert', 'acknowledge', (SELECT id FROM permission_groups WHERE name = 'Monitoring & Alerts'), 3),
('alert.resolve', 'Giải quyết cảnh báo', 'alert', 'resolve', (SELECT id FROM permission_groups WHERE name = 'Monitoring & Alerts'), 5),
('alert.create', 'Tạo cảnh báo', 'alert', 'create', (SELECT id FROM permission_groups WHERE name = 'Monitoring & Alerts'), 5),
('alert.manage', 'Quản lý toàn bộ cảnh báo', 'alert', 'manage', (SELECT id FROM permission_groups WHERE name = 'Monitoring & Alerts'), 8),

-- Monitoring Rules
('alert_rule.create', 'Tạo quy tắc cảnh báo', 'alert_rule', 'create', (SELECT id FROM permission_groups WHERE name = 'Monitoring & Alerts'), 8),
('alert_rule.read', 'Xem quy tắc cảnh báo', 'alert_rule', 'read', (SELECT id FROM permission_groups WHERE name = 'Monitoring & Alerts'), 1),
('alert_rule.update', 'Cập nhật quy tắc cảnh báo', 'alert_rule', 'update', (SELECT id FROM permission_groups WHERE name = 'Monitoring & Alerts'), 5),
('alert_rule.delete', 'Xóa quy tắc cảnh báo', 'alert_rule', 'delete', (SELECT id FROM permission_groups WHERE name = 'Monitoring & Alerts'), 8),

-- System permissions
('system.audit', 'Xem nhật ký hệ thống', 'system', 'audit', (SELECT id FROM permission_groups WHERE name = 'System Administration'), 10),
('system.settings', 'Cấu hình hệ thống', 'system', 'settings', (SELECT id FROM permission_groups WHERE name = 'System Administration'), 10),
('system.backup', 'Sao lưu hệ thống', 'system', 'backup', (SELECT id FROM permission_groups WHERE name = 'System Administration'), 10),
('system.maintenance', 'Bảo trì hệ thống', 'system', 'maintenance', (SELECT id FROM permission_groups WHERE name = 'System Administration'), 10),

-- Report permissions
('report.view', 'Xem báo cáo', 'report', 'view', (SELECT id FROM permission_groups WHERE name = 'Reports & Analytics'), 1),
('report.create', 'Tạo báo cáo', 'report', 'create', (SELECT id FROM permission_groups WHERE name = 'Reports & Analytics'), 5),
('report.export', 'Xuất báo cáo', 'report', 'export', (SELECT id FROM permission_groups WHERE name = 'Reports & Analytics'), 3),
('report.manage', 'Quản lý toàn bộ báo cáo', 'report', 'manage', (SELECT id FROM permission_groups WHERE name = 'Reports & Analytics'), 8),

-- Dashboard permissions
('dashboard.view', 'Xem dashboard', 'dashboard', 'view', (SELECT id FROM permission_groups WHERE name = 'Reports & Analytics'), 1),
('dashboard.create', 'Tạo dashboard', 'dashboard', 'create', (SELECT id FROM permission_groups WHERE name = 'Reports & Analytics'), 5),
('dashboard.update', 'Cập nhật dashboard', 'dashboard', 'update', (SELECT id FROM permission_groups WHERE name = 'Reports & Analytics'), 3),
('dashboard.delete', 'Xóa dashboard', 'dashboard', 'delete', (SELECT id FROM permission_groups WHERE name = 'Reports & Analytics'), 8)

ON CONFLICT (name) DO NOTHING;

-- ====================================================================
-- SEED DEFAULT SYSTEM ROLES
-- ====================================================================

INSERT INTO roles (name, description, is_system_role, is_custom, color, icon, sort_order) VALUES
('Super Admin', 'Quyền cao nhất hệ thống, quản lý toàn bộ', true, false, '#DC2626', 'crown', 1),
('Organization Admin', 'Quản trị viên tổ chức', true, false, '#7C3AED', 'shield-check', 2),
('Department Manager', 'Quản lý phòng ban', true, false, '#059669', 'users-cog', 3),
('Device Manager', 'Quản lý thiết bị', true, false, '#EA580C', 'device-tablet', 4),
('Technician', 'Kỹ thuật viên', true, false, '#2563EB', 'wrench', 5),
('Operator', 'Vận hành viên', true, false, '#16A34A', 'play', 6),
('Viewer', 'Người xem', true, false, '#6B7280', 'eye', 7)
ON CONFLICT (name, organization_id) DO NOTHING;

-- ====================================================================
-- ASSIGN PERMISSIONS TO SYSTEM ROLES
-- ====================================================================

-- Super Admin gets ALL permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'Super Admin' AND is_system_role = true), 
    id 
FROM permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Organization Admin permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'Organization Admin' AND is_system_role = true),
    id
FROM permissions 
WHERE name IN (
    'user.create', 'user.read', 'user.update', 'user.list', 'user.manage',
    'role.read', 'role.assign', 
    'organization.read', 'organization.update',
    'department.create', 'department.read', 'department.update', 'department.delete', 'department.manage',
    'device.create', 'device.read', 'device.update', 'device.delete', 'device.manage', 'device.configure',
    'device_category.create', 'device_category.read', 'device_category.update', 'device_category.delete',
    'alert.read', 'alert.acknowledge', 'alert.resolve', 'alert.manage',
    'alert_rule.create', 'alert_rule.read', 'alert_rule.update', 'alert_rule.delete',
    'report.view', 'report.create', 'report.export', 'report.manage',
    'dashboard.view', 'dashboard.create', 'dashboard.update', 'dashboard.delete'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Department Manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'Department Manager' AND is_system_role = true),
    id
FROM permissions 
WHERE name IN (
    'user.read', 'user.list',
    'department.read',
    'device.read', 'device.update', 'device.configure',
    'device_category.read',
    'alert.read', 'alert.acknowledge', 'alert.resolve',
    'alert_rule.read', 'alert_rule.update',
    'report.view', 'report.create', 'report.export',
    'dashboard.view', 'dashboard.create', 'dashboard.update'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Device Manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'Device Manager' AND is_system_role = true),
    id
FROM permissions 
WHERE name IN (
    'device.create', 'device.read', 'device.update', 'device.delete', 'device.manage', 'device.configure',
    'device_category.create', 'device_category.read', 'device_category.update', 'device_category.delete',
    'alert.read', 'alert.acknowledge', 'alert.resolve',
    'alert_rule.create', 'alert_rule.read', 'alert_rule.update', 'alert_rule.delete',
    'report.view', 'report.create', 'report.export',
    'dashboard.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Technician permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'Technician' AND is_system_role = true),
    id
FROM permissions 
WHERE name IN (
    'device.read', 'device.update', 'device.configure',
    'device_category.read',
    'alert.read', 'alert.acknowledge', 'alert.resolve',
    'alert_rule.read',
    'report.view',
    'dashboard.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Operator permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'Operator' AND is_system_role = true),
    id
FROM permissions 
WHERE name IN (
    'device.read',
    'device_category.read',
    'alert.read', 'alert.acknowledge',
    'alert_rule.read',
    'report.view',
    'dashboard.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Viewer permissions (read-only)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
    (SELECT id FROM roles WHERE name = 'Viewer' AND is_system_role = true),
    id
FROM permissions 
WHERE name IN (
    'user.read',
    'organization.read',
    'department.read',
    'device.read',
    'device_category.read',
    'alert.read',
    'alert_rule.read',
    'report.view',
    'dashboard.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ====================================================================
-- CREATE DEFAULT ORGANIZATION SETTINGS
-- ====================================================================

INSERT INTO organization_settings (organization_id, max_users, session_timeout_minutes, password_policy, two_factor_required)
SELECT 
    id,
    1000,
    480, -- 8 hours
    '{"min_length": 8, "require_uppercase": true, "require_lowercase": true, "require_numbers": true, "require_special": false, "max_age_days": 90}',
    false
FROM organizations 
WHERE NOT EXISTS (SELECT 1 FROM organization_settings WHERE organization_id = organizations.id);

-- ====================================================================
-- ASSIGN DEFAULT ROLES TO EXISTING USERS
-- ====================================================================

-- Assign 'Viewer' role to all existing users who don't have roles yet
INSERT INTO user_roles (user_id, role_id, organization_id, assigned_by, notes)
SELECT 
    u.id,
    (SELECT id FROM roles WHERE name = 'Viewer' AND is_system_role = true),
    u.organization_id,
    (SELECT id FROM users WHERE username = 'admin' LIMIT 1), -- Assign by first admin user if exists
    'Auto-assigned during migration'
FROM users u
WHERE u.organization_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id
)
ON CONFLICT (user_id, role_id, organization_id, department_id) DO NOTHING;

-- ====================================================================
-- UTILITY FUNCTIONS FOR PERMISSION CHECKING
-- ====================================================================

-- Function to get effective permissions for a user
CREATE OR REPLACE FUNCTION get_user_effective_permissions(
    p_user_id UUID,
    p_organization_id UUID DEFAULT NULL,
    p_department_id UUID DEFAULT NULL,
    p_check_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
) RETURNS TABLE(permission_name VARCHAR, source VARCHAR, priority INTEGER) AS $$
BEGIN
    RETURN QUERY
    WITH role_permissions_cte AS (
        -- Permissions from roles
        SELECT DISTINCT 
            p.name as permission_name,
            'role:' || r.name as source,
            p.priority
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        JOIN role_permissions rp ON r.id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = p_user_id
            AND ur.is_active = true
            AND r.is_active = true  
            AND p.is_active = true
            AND (ur.valid_from IS NULL OR ur.valid_from <= p_check_time)
            AND (ur.valid_until IS NULL OR ur.valid_until > p_check_time)
            AND (p_organization_id IS NULL OR ur.organization_id = p_organization_id)
            AND (p_department_id IS NULL OR ur.department_id = p_department_id OR ur.department_id IS NULL)
    ),
    direct_permissions_cte AS (
        -- Direct permissions
        SELECT DISTINCT
            p.name as permission_name,
            'direct' as source,
            p.priority
        FROM user_permissions up
        JOIN permissions p ON up.permission_id = p.id
        WHERE up.user_id = p_user_id
            AND up.is_active = true
            AND p.is_active = true
            AND (up.valid_from IS NULL OR up.valid_from <= p_check_time)
            AND (up.valid_until IS NULL OR up.valid_until > p_check_time)
    )
    SELECT * FROM role_permissions_cte
    UNION
    SELECT * FROM direct_permissions_cte
    ORDER BY priority DESC, permission_name;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION user_has_permission(
    p_user_id UUID,
    p_permission_name VARCHAR,
    p_organization_id UUID DEFAULT NULL,
    p_department_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM get_user_effective_permissions(p_user_id, p_organization_id, p_department_id)
        WHERE permission_name = p_permission_name
    );
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired data
CREATE OR REPLACE FUNCTION daily_permission_maintenance() RETURNS VOID AS $$
BEGIN
    -- Disable expired user roles
    UPDATE user_roles 
    SET is_active = false 
    WHERE valid_until IS NOT NULL 
        AND valid_until < CURRENT_TIMESTAMP 
        AND is_active = true;
    
    -- Disable expired user permissions
    UPDATE user_permissions 
    SET is_active = false 
    WHERE valid_until IS NOT NULL 
        AND valid_until < CURRENT_TIMESTAMP 
        AND is_active = true;
        
    -- Cleanup expired permission cache
    DELETE FROM user_permission_cache 
    WHERE expires_at < CURRENT_TIMESTAMP;
    
    -- Cleanup expired sessions
    DELETE FROM user_sessions 
    WHERE expires_at < CURRENT_TIMESTAMP OR is_active = false;
        
    -- Log maintenance activity
    INSERT INTO audit_logs (action, resource_type, new_values)
    VALUES ('update', 'system', '{"maintenance": "daily_permission_cleanup_completed", "timestamp": "' || CURRENT_TIMESTAMP || '"}');
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- VERIFICATION QUERIES
-- ====================================================================

-- Verify migration results
DO $$
DECLARE
    group_count INTEGER;
    permission_count INTEGER;
    role_count INTEGER;
    user_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO group_count FROM permission_groups;
    SELECT COUNT(*) INTO permission_count FROM permissions;
    SELECT COUNT(*) INTO role_count FROM roles WHERE is_system_role = true;
    SELECT COUNT(*) INTO user_count FROM users;
    
    RAISE NOTICE 'Migration completed successfully:';
    RAISE NOTICE '- Permission Groups: %', group_count;
    RAISE NOTICE '- Permissions: %', permission_count;
    RAISE NOTICE '- System Roles: %', role_count;
    RAISE NOTICE '- Users in users: %', user_count;
    
    -- Test permission checking
    IF EXISTS (SELECT 1 FROM users LIMIT 1) THEN
        DECLARE
            test_user_id UUID;
        BEGIN
            SELECT id INTO test_user_id FROM users LIMIT 1;
            RAISE NOTICE '- Permission check test for user %: %', 
                test_user_id, 
                user_has_permission(test_user_id, 'device.read');
        END;
    END IF;
END $$;