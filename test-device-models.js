import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDeviceModelsTable() {
    try {
        console.log('Checking device_models table structure...');
        
        // Check if table exists
        const tableExists = await prisma.$queryRaw`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'device_models'
            ) as exists
        `;
        
        console.log('Table exists:', tableExists[0].exists);
        
        if (tableExists[0].exists) {
            // Get column structure
            const columns = await prisma.$queryRaw`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns 
                WHERE table_name = 'device_models' 
                ORDER BY ordinal_position
            `;
            
            console.log('Columns:', columns);
            
            // Try to get a sample row
            const sampleData = await prisma.$queryRaw`
                SELECT * FROM device_models LIMIT 1
            `;
            
            console.log('Sample data:', sampleData);
        }
        
    } catch (error) {
        console.error('Error checking device_models table:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkDeviceModelsTable();