import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDB() {
    try {
        const userCount = await prisma.users.count();
        console.log('✅ DB Connection OK. Users count:', userCount);
        
        const permissionCount = await prisma.permissions.count();
        console.log('✅ Permissions count:', permissionCount);
        
        await prisma.$disconnect();
        console.log('✅ Test completed');
    } catch (error) {
        console.error('❌ DB Error:', error.message);
        await prisma.$disconnect();
    }
}

testDB();