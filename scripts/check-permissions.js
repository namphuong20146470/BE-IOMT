/**
 * Check current permissions and permission groups in database
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPermissions() {
    try {
        console.log('\n🔍 CHECKING PERMISSIONS AND GROUPS...\n');
        
        // 1. Count total permissions
        const totalPermissions = await prisma.permissions.count();
        console.log(`📊 Total Permissions: ${totalPermissions}`);
        
        // 2. Check permission groups
        const groups = await prisma.permission_groups.findMany({
            orderBy: { sort_order: 'asc' }
        });
        
        console.log(`\n📦 Permission Groups: ${groups.length}`);
        groups.forEach(group => {
            console.log(`   - ${group.name} (${group.color})`);
        });
        
        // 3. Count permissions by group
        const groupCounts = await prisma.$queryRaw`
            SELECT 
                pg.name AS group_name,
                pg.color,
                COUNT(p.id)::int AS permission_count
            FROM permission_groups pg
            LEFT JOIN permissions p ON p.group_id = pg.id
            GROUP BY pg.id, pg.name, pg.color, pg.sort_order
            ORDER BY pg.sort_order
        `;
        
        console.log('\n📊 Permissions per Group:');
        groupCounts.forEach(g => {
            console.log(`   ${g.group_name.padEnd(30)} ${g.permission_count} permissions`);
        });
        
        // 4. Check ungrouped permissions
        const ungrouped = await prisma.permissions.findMany({
            where: { group_id: null },
            select: { id: true, name: true, resource: true, action: true }
        });
        
        if (ungrouped.length > 0) {
            console.log(`\n⚠️  Ungrouped Permissions: ${ungrouped.length}`);
            ungrouped.forEach(p => {
                console.log(`   - ${p.resource}.${p.action} (${p.name})`);
            });
        } else {
            console.log('\n✅ All permissions are grouped');
        }
        
        // 5. Show permission distribution by resource
        const resourceCounts = await prisma.$queryRaw`
            SELECT 
                resource,
                COUNT(*)::int AS count
            FROM permissions
            GROUP BY resource
            ORDER BY count DESC
        `;
        
        console.log('\n📋 Permissions by Resource:');
        resourceCounts.forEach(r => {
            console.log(`   ${r.resource.padEnd(20)} ${r.count} permissions`);
        });
        
        console.log('\n✅ Check complete!\n');
        
    } catch (error) {
        console.error('❌ Error checking permissions:', error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

checkPermissions()
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
