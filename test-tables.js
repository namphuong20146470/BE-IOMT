import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTableStructure() {
    try {
        console.log('Checking all tables...');
        
        // Check what tables exist
        const tables = await prisma.$queryRaw`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `;
        
        console.log('All tables:', tables.map(t => t.table_name));
        
        // Check if there's a manufacturers table
        const manufacturerTable = await prisma.$queryRaw`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'manufacturers'
            ) as exists
        `;
        
        console.log('Manufacturers table exists:', manufacturerTable[0].exists);
        
        if (manufacturerTable[0].exists) {
            const manufacturerColumns = await prisma.$queryRaw`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'manufacturers' 
                ORDER BY ordinal_position
            `;
            console.log('Manufacturers columns:', manufacturerColumns);
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkTableStructure();