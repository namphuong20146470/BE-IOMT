import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDeviceDataLogs() {
    try {
        console.log('🔍 Checking latest MQTT data received...');
        
        // Check latest device_data_logs
        const latestLogs = await prisma.device_data_logs.findMany({
            orderBy: {
                timestamp: 'desc'
            },
            take: 5,
            include: {
                device: {
                    select: {
                        serial_number: true
                    }
                }
            }
        });
        
        console.log(`📊 Found ${latestLogs.length} latest logs`);
        
        latestLogs.forEach((log, index) => {
            console.log(`\n${index + 1}. Device: ${log.device?.serial_number || 'N/A'}`);
            console.log(`   Timestamp: ${log.timestamp}`);
            console.log(`   Raw MQTT Data:`, log.data_json);
        });
        
        // Check current state for comparison
        console.log('\n🔄 Current device states:');
        const currentStates = await prisma.device_current_state.findMany({
            include: {
                device: {
                    select: {
                        serial_number: true
                    }
                }
            }
        });
        
        currentStates.forEach((state, index) => {
            console.log(`\n${index + 1}. Device: ${state.device?.serial_number}`);
            console.log(`   Voltage: ${state.voltage}`);
            console.log(`   Current: ${state.current}`);
            console.log(`   Power: ${state.power}`);
            console.log(`   Power Factor: ${state.power_factor}`);
            console.log(`   Socket ID: ${state.socket_id}`);
            console.log(`   Updated: ${state.updated_at}`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkDeviceDataLogs();