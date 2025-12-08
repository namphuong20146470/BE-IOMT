import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixBrokerHost() {
    try {
        console.log('🔧 Fixing broker hostname...');
        
        // Fix hostname with trailing space
        const result = await prisma.sockets.updateMany({
            where: {
                mqtt_broker_host: 'broker.hivemq.com ' // with space
            },
            data: {
                mqtt_broker_host: 'broker.hivemq.com' // without space
            }
        });
        
        console.log(`✅ Fixed ${result.count} sockets with incorrect hostname`);
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fixBrokerHost();