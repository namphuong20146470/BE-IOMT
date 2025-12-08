import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDeviceCurrentState() {
    try {
        console.log('🔍 Checking device_data_latest table...');
        
        const states = await prisma.device_data_latest.findMany({
            include: {
                device: {
                    select: { 
                        serial_number: true, 
                        asset_tag: true,
                        id: true
                    }
                }
            },
            orderBy: {
                updated_at: 'desc'
            }
        });
        
        console.log(`📊 Found ${states.length} device states`);
        
        if (states.length > 0) {
            console.log('\n📋 Latest device states:');
            states.forEach((state, index) => {
                console.log(`${index + 1}. Device: ${state.device?.serial_number || 'N/A'}`);
                console.log(`   Power: ${state.power}W`);
                console.log(`   Voltage: ${state.voltage}V`);
                console.log(`   Current: ${state.current}A`);
                console.log(`   Power Factor: ${state.power_factor}`);
                console.log(`   Last Updated: ${state.updated_at}`);
                console.log(`   Connected: ${state.is_connected}`);
                console.log('---');
            });
        } else {
            console.log('❌ No device states found - MQTT data may not be saving');
        }
        
    } catch (error) {
        console.error('❌ Error checking device states:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkDeviceCurrentState();