import pkg from 'pg';
const { Client } = pkg;

async function bootstrap() {
    const client = new Client({
        host: 'localhost',
        port: 5433,
        database: 'dev_iomt',
        user: 'postgres',
        password: 'Hai0947976244'
    });

    try {
        await client.connect();
        console.log('🔄 Starting bootstrap...');
        
        const userId = '231ee806-b1d2-44b3-9e51-69d73771ce7e';
        const orgId = '7e983a73-c2b2-475d-a1dd-85b722ab4581';
        const deptId = '059bd5b2-c0f5-4356-bb36-013619551b41';
        
        // Get or create Super Admin role
        let roleResult = await client.query(`
            SELECT id FROM roles WHERE name = 'Super Admin' LIMIT 1
        `);

        let superAdminRoleId;
        if (roleResult.rows.length === 0) {
            const createRoleResult = await client.query(`
                INSERT INTO roles (
                    name, description, is_system_role, is_custom, 
                    color, icon, sort_order, created_by, is_active
                ) VALUES (
                    'Super Admin', 
                    'Full system administrator with all permissions', 
                    true, false, '#DC2626', 'crown', 1, 
                    $1, true
                ) RETURNING id
            `, [userId]);
            superAdminRoleId = createRoleResult.rows[0].id;
            console.log('✅ Created Super Admin role');
        } else {
            superAdminRoleId = roleResult.rows[0].id;
            console.log('✅ Super Admin role exists');
        }

        // Check if user already has this role
        const existingAssignment = await client.query(`
            SELECT id FROM user_roles 
            WHERE user_id = $1 AND role_id = $2 AND organization_id = $3
        `, [userId, superAdminRoleId, orgId]);

        if (existingAssignment.rows.length === 0) {
            await client.query(`
                INSERT INTO user_roles (
                    user_id, role_id, organization_id, department_id,
                    assigned_by, assigned_at, is_active, notes
                ) VALUES (
                    $1, $2, $3, $4, $5, CURRENT_TIMESTAMP, true,
                    'Bootstrap admin - auto-assigned'
                )
            `, [userId, superAdminRoleId, orgId, deptId, userId]);
            console.log('✅ Assigned Super Admin role');
        } else {
            console.log('✅ User already has Super Admin role');
        }

        // Assign all permissions
        const permissionsResult = await client.query('SELECT id FROM permissions');
        console.log(`📋 Found ${permissionsResult.rows.length} permissions`);
        
        for (const permission of permissionsResult.rows) {
            await client.query(`
                INSERT INTO role_permissions (role_id, permission_id)
                VALUES ($1, $2)
                ON CONFLICT (role_id, permission_id) DO NOTHING
            `, [superAdminRoleId, permission.id]);
        }
        console.log('✅ Assigned all permissions to Super Admin role');

        // Clear cache (if table exists)
        try {
            await client.query('DELETE FROM user_permission_cache WHERE user_id = $1', [userId]);
            console.log('✅ Cleared permission cache');
        } catch (error) {
            console.log('ℹ️ Permission cache table not found (skipped)');
        }

        // Verify assignment
        const verifyResult = await client.query(`
            SELECT 
                u.username, u.full_name,
                r.name as role_name,
                COUNT(rp.permission_id) as permission_count
            FROM user_roles ur
            JOIN users u ON ur.user_id = u.id
            JOIN roles r ON ur.role_id = r.id
            LEFT JOIN role_permissions rp ON r.id = rp.role_id
            WHERE u.id = $1
            GROUP BY u.username, u.full_name, r.name
        `, [userId]);

        console.log('🎉 Bootstrap completed successfully!');
        if (verifyResult.rows.length > 0) {
            const result = verifyResult.rows[0];
            console.log(`👤 User: ${result.username} (${result.full_name})`);
            console.log(`🔑 Role: ${result.role_name}`);
            console.log(`📋 Permissions: ${result.permission_count}`);
        }
        
    } catch (error) {
        console.error('❌ Bootstrap error:', error);
    } finally {
        await client.end();
    }
}

bootstrap();