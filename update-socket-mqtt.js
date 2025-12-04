import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateSocketMqttConfig() {
    try {
        console.log('🔧 Updating socket MQTT configuration...');
        
        // Update socket2 với MQTT broker config
        const result = await prisma.sockets.update({
            where: {
                id: 'b3f41e73-7bc8-48a2-8398-d12bd3eb5dcb' // Socket 2 ID từ kết quả trước
            },
            data: {
                mqtt_broker_host: 'broker.hivemq.com',
                mqtt_broker_port: 1883,
                is_enabled: true,
                mqtt_credentials: JSON.stringify({
                    username: null,
                    password: null
                }),
                mqtt_config: JSON.stringify({
                    qos: 1,
                    retain: false,
                    keepalive: 60,
                    clean_session: true
                })
            }
        });
        
        console.log('✅ Socket MQTT config updated:', {
            id: result.id,
            socket_number: result.socket_number,
            mqtt_broker_host: result.mqtt_broker_host,
            mqtt_broker_port: result.mqtt_broker_port,
            is_enabled: result.is_enabled
        });
        
    } catch (error) {
        console.error('❌ Error updating socket config:', error);
    } finally {
        await prisma.$disconnect();
    }
}

updateSocketMqttConfig();