import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixDevicePermissions() {
    try {
        console.log('🔧 FIXING DEVICE PERMISSIONS FOR ADMIN');
        console.log('=====================================');

        // 1. Find or create device permissions
        const devicePermissions = [
            { name: 'device.read', resource: 'device', action: 'read', description: 'Read device information' },
            { name: 'device.create', resource: 'device', action: 'create', description: 'Create new devices' },
            { name: 'device.update', resource: 'device', action: 'update', description: 'Update device information' },
            { name: 'device.delete', resource: 'device', action: 'delete', description: 'Delete devices' },
            { name: 'device.manage', resource: 'device', action: 'manage', description: 'Full device management' }
        ];

        console.log('📝 Creating/updating device permissions...');
        const createdPermissions = [];
        
        for (const perm of devicePermissions) {
            const permission = await prisma.$queryRaw`
                INSERT INTO permissions (name, resource, action, description)
                VALUES (${perm.name}, ${perm.resource}, ${perm.action}, ${perm.description})
                ON CONFLICT (name) DO UPDATE SET
                    resource = EXCLUDED.resource,
                    action = EXCLUDED.action,
                    description = EXCLUDED.description
                RETURNING *
            `;
            createdPermissions.push(permission[0]);
            console.log(`   ✅ ${perm.name}`);
        }

        // 2. Find Admin role
        const adminRole = await prisma.$queryRaw`
            SELECT * FROM roles WHERE name = 'Admin' LIMIT 1
        `;

        if (adminRole.length === 0) {
            throw new Error('Admin role not found');
        }

        console.log(`📋 Found Admin role: ${adminRole[0].name} (${adminRole[0].id})`);

        // 3. Assign all device permissions to Admin role
        console.log('🔗 Assigning device permissions to Admin role...');
        for (const permission of createdPermissions) {
            await prisma.$queryRaw`
                INSERT INTO role_permissions (role_id, permission_id)
                VALUES (${adminRole[0].id}::uuid, ${permission.id}::uuid)
                ON CONFLICT (role_id, permission_id) DO NOTHING
            `;
            console.log(`   ✅ ${permission.name} → Admin role`);
        }

        // 4. Also assign to superadmin user directly
        const superAdminUser = await prisma.$queryRaw`
            SELECT * FROM users WHERE username = 'superadmin' OR email = 'superadmin@example.com' LIMIT 1
        `;

        if (superAdminUser.length > 0) {
            console.log(`👤 Found superadmin user: ${superAdminUser[0].username}`);
            console.log('🔗 Assigning device permissions to superadmin user directly...');
            
            for (const permission of createdPermissions) {
                await prisma.$queryRaw`
                    INSERT INTO user_permissions (user_id, permission_id)
                    VALUES (${superAdminUser[0].id}::uuid, ${permission.id}::uuid)
                    ON CONFLICT (user_id, permission_id) DO NOTHING
                `;
                console.log(`   ✅ ${permission.name} → superadmin user`);
            }
        }

        // 5. Verify permissions for admin user
        const adminUser = await prisma.$queryRaw`
            SELECT * FROM users WHERE username = 'admin' LIMIT 1
        `;

        if (adminUser.length > 0) {
            console.log(`\n🔍 VERIFYING PERMISSIONS FOR ADMIN USER`);
            console.log(`User: ${adminUser[0].username} (${adminUser[0].email})`);
            
            // Check role-based permissions
            const rolePerms = await prisma.$queryRaw`
                SELECT DISTINCT p.name, p.resource, p.action, 'role' as source
                FROM user_roles ur
                JOIN role_permissions rp ON ur.role_id = rp.role_id
                JOIN permissions p ON rp.permission_id = p.id
                WHERE ur.user_id = ${adminUser[0].id} AND p.resource = 'device'
            `;

            // Check direct user permissions
            const userPerms = await prisma.$queryRaw`
                SELECT DISTINCT p.name, p.resource, p.action, 'direct' as source
                FROM user_permissions up
                JOIN permissions p ON up.permission_id = p.id
                WHERE up.user_id = ${adminUser[0].id} AND p.resource = 'device'
            `;

            console.log('Role-based device permissions:', rolePerms.length);
            rolePerms.forEach(p => console.log(`   ✅ ${p.name} (from ${p.source})`));
            
            console.log('Direct user device permissions:', userPerms.length);
            userPerms.forEach(p => console.log(`   ✅ ${p.name} (from ${p.source})`));

            const totalDevicePerms = [...rolePerms, ...userPerms];
            console.log(`\n📊 Total device permissions: ${totalDevicePerms.length}`);
        }

        console.log('\n🎉 Device permissions fixed successfully!');
        
    } catch (error) {
        console.error('❌ Error fixing device permissions:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fixDevicePermissions();