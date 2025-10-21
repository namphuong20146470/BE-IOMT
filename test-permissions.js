// Test script for user permissions system
// Run with: node test-permissions.js

import { PrismaClient } from '@prisma/client';
import { 
    getUserAllPermissions,
    getUserDirectPermissions,
    getUserPermissionsBySource,
    hasPermissionEnhanced,
    isSystemAdmin,
    hasPermission
} from './utils/permissionHelpers.js';

const prisma = new PrismaClient();

async function testUserPermissions() {
    try {
        console.log('🧪 Testing User Permissions System...\n');

        // Find a test user
        const testUser = await prisma.users.findFirst({
            where: { email: 'admin@bvdkthanh.vn' }
        });

        if (!testUser) {
            console.log('❌ Test user not found. Please run seeding first.');
            return;
        }

        console.log(`📋 Testing permissions for user: ${testUser.full_name} (${testUser.email})`);

        // Test 1: Get all permissions
        console.log('\n🔍 Test 1: Get all permissions...');
        const allPermissions = await getUserAllPermissions(testUser.id);
        console.log('All permissions:', allPermissions);

        // Test 2: Get permissions by source
        console.log('\n🔍 Test 2: Get permissions by source...');
        const permissionsBySource = await getUserPermissionsBySource(testUser.id);
        console.log('Role permissions count:', permissionsBySource.rolePermissions.length);
        console.log('Direct permissions count:', permissionsBySource.directPermissions.length);
        console.log('Total unique permissions:', permissionsBySource.allPermissions.length);

        // Test 3: Check specific permissions
        console.log('\n🔍 Test 3: Check specific permissions...');
        const hasSystemAdmin = await hasPermissionEnhanced(testUser.id, 'system.admin');
        const hasDeviceManage = await hasPermissionEnhanced(testUser.id, 'device.manage');
        
        console.log('Has system.admin:', hasSystemAdmin);
        console.log('Has device.manage:', hasDeviceManage);

        // Test 4: Simulate JWT user object
        console.log('\n🔍 Test 4: Test with JWT user object...');
        const jwtUser = {
            id: testUser.id,
            username: testUser.username,
            permissions: allPermissions
        };

        const isAdmin = isSystemAdmin(jwtUser);
        const canManageDevices = hasPermission(jwtUser, 'device.manage');
        
        console.log('Is system admin (JWT):', isAdmin);
        console.log('Can manage devices (JWT):', canManageDevices);

        // Test 5: Create a direct permission assignment for testing
        console.log('\n🔍 Test 5: Create direct permission assignment...');
        
        // Find a permission to assign directly
        const testPermission = await prisma.permissions.findFirst({
            where: { name: 'device.calibrate' }
        });

        if (testPermission) {
            // Assign direct permission
            await prisma.user_permissions.upsert({
                where: {
                    user_id_permission_id: {
                        user_id: testUser.id,
                        permission_id: testPermission.id
                    }
                },
                create: {
                    user_id: testUser.id,
                    permission_id: testPermission.id,
                    granted_by: testUser.id, // Self-granted for test
                    granted_at: new Date(),
                    valid_from: new Date(),
                    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                    is_active: true,
                    notes: 'Test direct permission assignment'
                },
                update: {
                    is_active: true,
                    notes: 'Test direct permission assignment (updated)'
                }
            });

            console.log('✅ Direct permission assigned:', testPermission.name);

            // Test direct permissions
            const directPermissions = await getUserDirectPermissions(testUser.id);
            console.log('Direct permissions:', directPermissions.map(dp => dp.permission.name));

            // Test updated permissions by source
            const updatedPermissionsBySource = await getUserPermissionsBySource(testUser.id);
            console.log('Updated total permissions:', updatedPermissionsBySource.allPermissions.length);
        }

        console.log('\n✅ All tests completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run tests
testUserPermissions();