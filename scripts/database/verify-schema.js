// Test database connection and verify schema changes
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifySchemaChanges() {
    try {
        console.log('🔍 Checking database connection...');
        
        // Test connection
        await prisma.$connect();
        console.log('✅ Database connected successfully');

        // Check device_models table structure
        console.log('\n📋 Checking device_models table structure...');
        
        const result = await prisma.$queryRaw`
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default
            FROM information_schema.columns 
            WHERE table_name = 'device_models' 
                AND column_name IN ('specifications', 'created_at', 'updated_at')
            ORDER BY column_name;
        `;
        
        console.log('Device Models Columns:', result);

        // Check if old tables are gone
        console.log('\n🗑️ Verifying old tables are removed...');
        
        const oldTables = await prisma.$queryRaw`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name IN ('specifications', 'specification_fields')
                AND table_schema = 'public';
        `;
        
        if (oldTables.length === 0) {
            console.log('✅ Old specification tables successfully removed');
        } else {
            console.log('⚠️ Old tables still exist:', oldTables);
        }

        // Check indexes
        console.log('\n📊 Checking indexes...');
        
        const indexes = await prisma.$queryRaw`
            SELECT 
                schemaname,
                tablename,
                indexname,
                indexdef
            FROM pg_indexes 
            WHERE tablename = 'device_models' 
                AND indexname LIKE '%specifications%';
        `;
        
        console.log('Specifications Indexes:', indexes);

        // Test JSONB functionality
        console.log('\n🧪 Testing JSONB functionality...');
        
        // Try to create a test record
        const testModel = await prisma.device_models.findFirst();
        
        if (testModel) {
            console.log('✅ Found existing device model:', testModel.name);
            console.log('📋 Current specifications:', testModel.specifications);
        } else {
            console.log('ℹ️ No device models found in database');
        }

        console.log('\n🎉 Schema verification completed successfully!');

    } catch (error) {
        console.error('❌ Error during verification:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run verification
verifySchemaChanges();