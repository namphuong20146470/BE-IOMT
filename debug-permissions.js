import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkUserPermissions() {
    try {
        // Get a sample user
        const users = await prisma.users.findMany({
            take: 2,
            select: {
                id: true,
                username: true,
                full_name: true,
                organization_id: true,
                department_id: true
            }
        });
        
        console.log('📋 Sample Users:');
        users.forEach(user => {
            console.log(`- ${user.username} (${user.full_name})`);
            console.log(`  ID: ${user.id}`);
            console.log(`  Org: ${user.organization_id}`);
            console.log(`  Dept: ${user.department_id}`);
        });

        if (users.length > 0) {
            const userId = users[0].id;
            
            // Check permissions for first user
            console.log(`\n🔍 Checking permissions for ${users[0].username}:`);
            
            const userRoles = await prisma.user_roles.findMany({
                where: { user_id: userId },
                include: {
                    roles: {
                        include: {
                            role_permissions: {
                                include: {
                                    permissions: true
                                }
                            }
                        }
                    }
                }
            });
            
            console.log(`📝 User Roles (${userRoles.length}):`);
            userRoles.forEach(ur => {
                console.log(`- Role: ${ur.roles.name}`);
                console.log(`  Permissions (${ur.roles.role_permissions.length}):`);
                ur.roles.role_permissions.forEach(rp => {
                    console.log(`    * ${rp.permissions.name}`);
                });
            });
            
            // Check direct permissions
            const directPerms = await prisma.user_permissions.findMany({
                where: { user_id: userId },
                include: { permissions: true }
            });
            
            console.log(`\n📋 Direct Permissions (${directPerms.length}):`);
            directPerms.forEach(dp => {
                console.log(`- ${dp.permissions.name}`);
            });
        }

        // Check available permissions
        console.log(`\n🔐 Available Device Permissions:`);
        const devicePerms = await prisma.permissions.findMany({
            where: {
                OR: [
                    { resource: 'device' },
                    { name: { contains: 'device' } }
                ]
            },
            select: { name: true, description: true, resource: true, action: true }
        });
        
        devicePerms.forEach(perm => {
            console.log(`- ${perm.name} (${perm.resource}.${perm.action})`);
            if (perm.description) console.log(`  ${perm.description}`);
        });
        
        await prisma.$disconnect();
    } catch (error) {
        console.error('❌ Error:', error);
        await prisma.$disconnect();
    }
}

checkUserPermissions();