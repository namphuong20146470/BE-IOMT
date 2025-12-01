import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabaseStatus() {
    try {
        console.log('🔍 Checking database status...');
        
        // Check if PDU tables exist
        const pduTableExists = await prisma.$queryRaw`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'power_distribution_units'
            ) as exists
        `;
        
        const outletTableExists = await prisma.$queryRaw`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'outlets'
            ) as exists
        `;
        
        // Check device visibility
        const visibilityStats = await prisma.$queryRaw`
            SELECT 
                visibility,
                COUNT(*) as count
            FROM device 
            GROUP BY visibility
            ORDER BY visibility
        `;
        
        // Check enums
        const enumCheck = await prisma.$queryRaw`
            SELECT 
                typname as enum_name,
                array_agg(enumlabel ORDER BY enumsortorder) as values
            FROM pg_type 
            JOIN pg_enum ON pg_type.oid = pg_enum.enumtypid 
            WHERE typname IN ('outlet_status', 'pdu_type', 'device_visibility')
            GROUP BY typname
            ORDER BY typname
        `;
        
        console.log('📊 Database Status Report:');
        console.log(`   - power_distribution_units table: ${pduTableExists[0].exists ? '✅ Exists' : '❌ Missing'}`);
        console.log(`   - outlets table: ${outletTableExists[0].exists ? '✅ Exists' : '❌ Missing'}`);
        
        console.log('\n📈 Device Visibility Stats:');
        visibilityStats.forEach(stat => {
            console.log(`   - ${stat.visibility}: ${stat.count} devices`);
        });
        
        console.log('\n🔧 Available Enums:');
        enumCheck.forEach(enumInfo => {
            console.log(`   - ${enumInfo.enum_name}: [${enumInfo.values.join(', ')}]`);
        });
        
    } catch (error) {
        console.error('❌ Error checking database:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkDatabaseStatus();