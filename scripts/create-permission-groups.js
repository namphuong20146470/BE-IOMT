/**
 * Create permission groups and assign permissions
 * This script runs the permission groups migration
 */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function createPermissionGroups() {
    try {
        console.log('\n🚀 CREATING PERMISSION GROUPS...\n');
        
        // Step 1: Create permission groups
        console.log('📦 Creating 12 permission groups...');
        
        const groups = [
            { id: '11111111-1111-1111-1111-111111111111', name: 'Quản trị hệ thống', description: 'Các quyền quản trị và cấu hình hệ thống cốt lõi', color: '#FF5722', icon: 'shield-check', sort_order: 1 },
            { id: '22222222-2222-2222-2222-222222222222', name: 'Quản lý tổ chức', description: 'Quản lý tổ chức, phòng ban và cấu trúc', color: '#2196F3', icon: 'building', sort_order: 2 },
            { id: '33333333-3333-3333-3333-333333333333', name: 'Quản lý người dùng', description: 'Quản lý tài khoản người dùng và thông tin', color: '#4CAF50', icon: 'users', sort_order: 3 },
            { id: '44444444-4444-4444-4444-444444444444', name: 'Quản lý vai trò & quyền', description: 'Quản lý roles, permissions và phân quyền', color: '#9C27B0', icon: 'user-lock', sort_order: 4 },
            { id: '55555555-5555-5555-5555-555555555555', name: 'Quản lý thiết bị', description: 'Quản lý thiết bị, models và cấu hình thiết bị', color: '#FF9800', icon: 'devices', sort_order: 5 },
            { id: '66666666-6666-6666-6666-666666666666', name: 'Quản lý dữ liệu', description: 'Quản lý dữ liệu từ thiết bị và xử lý dữ liệu', color: '#00BCD4', icon: 'database', sort_order: 6 },
            { id: '77777777-7777-7777-7777-777777777777', name: 'Quản lý dự án', description: 'Quản lý dự án và thành viên dự án', color: '#3F51B5', icon: 'folder-open', sort_order: 7 },
            { id: '88888888-8888-8888-8888-888888888888', name: 'Cảnh báo & Thông báo', description: 'Quản lý cảnh báo, thông báo và cấu hình', color: '#F44336', icon: 'bell', sort_order: 8 },
            { id: '99999999-9999-9999-9999-999999999999', name: 'Báo cáo & Phân tích', description: 'Tạo và quản lý báo cáo, phân tích dữ liệu', color: '#607D8B', icon: 'chart-bar', sort_order: 9 },
            { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Kiểm toán & Giám sát', description: 'Xem logs, audit trails và giám sát hệ thống', color: '#795548', icon: 'clipboard-list', sort_order: 10 },
            { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', name: 'Dashboard & Hiển thị', description: 'Quản lý dashboard và giao diện hiển thị', color: '#009688', icon: 'layout-dashboard', sort_order: 11 },
            { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', name: 'Quản lý Bảo trì', description: 'Quản lý maintenance logs và lịch sử bảo trì', color: '#673AB7', icon: 'tools', sort_order: 12 }
        ];
        
        for (const group of groups) {
            await prisma.permission_groups.upsert({
                where: { id: group.id },
                update: group,
                create: { ...group, is_active: true }
            });
            console.log(`   ✅ ${group.name}`);
        }
        
        // Step 2: Assign permissions to groups
        console.log('\n🔗 Assigning permissions to groups...');
        
        const assignments = {
            '11111111-1111-1111-1111-111111111111': ['system.admin', 'system.configure', 'system.settings', 'system.maintenance', 'system.backup', 'system.restore', 'system.logs', 'system.audit'],
            '22222222-2222-2222-2222-222222222222': ['organization.manage', 'organization.create', 'organization.read', 'organization.update', 'organization.delete', 'organization.list', 'organization.settings', 'department.manage', 'department.create', 'department.read', 'department.update', 'department.delete', 'department.list'],
            '33333333-3333-3333-3333-333333333333': ['user.manage', 'user.create', 'user.read', 'user.update', 'user.delete', 'user.list', 'user.activate', 'user.deactivate', 'user.reset_password'],
            '44444444-4444-4444-4444-444444444444': ['role.manage', 'role.create', 'role.read', 'role.update', 'role.delete', 'role.list', 'role.assign_permission', 'role.assign', 'permission.manage', 'permission.create', 'permission.read', 'permission.update', 'permission.delete', 'permission.list', 'permission.assign'],
            '55555555-5555-5555-5555-555555555555': ['device.manage', 'device.create', 'device.read', 'device.update', 'device.delete', 'device.list', 'device.monitor', 'device.configure', 'device.calibrate'],
            '66666666-6666-6666-6666-666666666666': ['data.manage', 'data.create', 'data.read', 'data.update', 'data.delete', 'data.export', 'data.import'],
            '88888888-8888-8888-8888-888888888888': ['warning.manage', 'warning.read', 'warning.acknowledge', 'warning.resolve', 'warning.configure'],
            '99999999-9999-9999-9999-999999999999': ['analytics.read', 'analytics.export', 'analytics.advanced'],
            'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': ['audit.list', 'audit.read', 'audit.search', 'audit.export'],
            'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb': ['dashboard.view'],
            'cccccccc-cccc-cccc-cccc-cccccccccccc': ['maintenance.create', 'maintenance.read', 'maintenance.update', 'maintenance.delete']
        };
        
        let assignedCount = 0;
        
        for (const [groupId, permissionNames] of Object.entries(assignments)) {
            for (const permName of permissionNames) {
                const updated = await prisma.permissions.updateMany({
                    where: { name: permName },
                    data: { group_id: groupId }
                });
                if (updated.count > 0) {
                    assignedCount++;
                }
            }
        }
        
        console.log(`   ✅ Assigned ${assignedCount} permissions to groups`);
        
        // Step 3: Verify
        console.log('\n📊 Verification:');
        
        const groupCounts = await prisma.$queryRaw`
            SELECT 
                pg.name,
                COUNT(p.id)::int AS permission_count
            FROM permission_groups pg
            LEFT JOIN permissions p ON p.group_id = pg.id
            GROUP BY pg.id, pg.name, pg.sort_order
            ORDER BY pg.sort_order
        `;
        
        groupCounts.forEach(g => {
            console.log(`   ${g.name.padEnd(35)} ${g.permission_count} permissions`);
        });
        
        const ungrouped = await prisma.permissions.count({
            where: { group_id: null }
        });
        
        if (ungrouped > 0) {
            console.log(`\n⚠️  ${ungrouped} permissions remain ungrouped`);
        } else {
            console.log('\n✅ All permissions are now grouped!');
        }
        
        console.log('\n✅ Permission groups created successfully!\n');
        
    } catch (error) {
        console.error('❌ Error creating permission groups:', error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

createPermissionGroups()
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
