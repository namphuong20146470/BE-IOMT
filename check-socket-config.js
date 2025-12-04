import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSocketConfiguration() {
    try {
        console.log('🔍 Checking socket and PDU configuration...');
        
        // Check PDUs and their MQTT topics
        const pdus = await prisma.power_distribution_units.findMany({
            include: {
                sockets: {
                    include: {
                        device: {
                            select: {
                                id: true,
                                serial_number: true,
                                status: true
                            }
                        }
                    }
                }
            }
        });
        
        console.log(`📊 Found ${pdus.length} PDUs`);
        
        pdus.forEach(pdu => {
            console.log(`\n🏭 PDU: ${pdu.name} (${pdu.code})`);
            console.log(`   MQTT Base Topic: ${pdu.mqtt_base_topic}`);
            console.log(`   Total Sockets: ${pdu.total_sockets}`);
            
            pdu.sockets.forEach(socket => {
                const fullTopic = `${pdu.mqtt_base_topic}/${socket.mqtt_topic_suffix}`;
                console.log(`   🔌 Socket ${socket.socket_number}: ${fullTopic}`);
                
                if (socket.device) {
                    console.log(`      📱 Device: ${socket.device.serial_number} (${socket.device.status})`);
                    console.log(`      📱 Device ID: ${socket.device.id}`);
                } else {
                    console.log(`      📱 Device: Not assigned`);
                }
            });
        });
        
        // Check if the specific topic matches
        console.log('\n🎯 Checking topic "hopt/tang3/pkt/socket2":');
        const matchingSockets = await prisma.$queryRaw`
            SELECT 
                s.id,
                s.socket_number,
                s.mqtt_topic_suffix,
                p.mqtt_base_topic,
                CONCAT(p.mqtt_base_topic, '/', s.mqtt_topic_suffix) as full_topic,
                s.device_id,
                d.serial_number
            FROM sockets s
            JOIN power_distribution_units p ON s.pdu_id = p.id  
            LEFT JOIN device d ON s.device_id = d.id
            WHERE CONCAT(p.mqtt_base_topic, '/', s.mqtt_topic_suffix) = 'hopt/tang3/pkt/socket2'
        `;
        
        if (matchingSockets.length > 0) {
            console.log('✅ Found matching socket:');
            console.log(matchingSockets[0]);
        } else {
            console.log('❌ No socket found for topic "hopt/tang3/pkt/socket2"');
            console.log('💡 Need to update PDU mqtt_base_topic or socket mqtt_topic_suffix');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkSocketConfiguration();