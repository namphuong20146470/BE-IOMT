// scripts/check-mqtt-topics.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkMQTTTopics() {
    try {
        console.log('🔍 Checking MQTT topic configuration...\n');
        
        // Get PDUs with their mqtt_base_topic
        const pdus = await prisma.power_distribution_units.findMany({
            select: {
                id: true,
                name: true,
                mqtt_base_topic: true,
                sockets: {
                    select: {
                        id: true,
                        socket_number: true,
                        name: true,
                        mqtt_topic_suffix: true
                    },
                    orderBy: { socket_number: 'asc' }
                }
            }
        });
        
        console.log(`Found ${pdus.length} PDU(s):`);
        
        pdus.forEach((pdu, index) => {
            console.log(`\n📊 PDU ${index + 1}: ${pdu.name}`);
            console.log(`   Base Topic: ${pdu.mqtt_base_topic || 'NOT SET'}`);
            
            if (pdu.sockets.length > 0) {
                console.log(`   Sockets (${pdu.sockets.length}):`);
                
                pdu.sockets.forEach(socket => {
                    const fullTopic = pdu.mqtt_base_topic && socket.mqtt_topic_suffix 
                        ? `${pdu.mqtt_base_topic}/${socket.mqtt_topic_suffix}`
                        : 'INCOMPLETE';
                    
                    console.log(`     Socket ${socket.socket_number}: ${socket.mqtt_topic_suffix || 'NOT SET'}`);
                    console.log(`     → Full Topic: ${fullTopic}`);
                });
            } else {
                console.log('   No sockets found');
            }
        });
        
        // Show expected vs actual
        console.log('\n📋 Expected MQTT Topics (based on documentation):');
        console.log('   Base Topic: hopt/tang3/pkt');
        console.log('   Socket Topics:');
        console.log('     - hopt/tang3/pkt/socket1');
        console.log('     - hopt/tang3/pkt/socket2'); 
        console.log('     - hopt/tang3/pkt/socket3');
        console.log('     - hopt/tang3/pkt/socket4');
        
    } catch (error) {
        console.error('❌ Error checking MQTT topics:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkMQTTTopics();