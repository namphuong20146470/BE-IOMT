import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedTestData() {
    try {
        console.log('🌱 Seeding test data for user permissions...\n');
        
        // 1. Create test permissions
        console.log('📝 Creating test permissions...');
        
        const permissions = [
            { code: 'device.view', name: 'View Devices', description: 'Can view device information' },
            { code: 'device.create', name: 'Create Devices', description: 'Can create new devices' },
            { code: 'device.edit', name: 'Edit Devices', description: 'Can edit device information' },
            { code: 'device.delete', name: 'Delete Devices', description: 'Can delete devices' },
            { code: 'user.manage', name: 'Manage Users', description: 'Can manage user accounts' },
            { code: 'user.permissions.manage', name: 'Manage User Permissions', description: 'Can grant/revoke user permissions' },
            { code: 'admin.full_access', name: 'Full Admin Access', description: 'Complete system access' }
        ];
        
        for (const perm of permissions) {
            try {
                await prisma.permissions.upsert({
                    where: { code: perm.code },
                    update: perm,
                    create: perm
                });
                console.log(`✅ Permission: ${perm.code}`);
            } catch (error) {
                console.log(`⚠️  Permission ${perm.code} already exists or error: ${error.message}`);
            }
        }
        
        // 2. Create test roles
        console.log('\n👤 Creating test roles...');
        
        const roles = [
            { name: 'Admin', description: 'System Administrator', is_active: true },
            { name: 'Manager', description: 'Department Manager', is_active: true },
            { name: 'Staff', description: 'Regular Staff Member', is_active: true }
        ];
        
        for (const role of roles) {
            try {
                await prisma.roles.upsert({
                    where: { name: role.name },
                    update: role,
                    create: role
                });
                console.log(`✅ Role: ${role.name}`);
            } catch (error) {
                console.log(`⚠️  Role ${role.name} already exists or error: ${error.message}`);
            }
        }
        
        // 3. Create test users
        console.log('\n🧑‍💼 Creating test users...');
        
        const users = [
            { 
                username: 'admin_test', 
                email: 'admin@iomt.test', 
                password_hash: 'hashed_password',
                is_active: true
            },
            { 
                username: 'manager_test', 
                email: 'manager@iomt.test', 
                password_hash: 'hashed_password',
                is_active: true
            },
            { 
                username: 'staff_test', 
                email: 'staff@iomt.test', 
                password_hash: 'hashed_password',
                is_active: true
            }
        ];
        
        for (const user of users) {
            try {
                await prisma.users.upsert({
                    where: { email: user.email },
                    update: user,
                    create: user
                });
                console.log(`✅ User: ${user.username} (${user.email})`);
            } catch (error) {
                console.log(`⚠️  User ${user.username} already exists or error: ${error.message}`);
            }
        }
        
        // 4. Assign roles to users
        console.log('\n🔗 Assigning roles to users...');
        
        const adminRole = await prisma.roles.findUnique({ where: { name: 'Admin' } });
        const managerRole = await prisma.roles.findUnique({ where: { name: 'Manager' } });
        const staffRole = await prisma.roles.findUnique({ where: { name: 'Staff' } });
        
        const adminUser = await prisma.users.findUnique({ where: { email: 'admin@iomt.test' } });
        const managerUser = await prisma.users.findUnique({ where: { email: 'manager@iomt.test' } });
        const staffUser = await prisma.users.findUnique({ where: { email: 'staff@iomt.test' } });
        
        if (adminRole && adminUser) {
            await prisma.user_roles.upsert({
                where: { 
                    user_id_role_id: { 
                        user_id: adminUser.id, 
                        role_id: adminRole.id 
                    } 
                },
                update: { is_active: true },
                create: {
                    user_id: adminUser.id,
                    role_id: adminRole.id,
                    is_active: true
                }
            });
            console.log(`✅ Assigned Admin role to admin_test`);
        }
        
        if (managerRole && managerUser) {
            await prisma.user_roles.upsert({
                where: { 
                    user_id_role_id: { 
                        user_id: managerUser.id, 
                        role_id: managerRole.id 
                    } 
                },
                update: { is_active: true },
                create: {
                    user_id: managerUser.id,
                    role_id: managerRole.id,
                    is_active: true
                }
            });
            console.log(`✅ Assigned Manager role to manager_test`);
        }
        
        if (staffRole && staffUser) {
            await prisma.user_roles.upsert({
                where: { 
                    user_id_role_id: { 
                        user_id: staffUser.id, 
                        role_id: staffRole.id 
                    } 
                },
                update: { is_active: true },
                create: {
                    user_id: staffUser.id,
                    role_id: staffRole.id,
                    is_active: true
                }
            });
            console.log(`✅ Assigned Staff role to staff_test`);
        }
        
        // 5. Assign permissions to roles
        console.log('\n🔑 Assigning permissions to roles...');
        
        // Admin gets all permissions
        if (adminRole) {
            const allPermissions = await prisma.permissions.findMany();
            for (const perm of allPermissions) {
                try {
                    await prisma.role_permissions.upsert({
                        where: {
                            role_id_permission_id: {
                                role_id: adminRole.id,
                                permission_id: perm.id
                            }
                        },
                        update: {},
                        create: {
                            role_id: adminRole.id,
                            permission_id: perm.id
                        }
                    });
                } catch (error) {
                    // Ignore duplicate errors
                }
            }
            console.log(`✅ Assigned all permissions to Admin role`);
        }
        
        // Manager gets some permissions
        if (managerRole) {
            const managerPerms = ['device.view', 'device.create', 'device.edit', 'user.manage'];
            for (const permCode of managerPerms) {
                const perm = await prisma.permissions.findUnique({ where: { code: permCode } });
                if (perm) {
                    try {
                        await prisma.role_permissions.upsert({
                            where: {
                                role_id_permission_id: {
                                    role_id: managerRole.id,
                                    permission_id: perm.id
                                }
                            },
                            update: {},
                            create: {
                                role_id: managerRole.id,
                                permission_id: perm.id
                            }
                        });
                    } catch (error) {
                        // Ignore duplicate errors
                    }
                }
            }
            console.log(`✅ Assigned manager permissions to Manager role`);
        }
        
        // Staff gets basic permissions
        if (staffRole) {
            const staffPerms = ['device.view', 'device.create'];
            for (const permCode of staffPerms) {
                const perm = await prisma.permissions.findUnique({ where: { code: permCode } });
                if (perm) {
                    try {
                        await prisma.role_permissions.upsert({
                            where: {
                                role_id_permission_id: {
                                    role_id: staffRole.id,
                                    permission_id: perm.id
                                }
                            },
                            update: {},
                            create: {
                                role_id: staffRole.id,
                                permission_id: perm.id
                            }
                        });
                    } catch (error) {
                        // Ignore duplicate errors
                    }
                }
            }
            console.log(`✅ Assigned staff permissions to Staff role`);
        }
        
        console.log('\n🎯 Test data seeding completed!');
        console.log('\n📊 Summary:');
        console.log(`   Users: ${await prisma.users.count()}`);
        console.log(`   Roles: ${await prisma.roles.count()}`);
        console.log(`   Permissions: ${await prisma.permissions.count()}`);
        console.log(`   User Roles: ${await prisma.user_roles.count()}`);
        console.log(`   Role Permissions: ${await prisma.role_permissions.count()}`);
        
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        console.error(error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

seedTestData();