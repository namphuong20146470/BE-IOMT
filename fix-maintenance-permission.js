// fix-maintenance-permission.js
// Script để kiểm tra và thêm maintenance permissions cho user

import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

async function checkAndFixMaintenancePermission() {
    try {
        console.log('🔍 Checking maintenance permissions...\n');

        // 1. Kiểm tra xem permission maintenance.create có tồn tại không
        const maintenancePermissions = await prisma.permissions.findMany({
            where: {
                name: {
                    startsWith: 'maintenance.'
                }
            }
        });

        console.log('📋 Found maintenance permissions:', maintenancePermissions.length);
        maintenancePermissions.forEach(p => {
            console.log(`   - ${p.name}: ${p.description}`);
        });
        console.log('');

        // 2. Nếu không có, tạo mới
        if (maintenancePermissions.length === 0) {
            console.log('⚠️  No maintenance permissions found. Creating...');
            
            const permissionsToCreate = [
                {
                    name: 'maintenance.create',
                    description: 'Create maintenance logs',
                    resource: 'maintenance',
                    action: 'create'
                },
                {
                    name: 'maintenance.read',
                    description: 'View maintenance logs',
                    resource: 'maintenance',
                    action: 'read'
                },
                {
                    name: 'maintenance.update',
                    description: 'Update maintenance logs',
                    resource: 'maintenance',
                    action: 'update'
                },
                {
                    name: 'maintenance.delete',
                    description: 'Delete maintenance logs',
                    resource: 'maintenance',
                    action: 'delete'
                }
            ];

            for (const perm of permissionsToCreate) {
                const created = await prisma.permissions.create({
                    data: perm
                });
                console.log(`   ✅ Created: ${created.name}`);
            }
            console.log('');
        }

        // 3. Lấy lại danh sách permissions sau khi tạo
        const allMaintenancePerms = await prisma.permissions.findMany({
            where: {
                name: {
                    startsWith: 'maintenance.'
                }
            }
        });

        // 4. Kiểm tra roles hiện có
        console.log('📊 Checking roles...\n');
        const roles = await prisma.roles.findMany({
            include: {
                role_permissions: {
                    include: {
                        permission: true
                    }
                }
            }
        });

        console.log(`Found ${roles.length} roles:`);
        
        for (const role of roles) {
            const hasMaintenancePerms = role.role_permissions.some(rp => 
                rp.permission.name.startsWith('maintenance.')
            );
            
            console.log(`   - ${role.name} (${role.organization_id ? 'Organization-specific' : 'Global'})`);
            console.log(`     Maintenance permissions: ${hasMaintenancePerms ? '✅ Yes' : '❌ No'}`);
            
            if (hasMaintenancePerms) {
                const maintenancePermsForRole = role.role_permissions
                    .filter(rp => rp.permission.name.startsWith('maintenance.'))
                    .map(rp => rp.permission.name);
                console.log(`     Permissions: ${maintenancePermsForRole.join(', ')}`);
            }
        }
        console.log('');

        // 5. Đề xuất thêm permissions vào roles
        console.log('💡 Recommendations:\n');
        console.log('To add maintenance permissions to a role, run this SQL:');
        console.log('');
        console.log('-- For Admin role (replace role_id)');
        console.log("INSERT INTO role_permissions (role_id, permission_id)");
        console.log("SELECT ");
        console.log("    (SELECT id FROM roles WHERE name = 'Admin' LIMIT 1) as role_id,");
        console.log("    id as permission_id");
        console.log("FROM permissions");
        console.log("WHERE name LIKE 'maintenance.%'");
        console.log("ON CONFLICT (role_id, permission_id) DO NOTHING;");
        console.log('');

        // 6. Kiểm tra user cụ thể (nếu có trong environment)
        const testUserId = process.env.TEST_USER_ID;
        if (testUserId) {
            console.log(`\n🔍 Checking specific user: ${testUserId}`);
            const user = await prisma.users.findUnique({
                where: { id: testUserId },
                include: {
                    user_roles: {
                        include: {
                            role: {
                                include: {
                                    role_permissions: {
                                        include: {
                                            permission: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            if (user) {
                console.log(`User: ${user.username}`);
                console.log(`Roles: ${user.user_roles.map(ur => ur.role.name).join(', ')}`);
                
                const userPermissions = new Set();
                user.user_roles.forEach(ur => {
                    ur.role.role_permissions.forEach(rp => {
                        userPermissions.add(rp.permission.name);
                    });
                });

                const hasMaintenanceCreate = userPermissions.has('maintenance.create');
                console.log(`Has maintenance.create: ${hasMaintenanceCreate ? '✅ Yes' : '❌ No'}`);
                
                if (!hasMaintenanceCreate) {
                    console.log('\n⚠️  User does NOT have maintenance.create permission!');
                    console.log('Please add this permission to one of their roles.');
                }
            }
        }

        console.log('\n✅ Check complete!');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run
checkAndFixMaintenancePermission();
