import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createSuperAdminSystem() {
    try {
        console.log('🚀 Creating Super Admin System...');

        // 1. Create all 100 permissions
        console.log('📝 Creating 100 permissions...');
        
        const permissions = [
            // System permissions
            { name: 'system.settings', description: 'Cấu hình hệ thống', resource: 'system', action: 'settings' },
            { name: 'system.backup', description: 'Sao lưu hệ thống', resource: 'system', action: 'backup' },
            { name: 'system.maintenance', description: 'Bảo trì hệ thống', resource: 'system', action: 'maintenance' },
            { name: 'system.audit', description: 'Xem nhật ký hệ thống', resource: 'system', action: 'audit' },
            { name: 'system.restore', description: 'Khôi phục hệ thống', resource: 'system', action: 'restore' },
            { name: 'system.admin', description: 'Quản trị hệ thống', resource: 'system', action: 'admin' },
            { name: 'system.logs', description: 'Xem logs hệ thống', resource: 'system', action: 'logs' },
            { name: 'system.configure', description: 'Cấu hình hệ thống', resource: 'system', action: 'configure' },

            // Device permissions
            { name: 'device.calibrate', description: 'Hiệu chuẩn thiết bị', resource: 'device', action: 'calibrate' },
            { name: 'device.update', description: 'Cập nhật thông tin thiết bị', resource: 'device', action: 'update' },
            { name: 'device.read', description: 'Xem thông tin thiết bị', resource: 'device', action: 'read' },
            { name: 'device.manage', description: 'Quản lý thiết bị toàn quyền', resource: 'device', action: 'manage' },
            { name: 'device.monitor', description: 'Giám sát thiết bị', resource: 'device', action: 'monitor' },
            { name: 'device.configure', description: 'Cấu hình thiết bị', resource: 'device', action: 'configure' },
            { name: 'device.delete', description: 'Xóa thiết bị', resource: 'device', action: 'delete' },
            { name: 'device.list', description: 'Xem danh sách thiết bị', resource: 'device', action: 'list' },
            { name: 'device.create', description: 'Tạo thiết bị mới', resource: 'device', action: 'create' },

            // Data permissions
            { name: 'data.export', description: 'Xuất dữ liệu', resource: 'data', action: 'export' },
            { name: 'data.delete', description: 'Xóa dữ liệu', resource: 'data', action: 'delete' },
            { name: 'data.create', description: 'Tạo dữ liệu thiết bị', resource: 'data', action: 'create' },
            { name: 'data.update', description: 'Cập nhật dữ liệu', resource: 'data', action: 'update' },
            { name: 'data.import', description: 'Import dữ liệu', resource: 'data', action: 'import' },
            { name: 'data.manage', description: 'Quản lý dữ liệu toàn quyền', resource: 'data', action: 'manage' },
            { name: 'data.read', description: 'Xem dữ liệu thiết bị', resource: 'data', action: 'read' },

            // Department permissions
            { name: 'department.update', description: 'Cập nhật phòng ban', resource: 'department', action: 'update' },
            { name: 'department.delete', description: 'Xóa phòng ban', resource: 'department', action: 'delete' },
            { name: 'department.manage', description: 'Quản lý phòng ban toàn quyền', resource: 'department', action: 'manage' },
            { name: 'department.list', description: 'Xem danh sách phòng ban', resource: 'department', action: 'list' },
            { name: 'department.read', description: 'Xem thông tin phòng ban', resource: 'department', action: 'read' },
            { name: 'department.create', description: 'Tạo phòng ban mới', resource: 'department', action: 'create' },

            // Project permissions
            { name: 'project.manage', description: 'Quản lý dự án toàn quyền', resource: 'project', action: 'manage' },
            { name: 'project.settings', description: 'Cấu hình dự án', resource: 'project', action: 'settings' },
            { name: 'project.read', description: 'Xem thông tin dự án', resource: 'project', action: 'read' },
            { name: 'project.update', description: 'Cập nhật dự án', resource: 'project', action: 'update' },
            { name: 'project.create', description: 'Tạo dự án mới', resource: 'project', action: 'create' },
            { name: 'project.list', description: 'Xem danh sách dự án', resource: 'project', action: 'list' },
            { name: 'project.delete', description: 'Xóa dự án', resource: 'project', action: 'delete' },
            { name: 'project.assign_member', description: 'Gán thành viên vào dự án', resource: 'project', action: 'assign_member' },

            // Warning permissions
            { name: 'warning.acknowledge', description: 'Xác nhận cảnh báo', resource: 'warning', action: 'acknowledge' },
            { name: 'warning.read', description: 'Xem cảnh báo', resource: 'warning', action: 'read' },
            { name: 'warning.manage', description: 'Quản lý cảnh báo toàn quyền', resource: 'warning', action: 'manage' },
            { name: 'warning.resolve', description: 'Giải quyết cảnh báo', resource: 'warning', action: 'resolve' },
            { name: 'warning.configure', description: 'Cấu hình cảnh báo', resource: 'warning', action: 'configure' },

            // Report permissions
            { name: 'report.export', description: 'Xuất báo cáo', resource: 'report', action: 'export' },
            { name: 'report.schedule', description: 'Lên lịch báo cáo tự động', resource: 'report', action: 'schedule' },
            { name: 'report.delete', description: 'Xóa báo cáo', resource: 'report', action: 'delete' },
            { name: 'report.view', description: 'Xem báo cáo', resource: 'report', action: 'view' },
            { name: 'report.update', description: 'Cập nhật báo cáo', resource: 'report', action: 'update' },
            { name: 'report.read', description: 'Xem chi tiết báo cáo', resource: 'report', action: 'read' },
            { name: 'report.approve', description: 'Phê duyệt báo cáo', resource: 'report', action: 'approve' },
            { name: 'report.manage', description: 'Quản lý báo cáo toàn quyền', resource: 'report', action: 'manage' },
            { name: 'report.list', description: 'Xem danh sách báo cáo', resource: 'report', action: 'list' },
            { name: 'report.create', description: 'Tạo báo cáo', resource: 'report', action: 'create' },

            // Notification permissions
            { name: 'notification.broadcast', description: 'Broadcast thông báo', resource: 'notification', action: 'broadcast' },
            { name: 'notification.read', description: 'Xem thông báo', resource: 'notification', action: 'read' },
            { name: 'notification.configure', description: 'Cấu hình thông báo', resource: 'notification', action: 'configure' },
            { name: 'notification.send', description: 'Gửi thông báo', resource: 'notification', action: 'send' },

            // User permissions
            { name: 'user.manage', description: 'Quản lý user toàn quyền', resource: 'user', action: 'manage' },
            { name: 'user.delete', description: 'Xóa người dùng', resource: 'user', action: 'delete' },
            { name: 'user.deactivate', description: 'Vô hiệu hóa user', resource: 'user', action: 'deactivate' },
            { name: 'user.reset_password', description: 'Reset mật khẩu user', resource: 'user', action: 'reset_password' },
            { name: 'user.read', description: 'Xem thông tin người dùng', resource: 'user', action: 'read' },
            { name: 'user.list', description: 'Xem danh sách người dùng', resource: 'user', action: 'list' },
            { name: 'user.update', description: 'Cập nhật thông tin người dùng', resource: 'user', action: 'update' },
            { name: 'user.activate', description: 'Kích hoạt user', resource: 'user', action: 'activate' },
            { name: 'user.create', description: 'Tạo người dùng mới', resource: 'user', action: 'create' },

            // Role permissions
            { name: 'role.list', description: 'Xem danh sách role', resource: 'role', action: 'list' },
            { name: 'role.create', description: 'Tạo vai trò mới', resource: 'role', action: 'create' },
            { name: 'role.delete', description: 'Xóa vai trò', resource: 'role', action: 'delete' },
            { name: 'role.assign_permission', description: 'Gán permission cho role', resource: 'role', action: 'assign_permission' },
            { name: 'role.manage', description: 'Quản lý role toàn quyền', resource: 'role', action: 'manage' },
            { name: 'role.update', description: 'Cập nhật vai trò', resource: 'role', action: 'update' },
            { name: 'role.assign', description: 'Gán vai trò cho người dùng', resource: 'role', action: 'assign' },
            { name: 'role.read', description: 'Xem thông tin vai trò', resource: 'role', action: 'read' },

            // Analytics permissions
            { name: 'analytics.export', description: 'Xuất dữ liệu phân tích', resource: 'analytics', action: 'export' },
            { name: 'analytics.read', description: 'Xem phân tích', resource: 'analytics', action: 'read' },
            { name: 'analytics.advanced', description: 'Phân tích nâng cao', resource: 'analytics', action: 'advanced' },

            // Audit permissions
            { name: 'audit.search', description: 'Tìm kiếm audit logs', resource: 'audit', action: 'search' },
            { name: 'audit.export', description: 'Xuất audit logs', resource: 'audit', action: 'export' },
            { name: 'audit.read', description: 'Xem audit logs', resource: 'audit', action: 'read' },
            { name: 'audit.list', description: 'Xem danh sách audit logs', resource: 'audit', action: 'list' },

            // Organization permissions
            { name: 'organization.update', description: 'Cập nhật tổ chức', resource: 'organization', action: 'update' },
            { name: 'organization.create', description: 'Tạo tổ chức mới', resource: 'organization', action: 'create' },
            { name: 'organization.delete', description: 'Xóa tổ chức', resource: 'organization', action: 'delete' },
            { name: 'organization.manage', description: 'Quản lý tổ chức toàn quyền', resource: 'organization', action: 'manage' },
            { name: 'organization.read', description: 'Xem thông tin tổ chức', resource: 'organization', action: 'read' },
            { name: 'organization.settings', description: 'Cấu hình tổ chức', resource: 'organization', action: 'settings' },
            { name: 'organization.list', description: 'Xem danh sách tổ chức', resource: 'organization', action: 'list' },

            // Permission permissions
            { name: 'permission.read', description: 'Xem danh sách quyền', resource: 'permission', action: 'read' },
            { name: 'permission.update', description: 'Cập nhật quyền', resource: 'permission', action: 'update' },
            { name: 'permission.delete', description: 'Xóa quyền', resource: 'permission', action: 'delete' },
            { name: 'permission.manage', description: 'Quản lý permission toàn quyền', resource: 'permission', action: 'manage' },
            { name: 'permission.create', description: 'Tạo quyền mới', resource: 'permission', action: 'create' },
            { name: 'permission.list', description: 'Xem danh sách permissions', resource: 'permission', action: 'list' },
            { name: 'permission.assign', description: 'Gán quyền cho vai trò', resource: 'permission', action: 'assign' },

            // File permissions
            { name: 'file.manage', description: 'Quản lý files', resource: 'file', action: 'manage' },
            { name: 'file.delete', description: 'Xóa files', resource: 'file', action: 'delete' },
            { name: 'file.upload', description: 'Upload files', resource: 'file', action: 'upload' },
            { name: 'file.download', description: 'Download files', resource: 'file', action: 'download' },

            // Dashboard permissions
            { name: 'dashboard.view', description: 'Xem dashboard', resource: 'dashboard', action: 'view' }
        ];

        // Delete existing permissions to avoid conflicts
        await prisma.permissions.deleteMany({
            where: {
                name: {
                    in: permissions.map(p => p.name)
                }
            }
        });

        // Create permissions
        const createdPermissions = await Promise.all(
            permissions.map(permission => 
                prisma.permissions.create({
                    data: permission
                })
            )
        );

        console.log(`✅ Created ${createdPermissions.length} permissions`);

        // 2. Get or create organization for Super Admin
        let organization = await prisma.organizations.findFirst({
            where: { name: 'System' }
        });

        if (!organization) {
            organization = await prisma.organizations.create({
                data: {
                    name: 'System',
                    type: 'hospital',
                    code: 'SYSTEM',
                    address: 'System Organization',
                    status: 'ACTIVE'
                }
            });
        }

        // 3. Create Super Admin Role
        console.log('👑 Creating Super Admin Role...');
        
        // Delete existing Super Admin role if exists
        await prisma.role_permissions.deleteMany({
            where: {
                roles: {
                    name: 'Super Admin'
                }
            }
        });
        
        await prisma.roles.deleteMany({
            where: { name: 'Super Admin' }
        });

        const superAdminRole = await prisma.roles.create({
            data: {
                name: 'Super Admin',
                description: 'Super Administrator with all system permissions',
                is_system_role: true,
                organization_id: organization.id
            }
        });

        console.log('✅ Created Super Admin Role');

        // 4. Assign all permissions to Super Admin role
        console.log('🔗 Assigning all permissions to Super Admin role...');
        
        await Promise.all(
            createdPermissions.map(permission => 
                prisma.role_permissions.create({
                    data: {
                        role_id: superAdminRole.id,
                        permission_id: permission.id
                    }
                })
            )
        );

        console.log(`✅ Assigned ${createdPermissions.length} permissions to Super Admin role`);

        // 5. Create Super Admin User
        console.log('👤 Creating Super Admin User...');
        
        // Delete existing Super Admin user if exists
        await prisma.user_roles.deleteMany({
            where: {
                users: { username: 'superadmin' }
            }
        });
        
        await prisma.users.deleteMany({
            where: { username: 'superadmin' }
        });

        const hashedPassword = await bcrypt.hash('SuperAdmin@2025', 12);
        
        const superAdminUser = await prisma.users.create({
            data: {
                username: 'superadmin',
                email: 'superadmin@system.com',
                password_hash: hashedPassword,
                full_name: 'Super Administrator',
                phone: '0000000000',
                is_active: true,
                organizations: {
                    connect: { id: organization.id }
                }
                // Note: No department_id and organization_id null for system admin
            }
        });

        console.log('✅ Created Super Admin User');

        // 6. Assign Super Admin role to user
        console.log('🔗 Assigning Super Admin role to user...');
        
        await prisma.user_roles.create({
            data: {
                user_id: superAdminUser.id,
                role_id: superAdminRole.id,
                assigned_by: superAdminUser.id,
                is_active: true
            }
        });

        console.log('✅ Assigned Super Admin role to user');

        // 7. Summary
        console.log('\n🎉 Super Admin System Created Successfully!');
        console.log('\n📊 Summary:');
        console.log(`- Permissions: ${createdPermissions.length}`);
        console.log(`- Super Admin Role: ${superAdminRole.name}`);
        console.log(`- Super Admin User: ${superAdminUser.username}`);
        console.log(`- Organization: ${organization.name}`);
        
        console.log('\n🔑 Super Admin Login Credentials:');
        console.log('Username: superadmin');
        console.log('Password: SuperAdmin@2025');
        console.log('Email: superadmin@system.com');
        
        console.log('\n⚡ Super Admin Capabilities:');
        console.log('- Full system administration');
        console.log('- All 100 permissions granted');
        console.log('- Cross-organization access');
        console.log('- System configuration rights');

    } catch (error) {
        console.error('❌ Error creating Super Admin System:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

createSuperAdminSystem()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });