import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function runDeviceVisibilityMigration() {
    try {
        console.log('🚀 Starting Device Visibility migration...');
        
        // Read the migration SQL file
        const migrationPath = path.join(__dirname, '../database-migrations/update_device_visibility_default.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // Execute the migration SQL
        console.log('📝 Executing device visibility migration...');
        
        // Step 1: Update default value
        console.log('⚡ Step 1: Updating default visibility to private');
        await prisma.$executeRaw`ALTER TABLE device ALTER COLUMN visibility SET DEFAULT 'private'`;
        
        // Step 2: Update devices without department to private
        console.log('⚡ Step 2: Updating devices without department to private visibility');
        const updateResult1 = await prisma.$executeRaw`
            UPDATE device 
            SET visibility = 'private'::device_visibility
            WHERE department_id IS NULL 
              AND visibility = 'department'::device_visibility
        `;
        console.log(`   Updated ${updateResult1} devices without department to private`);
        
        // Step 3: Keep devices with department as department visibility
        console.log('⚡ Step 3: Ensuring devices with department have department visibility');
        const updateResult2 = await prisma.$executeRaw`
            UPDATE device 
            SET visibility = 'department'::device_visibility
            WHERE department_id IS NOT NULL 
              AND visibility = 'private'::device_visibility
        `;
        console.log(`   Updated ${updateResult2} devices with department to department visibility`);
        
        console.log('✅ Device Visibility migration completed successfully!');
        
        // Verify the migration
        const visibilityStats = await prisma.$queryRaw`
            SELECT 
                department_id IS NULL as no_department,
                visibility,
                COUNT(*) as count
            FROM device 
            GROUP BY department_id IS NULL, visibility
            ORDER BY no_department, visibility
        `;
        
        console.log('🔍 Migration verification:');
        visibilityStats.forEach(stat => {
            console.log(`   - No Department: ${stat.no_department}, Visibility: ${stat.visibility}, Count: ${stat.count}`);
        });
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the migration
runDeviceVisibilityMigration()
    .then(() => {
        console.log('🎉 Device visibility migration completed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Migration failed:', error);
        process.exit(1);
    });