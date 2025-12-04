import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createExtension() {
    try {
        await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`;
        console.log('✅ Extension uuid-ossp created successfully');
    } catch (error) {
        console.error('❌ Error creating extension:', error);
    } finally {
        await prisma.$disconnect();
    }
}

createExtension();