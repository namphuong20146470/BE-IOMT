import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUsers() {
    const users = await prisma.users.findMany({
        select: { 
            id: true, 
            email: true, 
            full_name: true,
            username: true 
        }
    });
    
    console.log('Existing users:');
    users.forEach(user => {
        console.log(`- ${user.full_name} (${user.email}) - ${user.username}`);
    });
    
    await prisma.$disconnect();
}

checkUsers();