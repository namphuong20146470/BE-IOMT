import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🌱 Starting IoMT database seeding...');

        // Clean existing data (optional - for development)
        console.log('🧹 Cleaning existing data...');
        await prisma.user_roles.deleteMany();
        await prisma.role_permissions.deleteMany();
        await prisma.warranty_info.deleteMany();
        await prisma.specifications.deleteMany();
        await prisma.device.deleteMany();
        await prisma.device_models.deleteMany();
        await prisma.device_categories.deleteMany();
        await prisma.suppliers.deleteMany();
        await prisma.manufacturers.deleteMany();
        await prisma.users.deleteMany();
        await prisma.permissions.deleteMany();
        await prisma.roles.deleteMany();
        await prisma.departments.deleteMany();
        await prisma.organizations.deleteMany();
        await prisma.auo_display.deleteMany();
        await prisma.iot_environment_status.deleteMany();

        // 1. Create Organizations
        console.log('📊 Creating organizations...');
        const organization = await prisma.organizations.create({
            data: {
                id: '7e983a73-c2b2-475d-a1dd-85b722ab4581',
                name: 'Bệnh viện Đa khoa Thành phố',
                type: 'hospital',
                code: 'BVDK-TP',
                address: '123 Nguyễn Huệ, Quận 1, TP.HCM',
                phone: '028-3822-1234',
                email: 'contact@bvdkthanh.vn',
                website: 'https://bvdkthanh.vn',
                status: 'ACTIVE'
            }
        });

        // 2. Create Departments
        console.log('🏢 Creating departments...');
        const departments = await Promise.all([
            prisma.departments.create({
                data: {
                    name: 'Phòng Xét nghiệm',
                    organization_id: organization.id,
                    description: 'Phòng xét nghiệm tổng hợp'
                }
            }),
            prisma.departments.create({
                data: {
                    name: 'Phòng Chẩn đoán hình ảnh',
                    organization_id: organization.id,
                    description: 'Phòng X-quang, CT, MRI, siêu âm'
                }
            }),
            prisma.departments.create({
                data: {
                    name: 'Phòng Hồi sức cấp cứu',
                    organization_id: organization.id,
                    description: 'Phòng hồi sức tích cực'
                }
            }),
            prisma.departments.create({
                data: {
                    name: 'Phòng IT',
                    organization_id: organization.id,
                    description: 'Phòng Công nghệ thông tin'
                }
            })
        ]);

        // 3. Create Roles
        console.log('👥 Creating roles...');
        const roles = await Promise.all([
            prisma.roles.create({
                data: {
                    name: 'Admin',
                    description: 'Quản trị viên hệ thống',
                    is_system_role: true,
                    organization_id: organization.id
                }
            }),
            prisma.roles.create({
                data: {
                    name: 'Manager',
                    description: 'Quản lý phòng ban',
                    is_system_role: false,
                    organization_id: organization.id
                }
            }),
            prisma.roles.create({
                data: {
                    name: 'Technician',
                    description: 'Kỹ thuật viên thiết bị',
                    is_system_role: false,
                    organization_id: organization.id
                }
            }),
            prisma.roles.create({
                data: {
                    name: 'User',
                    description: 'Người dùng cơ bản',
                    is_system_role: false,
                    organization_id: organization.id
                }
            })
        ]);

        // 4. Create Permissions (Production permissions from database)
        console.log('🔐 Creating permissions...');
        const permissionData = [
            // Analytics permissions (3)
            { id: 'cd526c0a-0b6f-4cfc-aaae-534c683c9527', name: 'analytics.advanced', description: 'Phân tích nâng cao', resource: 'analytics', action: 'execute', scope: 'global' },
            { id: '331e4ac8-46ec-4567-95f3-c3ea147acbe2', name: 'analytics.export', description: 'Xuất dữ liệu phân tích', resource: 'analytics', action: 'export', scope: 'global' },
            { id: '86e43ec1-8a2e-442d-9b29-cca50f60810c', name: 'analytics.read', description: 'Xem phân tích', resource: 'analytics', action: 'read', priority: 1, scope: 'global' },

            // Audit permissions (4)
            { id: '9e89775c-7582-4b96-829d-86dc71bc88ba', name: 'audit.export', description: 'Xuất audit logs', resource: 'audit', action: 'export', scope: 'organization' },
            { id: 'fb818896-dfc7-45d8-93b8-641f0ffb2c85', name: 'audit.list', description: 'Xem danh sách audit logs', resource: 'audit', action: 'list', priority: 1, scope: 'organization' },
            { id: 'f47a8184-4fab-478b-9520-bf3b09da4295', name: 'audit.read', description: 'Xem audit logs', resource: 'audit', action: 'read', priority: 1, scope: 'organization' },
            { id: '36382675-9b9e-4094-8b41-bbb897b1aee9', name: 'audit.search', description: 'Tìm kiếm audit logs', resource: 'audit', action: 'read', priority: 1, scope: 'organization' },

            // Dashboard permissions (1)
            { id: 'c181fc4a-12a0-4d18-8c54-d8650cecfc3c', name: 'dashboard.view', description: 'Xem dashboard', resource: 'dashboard', action: 'view', priority: 1, scope: 'global' },

            // Data permissions (7)
            { id: '28644b1d-1561-498d-b20d-793219eb9219', name: 'data.create', description: 'Tạo dữ liệu thiết bị', resource: 'data', action: 'create', priority: 5, scope: 'project' },
            { id: '26977a28-2023-4787-be4d-257882cf672c', name: 'data.delete', description: 'Xóa dữ liệu', resource: 'data', action: 'delete', priority: 10, scope: 'project' },
            { id: '154b0994-cc14-4160-a126-3b5a5852743b', name: 'data.export', description: 'Xuất dữ liệu', resource: 'data', action: 'export', scope: 'project' },
            { id: 'df4ea182-971f-4a98-8ece-5771a4856121', name: 'data.import', description: 'Import dữ liệu', resource: 'data', action: 'import', scope: 'project' },
            { id: 'e974333d-87af-4b94-9913-d6782b850b6c', name: 'data.manage', description: 'Quản lý dữ liệu toàn quyền', resource: 'data', action: 'manage', priority: 100, scope: 'project' },
            { id: 'eb5bd2b0-f25d-46f4-aedc-420b277921d7', name: 'data.read', description: 'Xem dữ liệu thiết bị', resource: 'data', action: 'read', priority: 1, scope: 'project' },
            { id: 'ca77de1b-c341-426f-b748-f381e9db9a25', name: 'data.update', description: 'Cập nhật dữ liệu', resource: 'data', action: 'update', priority: 5, scope: 'project' },

            // Department permissions (6)
            { id: 'be4a0d1f-355d-4a89-8c1e-6ccbc583d807', name: 'department.create', description: 'Tạo phòng ban mới', resource: 'department', action: 'create', priority: 8, scope: 'organization' },
            { id: '345d1609-bfa5-41b9-b7bf-fc02c9b0a0b3', name: 'department.delete', description: 'Xóa phòng ban', resource: 'department', action: 'delete', priority: 8, scope: 'organization' },
            { id: '587e8c04-7891-43ba-a523-998ef7cf2400', name: 'department.list', description: 'Xem danh sách phòng ban', resource: 'department', action: 'list', priority: 1, scope: 'organization' },
            { id: '9214ec5f-645d-4edd-a4ed-73c5abe49e37', name: 'department.manage', description: 'Quản lý phòng ban toàn quyền', resource: 'department', action: 'manage', priority: 100, scope: 'organization' },
            { id: '932bac8b-705d-4807-959b-c111e5029540', name: 'department.read', description: 'Xem thông tin phòng ban', resource: 'department', action: 'read', priority: 1, scope: 'organization' },
            { id: '1ff1e6ff-6b25-4940-a25c-0a0b204d6c2f', name: 'department.update', description: 'Cập nhật phòng ban', resource: 'department', action: 'update', priority: 5, scope: 'organization' },

            // Device permissions (9) 
            { id: '028e0810-2ee9-4e14-8451-9811592f6e1d', name: 'device.calibrate', description: 'Hiệu chuẩn thiết bị', resource: 'device', action: 'execute', scope: 'project' },
            { id: '7dd43a5c-d2ed-4a0f-b339-da92d5daf5fd', name: 'device.configure', description: 'Cấu hình thiết bị', resource: 'device', action: 'execute', scope: 'project' },
            { id: 'cc89f68c-f037-4206-a32c-9def2f7f8ae5', name: 'device.create', description: 'Tạo thiết bị mới', resource: 'device', action: 'create', priority: 5, scope: 'project' },
            { id: '8cb8c9de-5870-4679-8143-6f4909a4141a', name: 'device.delete', description: 'Xóa thiết bị', resource: 'device', action: 'delete', priority: 10, scope: 'project' },
            { id: '9882315b-8804-429b-b4bf-f2791f185806', name: 'device.list', description: 'Xem danh sách thiết bị', resource: 'device', action: 'list', priority: 1, scope: 'project' },
            { id: '176e1c64-f927-44c6-ae32-9f60bd472396', name: 'device.manage', description: 'Quản lý thiết bị toàn quyền', resource: 'device', action: 'manage', priority: 100, scope: 'project' },
            { id: '4755ef18-d10c-49d4-8732-4478b7f1266f', name: 'device.monitor', description: 'Giám sát thiết bị', resource: 'device', action: 'read', priority: 1, scope: 'project' },
            { id: '165cdf8c-d7fd-4d37-b55e-def97de15f0e', name: 'device.read', description: 'Xem thông tin thiết bị', resource: 'device', action: 'read', priority: 1, scope: 'project' },
            { id: '05c02cb9-20de-4f13-9d2a-7d8aae805464', name: 'device.update', description: 'Cập nhật thông tin thiết bị', resource: 'device', action: 'update', priority: 5, scope: 'project' },

            // Organization permissions (7)
            { id: '681ecdce-08b7-4a1e-bd43-c8a638719320', name: 'organization.create', description: 'Tạo tổ chức mới', resource: 'organization', action: 'create', priority: 10, scope: 'organization' },
            { id: '6d5fb3cf-e045-4ada-8e51-552ee3984ba9', name: 'organization.delete', description: 'Xóa tổ chức', resource: 'organization', action: 'delete', priority: 10, scope: 'organization' },
            { id: 'ffda659f-44a6-4689-a12e-a4d9ee0b9ec4', name: 'organization.list', description: 'Xem danh sách tổ chức', resource: 'organization', action: 'list', priority: 1, scope: 'organization' },
            { id: '9a2883d0-ffe0-4297-9d3f-4a689b487420', name: 'organization.manage', description: 'Quản lý tổ chức toàn quyền', resource: 'organization', action: 'manage', priority: 100, scope: 'global' },
            { id: 'c84cb546-65db-4adf-9d3c-cf1d010f968e', name: 'organization.read', description: 'Xem thông tin tổ chức', resource: 'organization', action: 'read', priority: 1, scope: 'organization' },
            { id: 'db0d098f-5ff9-4d58-a71a-064bece30d7f', name: 'organization.settings', description: 'Cấu hình tổ chức', resource: 'organization', action: 'execute', scope: 'organization' },
            { id: '5f477bb1-0a75-4231-bdc8-b68d2f11248b', name: 'organization.update', description: 'Cập nhật tổ chức', resource: 'organization', action: 'update', priority: 5, scope: 'organization' },

            // Permission permissions (7)
            { id: 'f1971129-7eb6-4165-b936-632d3ad86452', name: 'permission.assign', description: 'Gán quyền cho vai trò', resource: 'permission', action: 'assign', scope: 'organization' },
            { id: 'c3f57933-c01b-4334-948a-641aabbfa7b6', name: 'permission.create', description: 'Tạo quyền mới', resource: 'permission', action: 'create', priority: 5, scope: 'organization' },
            { id: 'b359aaca-a7c5-4580-8f0e-7ce2361a56da', name: 'permission.delete', description: 'Xóa quyền', resource: 'permission', action: 'delete', priority: 10, scope: 'organization' },
            { id: 'de1529ca-a772-4837-b644-bc07698a648c', name: 'permission.list', description: 'Xem danh sách permissions', resource: 'permission', action: 'list', priority: 1, scope: 'organization' },
            { id: 'b3c96ef0-69a3-4db7-8d28-6d667d3929ca', name: 'permission.manage', description: 'Quản lý permission toàn quyền', resource: 'permission', action: 'manage', priority: 100, scope: 'organization' },
            { id: '6b82deee-2f88-49e0-b5c0-e52f3b4556fa', name: 'permission.read', description: 'Xem danh sách quyền', resource: 'permission', action: 'read', priority: 1, scope: 'organization' },
            { id: '8d3bf9d0-f2ea-4de0-9739-1c9c303f51b9', name: 'permission.update', description: 'Cập nhật quyền', resource: 'permission', action: 'update', priority: 5, scope: 'organization' },

            // Role permissions (8)
            { id: 'ef5d9a81-ddb0-43c6-aec4-8de304ee0b52', name: 'role.assign', description: 'Gán vai trò cho người dùng', resource: 'role', action: 'assign', priority: 8, scope: 'organization' },
            { id: '56b86965-3a18-4969-b9da-edbf068bbac0', name: 'role.assign_permission', description: 'Gán permission cho role', resource: 'role', action: 'execute', scope: 'organization' },
            { id: '41ef0110-1755-46b6-a3c0-3d97b08ac1eb', name: 'role.create', description: 'Tạo vai trò mới', resource: 'role', action: 'create', priority: 10, scope: 'organization' },
            { id: '4aaa4139-4396-4b9e-a077-352643c92332', name: 'role.delete', description: 'Xóa vai trò', resource: 'role', action: 'delete', priority: 10, scope: 'organization' },
            { id: '31b833f4-e749-4e34-b964-df1f208878ac', name: 'role.list', description: 'Xem danh sách role', resource: 'role', action: 'list', priority: 1, scope: 'organization' },
            { id: '8773b7f8-5df1-4021-b174-421d62e0ade2', name: 'role.manage', description: 'Quản lý role toàn quyền', resource: 'role', action: 'manage', priority: 100, scope: 'organization' },
            { id: 'f49ad626-5550-4e45-92f0-d2b8e962935c', name: 'role.read', description: 'Xem thông tin vai trò', resource: 'role', action: 'read', priority: 1, scope: 'organization' },
            { id: 'c34dd8b3-85f8-42ea-bde7-baaa1477ff2d', name: 'role.update', description: 'Cập nhật vai trò', resource: 'role', action: 'update', priority: 5, scope: 'organization' },

            // System permissions (8)
            { id: 'cf5becb2-7604-4316-80ab-75320a5c375f', name: 'system.admin', description: 'Quản trị hệ thống', resource: 'system', action: 'admin', priority: 99, scope: 'global' },
            { id: '5c91795c-07bc-4883-bfd6-f40a258f0b7f', name: 'system.audit', description: 'Xem nhật ký hệ thống', resource: 'system', action: 'audit', priority: 10, scope: 'global' },
            { id: '2db85fb3-8c69-4c5e-bc80-b6d79bd842b4', name: 'system.backup', description: 'Sao lưu hệ thống', resource: 'system', action: 'backup', priority: 10, scope: 'global' },
            { id: 'f0653f90-c92d-43d5-acbf-cae48eb3f396', name: 'system.configure', description: 'Cấu hình hệ thống', resource: 'system', action: 'execute', scope: 'global' },
            { id: 'e0dacc81-9baa-483f-a0a4-18b16312fc48', name: 'system.logs', description: 'Xem logs hệ thống', resource: 'system', action: 'read', priority: 1, scope: 'global' },
            { id: '332e6a2b-7358-47b8-ab38-e14603cc2577', name: 'system.maintenance', description: 'Bảo trì hệ thống', resource: 'system', action: 'execute', scope: 'global' },
            { id: '91e5698d-fab5-47a6-8066-78a1c9dc6514', name: 'system.restore', description: 'Khôi phục hệ thống', resource: 'system', action: 'execute', scope: 'global' },
            { id: '00afe556-7a13-46c1-8872-95d193f2f4f9', name: 'system.settings', description: 'Cấu hình hệ thống', resource: 'system', action: 'settings', priority: 10, scope: 'global' },

            // User permissions (9)
            { id: 'd81e6bae-88bf-4907-9b77-8c8441f0d9f4', name: 'user.activate', description: 'Kích hoạt user', resource: 'user', action: 'execute', scope: 'organization' },
            { id: 'ec70507c-b5b2-4cdf-a7cf-708ba5376550', name: 'user.create', description: 'Tạo người dùng mới', resource: 'user', action: 'create', priority: 10, scope: 'organization' },
            { id: '41fb15d3-4a96-4e7d-8c0f-ba7cc33b50c7', name: 'user.deactivate', description: 'Vô hiệu hóa user', resource: 'user', action: 'execute', scope: 'organization' },
            { id: '3b64314e-9cc3-4320-b536-cf917be48211', name: 'user.delete', description: 'Xóa người dùng', resource: 'user', action: 'delete', priority: 10, scope: 'organization' },
            { id: 'ac122213-3494-4ac9-bc22-4ee9337949bf', name: 'user.list', description: 'Xem danh sách người dùng', resource: 'user', action: 'list', priority: 1, scope: 'organization' },
            { id: '30e24c42-cdbe-42d3-a6a7-943a95d19dbf', name: 'user.manage', description: 'Quản lý user toàn quyền', resource: 'user', action: 'manage', priority: 100, scope: 'organization' },
            { id: '7a5c4431-2709-4f6d-8a8f-7d85cfe28796', name: 'user.read', description: 'Xem thông tin người dùng', resource: 'user', action: 'read', priority: 1, scope: 'organization' },
            { id: '63b4a569-f156-4491-9e4b-a4209b564231', name: 'user.reset_password', description: 'Reset mật khẩu user', resource: 'user', action: 'execute', scope: 'organization' },
            { id: 'b60336c7-0a44-42ee-80bd-c989625ac94c', name: 'user.update', description: 'Cập nhật thông tin người dùng', resource: 'user', action: 'update', priority: 5, scope: 'organization' },

            // Warning permissions (5)
            { id: '21eae173-9002-4884-b74c-1d2b56bc315e', name: 'warning.acknowledge', description: 'Xác nhận cảnh báo', resource: 'warning', action: 'acknowledge', scope: 'project' },
            { id: 'efbc445f-3d78-487a-ba06-d4811630e672', name: 'warning.configure', description: 'Cấu hình cảnh báo', resource: 'warning', action: 'configure', scope: 'project' },
            { id: 'af84258a-9a80-4b85-be6c-a3a9893e12ff', name: 'warning.manage', description: 'Quản lý cảnh báo toàn quyền', resource: 'warning', action: 'manage', priority: 100, scope: 'project' },
            { id: '39ce758c-2bf4-4567-92aa-f4ef614ba31d', name: 'warning.read', description: 'Xem cảnh báo', resource: 'warning', action: 'read', priority: 1, scope: 'project' },
            { id: 'd873f686-95b6-450f-a71b-c7e2debea6da', name: 'warning.resolve', description: 'Giải quyết cảnh báo', resource: 'warning', action: 'resolve', scope: 'project' }
        ];

        const permissions = await Promise.all(
            permissionData.map(permission => 
                prisma.permissions.create({
                    data: {
                        id: permission.id,
                        name: permission.name,
                        description: permission.description,
                        resource: permission.resource,
                        action: permission.action,
                        priority: permission.priority || 0,
                        scope: permission.scope || 'global',
                        is_active: true
                    }
                })
            )
        );

        // 5. Assign permissions to roles
        console.log('🔗 Assigning permissions to roles...');
        
        // Helper function to find permission by name
        const findPermissionByName = (name) => permissions.find(p => p.name === name);
        
        // Define role-based permission mapping
        const rolePermissionMapping = {
            'Admin': [
                // Admin has ALL 79 permissions - complete system access
                ...permissionData.map(p => p.name)
            ],
            'Manager': [
                // Management oversight and coordination (25 permissions)
                'dashboard.view',
                'analytics.read', 'analytics.export',
                'audit.read', 'audit.list', 'audit.search',
                'data.read', 'data.export', 'data.import',
                'device.read', 'device.list', 'device.monitor', 'device.create', 'device.update',
                'department.read', 'department.list', 'department.create', 'department.update',
                'organization.read', 'organization.settings',
                'user.read', 'user.list', 'user.create', 'user.update',
                'warning.read', 'warning.configure'
            ],
            'Technician': [
                // Technical operations and device management (16 permissions)
                'dashboard.view',
                'data.read', 'data.create', 'data.update',
                'device.read', 'device.list', 'device.monitor', 'device.update', 'device.configure', 'device.calibrate',
                'department.read', 'department.list',
                'organization.read',
                'user.read',
                'warning.read', 'warning.acknowledge'
            ],
            'User': [
                // Read-only access for basic users (11 permissions)
                'dashboard.view',
                'data.read',
                'device.read', 'device.list', 'device.monitor', 
                'department.read', 'department.list',
                'organization.read',
                'user.read',
                'warning.read'
            ]
        };

        // Create role-permission assignments
        const rolePermissionAssignments = [];
        
        roles.forEach(role => {
            const permissionNames = rolePermissionMapping[role.name] || [];
            
            permissionNames.forEach(permissionName => {
                const permission = findPermissionByName(permissionName);
                if (permission) {
                    rolePermissionAssignments.push(
                        prisma.role_permissions.create({
                            data: {
                                role_id: role.id,
                                permission_id: permission.id
                            }
                        })
                    );
                } else {
                    console.warn(`⚠️ Permission '${permissionName}' not found for role '${role.name}'`);
                }
            });
        });

        await Promise.all(rolePermissionAssignments);
            prisma.role_permissions.create({
                data: {
                    role_id: roles[1].id, // Manager
                    permission_id: permissions[findPermission('device.read')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[1].id, // Manager
                    permission_id: permissions[findPermission('device.create')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[1].id, // Manager
                    permission_id: permissions[findPermission('device.update')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[1].id, // Manager
                    permission_id: permissions[findPermission('user.read')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[1].id, // Manager
                    permission_id: permissions[findPermission('user.create')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[1].id, // Manager
                    permission_id: permissions[findPermission('pdu.read')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[1].id, // Manager
                    permission_id: permissions[findPermission('pdu.create')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[1].id, // Manager
                    permission_id: permissions[findPermission('socket.read')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[1].id, // Manager
                    permission_id: permissions[findPermission('socket.assign')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[1].id, // Manager
                    permission_id: permissions[findPermission('data.read')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[1].id, // Manager
                    permission_id: permissions[findPermission('data.export')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[1].id, // Manager
                    permission_id: permissions[findPermission('alert.read')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[1].id, // Manager
                    permission_id: permissions[findPermission('alert.create')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[1].id, // Manager
                    permission_id: permissions[findPermission('maintenance.read')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[1].id, // Manager
                    permission_id: permissions[findPermission('maintenance.create')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[1].id, // Manager
                    permission_id: permissions[findPermission('department.read')].id
                }
            }),
            
            // Technician permissions (device maintenance, MQTT config, socket management)
            prisma.role_permissions.create({
                data: {
                    role_id: roles[2].id, // Technician
                    permission_id: permissions[findPermission('device.read')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[2].id, // Technician
                    permission_id: permissions[findPermission('device.update')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[2].id, // Technician
                    permission_id: permissions[findPermission('pdu.read')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[2].id, // Technician
                    permission_id: permissions[findPermission('pdu.update')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[2].id, // Technician
                    permission_id: permissions[findPermission('socket.read')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[2].id, // Technician
                    permission_id: permissions[findPermission('socket.update')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[2].id, // Technician
                    permission_id: permissions[findPermission('socket.assign')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[2].id, // Technician
                    permission_id: permissions[findPermission('mqtt.read')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[2].id, // Technician
                    permission_id: permissions[findPermission('mqtt.configure')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[2].id, // Technician
                    permission_id: permissions[findPermission('mqtt.publish')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[2].id, // Technician
                    permission_id: permissions[findPermission('data.read')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[2].id, // Technician
                    permission_id: permissions[findPermission('alert.read')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[2].id, // Technician
                    permission_id: permissions[findPermission('alert.acknowledge')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[2].id, // Technician
                    permission_id: permissions[findPermission('maintenance.read')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[2].id, // Technician
                    permission_id: permissions[findPermission('maintenance.create')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[2].id, // Technician
                    permission_id: permissions[findPermission('maintenance.update')].id
                }
            }),
            
            // User permissions (basic read access only)
            prisma.role_permissions.create({
                data: {
                    role_id: roles[3].id, // User
                    permission_id: permissions[findPermission('device.read')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[3].id, // User
                    permission_id: permissions[findPermission('pdu.read')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[3].id, // User
                    permission_id: permissions[findPermission('socket.read')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[3].id, // User
                    permission_id: permissions[findPermission('data.read')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[3].id, // User
                    permission_id: permissions[findPermission('alert.read')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[3].id, // User
                    permission_id: permissions[findPermission('maintenance.read')].id
                }
            }),
            prisma.role_permissions.create({
                data: {
                    role_id: roles[3].id, // User
                    permission_id: permissions[findPermission('department.read')].id
                }
            })
        ]);

        // 6. Create Users
        console.log('👤 Creating users...');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        const users = await Promise.all([
            prisma.users.create({
                data: {
                    username: 'admin',
                    email: 'admin@bvdkthanh.vn',
                    password_hash: hashedPassword,
                    full_name: 'Quản trị viên',
                    phone: '0123456789',
                    is_active: true,
                    organizations: {
                        connect: { id: organization.id }
                    },
                    departments: {
                        connect: { id: departments[3].id }
                    }
                }
            }),
            prisma.users.create({
                data: {
                    username: 'BSNHhai',
                    email: 'hai.nguyen@bvdkthanh.vn',
                    password_hash: await bcrypt.hash('password123', 10),
                    full_name: 'BS. Nguyễn Hồng Hải',
                    phone: '0987654321',
                    is_active: true,
                    organizations: {
                        connect: { id: organization.id }
                    },
                    departments: {
                        connect: { id: departments[0].id }
                    }
                }
            }),
            prisma.users.create({
                data: {
                    username: 'technician1',
                    email: 'tech1@bvdkthanh.vn',
                    password_hash: await bcrypt.hash('tech123', 10),
                    full_name: 'Nguyễn Văn Tâm',
                    phone: '0912345678',
                    is_active: true,
                    organizations: {
                        connect: { id: organization.id }
                    },
                    departments: {
                        connect: { id: departments[1].id }
                    }
                }
            })
        ]);

        // 7. Assign roles to users
        console.log('🔗 Assigning roles to users...');
        await Promise.all([
            prisma.user_roles.create({
                data: {
                    user_id: users[0].id,
                    role_id: roles[0].id, // Admin role
                    assigned_by: users[0].id,
                    is_active: true
                }
            }),
            prisma.user_roles.create({
                data: {
                    user_id: users[1].id,
                    role_id: roles[1].id, // Manager role
                    assigned_by: users[0].id,
                    is_active: true
                }
            }),
            prisma.user_roles.create({
                data: {
                    user_id: users[2].id,
                    role_id: roles[2].id, // Technician role
                    assigned_by: users[0].id,
                    is_active: true
                }
            })
        ]);

        // 8. Create Device Categories
        console.log('📱 Creating device categories...');
        const categories = await Promise.all([
            prisma.device_categories.create({
                data: {
                    name: 'Thiết bị y tế',
                    description: 'Tất cả thiết bị y tế trong bệnh viện'
                }
            })
        ]);

        const subCategories = await Promise.all([
            prisma.device_categories.create({
                data: {
                    name: 'Máy xét nghiệm',
                    description: 'Các loại máy xét nghiệm tự động',
                    parent_id: categories[0].id
                }
            }),
            prisma.device_categories.create({
                data: {
                    name: 'Máy chẩn đoán hình ảnh',
                    description: 'X-quang, CT, MRI, siêu âm',
                    parent_id: categories[0].id
                }
            }),
            prisma.device_categories.create({
                data: {
                    name: 'Thiết bị hồi sức',
                    description: 'Máy thở, monitor, máy sốc tim',
                    parent_id: categories[0].id
                }
            }),
            prisma.device_categories.create({
                data: {
                    name: 'Thiết bị môi trường',
                    description: 'Cảm biến nhiệt độ, độ ẩm, ánh sáng',
                    parent_id: categories[0].id
                }
            })
        ]);

        // 8. Create Manufacturers & Suppliers
        console.log('🏭 Creating manufacturers and suppliers...');
        const manufacturers = await Promise.all([
            prisma.manufacturers.create({
                data: {
                    name: 'Roche Diagnostics',
                    country: 'Germany',
                    website: 'https://www.roche.com',
                    contact_info: {
                        email: 'contact@roche.com',
                        phone: '+49-7624-14-0'
                    }
                }
            }),
            prisma.manufacturers.create({
                data: {
                    name: 'Siemens Healthineers',
                    country: 'Germany', 
                    website: 'https://www.siemens-healthineers.com',
                    contact_info: {
                        email: 'contact@siemens.com',
                        phone: '+49-9131-84-0'
                    }
                }
            }),
            prisma.manufacturers.create({
                data: {
                    name: 'GE Healthcare',
                    country: 'USA',
                    website: 'https://www.gehealthcare.com',
                    contact_info: {
                        email: 'contact@ge.com',
                        phone: '+1-262-544-3011'
                    }
                }
            }),
            prisma.manufacturers.create({
                data: {
                    name: 'AUO Corporation',
                    country: 'Taiwan',
                    website: 'https://www.auo.com',
                    contact_info: {
                        email: 'contact@auo.com',
                        phone: '+886-3-520-8888'
                    }
                }
            })
        ]);

        const suppliers = await Promise.all([
            prisma.suppliers.create({
                data: {
                    name: 'Công ty TNHH Thiết bị Y tế Việt Nam',
                    country: 'Vietnam',
                    website: 'https://medviet.com',
                    contact_info: {
                        contact_person: 'Nguyễn Văn A',
                        phone: '028-3456-7890',
                        email: 'info@medviet.com',
                        address: '123 Lê Lợi, Q1, TP.HCM'
                    }
                }
            }),
            prisma.suppliers.create({
                data: {
                    name: 'Công ty CP Công nghệ Y tế Quốc tế',
                    country: 'Vietnam',
                    website: 'https://intlmed.vn',
                    contact_info: {
                        contact_person: 'Trần Thị B',
                        phone: '024-3456-7891',
                        email: 'sales@intlmed.vn',
                        address: '456 Trần Hưng Đạo, Hà Nội'
                    }
                }
            })
        ]);

        // 9. Create Device Models
        console.log('🔧 Creating device models...');
        const deviceModels = await Promise.all([
            prisma.device_models.create({
                data: {
                    category_id: subCategories[0].id, // Lab equipment
                    name: 'Cobas 6000',
                    model_number: 'COBAS-6000',
                    manufacturer_id: manufacturers[0].id, // Roche
                    supplier_id: suppliers[0].id
                }
            }),
            prisma.device_models.create({
                data: {
                    category_id: subCategories[1].id, // Imaging
                    name: 'Multix Select DR',
                    model_number: 'MULTIX-SELECT-DR',
                    manufacturer_id: manufacturers[1].id, // Siemens
                    supplier_id: suppliers[0].id
                }
            }),
            prisma.device_models.create({
                data: {
                    category_id: subCategories[1].id, // Imaging
                    name: 'LOGIQ P9',
                    model_number: 'LOGIQ-P9',
                    manufacturer_id: manufacturers[2].id, // GE
                    supplier_id: suppliers[1].id
                }
            }),
            prisma.device_models.create({
                data: {
                    category_id: subCategories[3].id, // Environment
                    name: 'AUO Display G070VW01',
                    model_number: 'G070VW01',
                    manufacturer_id: manufacturers[3].id, // AUO
                    supplier_id: suppliers[1].id
                }
            })
        ]);

        // 10. Create Devices
        console.log('🖥️ Creating devices...');
        const devices = await Promise.all([
            prisma.device.create({
                data: {
                    model_id: deviceModels[0].id,
                    organization_id: organization.id,
                    department_id: departments[0].id,
                    serial_number: 'RC6000-2024-001',
                    asset_tag: 'XN-001',
                    status: 'active',
                    purchase_date: new Date('2024-01-15'),
                    installation_date: new Date('2024-02-01'),
                    location: 'Phòng XN - Tầng 2'
                }
            }),
            prisma.device.create({
                data: {
                    model_id: deviceModels[1].id,
                    organization_id: organization.id,
                    department_id: departments[1].id,
                    serial_number: 'SI-DR-2024-003',
                    asset_tag: 'CDHA-001',
                    status: 'active',
                    purchase_date: new Date('2024-02-20'),
                    installation_date: new Date('2024-03-15'),
                    location: 'Phòng X-quang - Tầng 1'
                }
            }),
            prisma.device.create({
                data: {
                    model_id: deviceModels[3].id,
                    organization_id: organization.id,
                    department_id: departments[0].id,
                    serial_number: 'AUO-ENV-001',
                    asset_tag: 'ENV-001',
                    status: 'active',
                    purchase_date: new Date('2024-03-01'),
                    installation_date: new Date('2024-03-10'),
                    location: 'Phòng XN - Cảm biến môi trường'
                }
            })
        ]);

        // 11. Device Connectivity removed - MQTT config now handled via PDU/Socket configuration
        console.log('📡 Skipping device connectivity (moved to socket configuration)...');

        // 12. Create Warranty Information
        console.log('📋 Creating warranty information...');
        await Promise.all([
            prisma.warranty_info.create({
                data: {
                    device_id: devices[0].id,
                    warranty_start: new Date('2024-02-01'),
                    warranty_end: new Date('2027-02-01'),
                    provider: 'Roche Diagnostics Vietnam'
                }
            }),
            prisma.warranty_info.create({
                data: {
                    device_id: devices[1].id,
                    warranty_start: new Date('2024-03-15'),
                    warranty_end: new Date('2029-03-15'),
                    provider: 'Siemens Healthineers Vietnam'
                }
            })
        ]);

        // 13. Create Specifications (skip for now due to complex schema)
        console.log('📝 Skipping device specifications (complex schema)...');

        // 14. Create some sample IoT data tables (skip for now)
        console.log('🌡️ Skipping IoT data tables (will be populated by MQTT)...');

        console.log('✅ IoMT database seeding completed successfully!');
        console.log('\n📊 Summary:');
        console.log(`- Organizations: 1`);
        console.log(`- Departments: ${departments.length}`);
        console.log(`- Users: ${users.length}`);
        console.log(`- Roles: ${roles.length}`);
        console.log(`- Permissions: ${permissions.length} (Complete IoMT permission set)`);
        console.log(`- Role-Permission Assignments: Configured for all roles`);
        console.log(`- Device Categories: ${categories.length + subCategories.length}`);
        console.log(`- Device Models: ${deviceModels.length}`);
        console.log(`- Devices: ${devices.length}`);
        console.log('\n🔐 Permission Summary:');
        console.log('- Admin: All permissions (system admin)');
        console.log('- Manager: Device management, User management, PDU/Socket oversight, Data export, Alerts');
        console.log('- Technician: Device maintenance, MQTT configuration, Socket management, Alerts handling');
        console.log('- User: Read-only access to devices, data, alerts, and maintenance records');
        console.log('\n🔑 Login credentials:');
        console.log('Username: admin | Password: admin123');
        console.log('Username: BSNHhai | Password: password123');
        console.log('Username: technician1 | Password: tech123');

    } catch (error) {
        console.error('❌ Error seeding database:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });