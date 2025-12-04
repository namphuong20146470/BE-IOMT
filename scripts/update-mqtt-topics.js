// scripts/update-mqtt-topics.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateMQTTTopics() {
    try {
        console.log('🔧 Updating MQTT topic configuration...\n');
        
        // Find PDU first
        const pdu = await prisma.power_distribution_units.findFirst({
            where: { name: 'PDU-Floor-1' }
        });
        
        if (!pdu) {
            throw new Error('PDU-Floor-1 not found');
        }
        
        // Update PDU with mqtt_base_topic
        const updatedPDU = await prisma.power_distribution_units.update({
            where: { id: pdu.id },
            data: {
                mqtt_base_topic: 'hopt/tang3/pkt'
            },
            include: {
                sockets: {
                    select: {
                        id: true,
                        socket_number: true,
                        mqtt_topic_suffix: true
                    },
                    orderBy: { socket_number: 'asc' }
                }
            }
        });
        
        console.log('✅ Updated PDU mqtt_base_topic:', updatedPDU.mqtt_base_topic);
        
        // Show complete topic structure
        console.log('\n📊 Complete MQTT Topic Structure:');
        console.log(`   Base Topic: ${updatedPDU.mqtt_base_topic}`);
        console.log('   Socket Topics:');
        
        updatedPDU.sockets.forEach(socket => {
            const fullTopic = `${updatedPDU.mqtt_base_topic}/${socket.mqtt_topic_suffix}`;
            console.log(`     Socket ${socket.socket_number}: ${fullTopic}`);
        });
        
        // Test topic generation function
        console.log('\n🧪 Testing topic generation function:');
        
        function generateMQTTTopic(pdu, socket) {
            if (!pdu.mqtt_base_topic || !socket.mqtt_topic_suffix) {
                return null;
            }
            return `${pdu.mqtt_base_topic}/${socket.mqtt_topic_suffix}`;
        }
        
        updatedPDU.sockets.slice(0, 4).forEach(socket => {
            const topic = generateMQTTTopic(updatedPDU, socket);
            console.log(`   generateMQTTTopic(PDU, Socket${socket.socket_number}) → ${topic}`);
        });
        
        console.log('\n✅ MQTT topics are now properly configured!');
        console.log('📡 Ready for IoT device integration with topics:');
        updatedPDU.sockets.slice(0, 4).forEach(socket => {
            console.log(`   ${updatedPDU.mqtt_base_topic}/${socket.mqtt_topic_suffix}`);
        });
        
    } catch (error) {
        console.error('❌ Error updating MQTT topics:', error);
    } finally {
        await prisma.$disconnect();
    }
}

updateMQTTTopics();