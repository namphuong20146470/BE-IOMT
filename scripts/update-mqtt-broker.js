// scripts/update-mqtt-broker.js - Update MQTT broker from emqx to hivemq
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateMqttBroker() {
    try {
        console.log('🔍 Checking for emqx.broker.com references...');
        
        // Check current broker hosts in database
        const currentBrokers = await prisma.$queryRaw`
            SELECT DISTINCT broker_host, COUNT(*) as count
            FROM device_connectivity 
            WHERE broker_host IS NOT NULL
            GROUP BY broker_host
        `;
        
        console.log('📊 Current MQTT brokers in database:');
        currentBrokers.forEach(broker => {
            console.log(`  - ${broker.broker_host}: ${broker.count} devices`);
        });
        
        // Find devices using emqx.broker.com
        const emqxDevices = await prisma.$queryRaw`
            SELECT id, device_id, mqtt_topic, broker_host, broker_port, ssl_enabled
            FROM device_connectivity 
            WHERE broker_host LIKE '%emqx%'
        `;
        
        if (emqxDevices.length === 0) {
            console.log('✅ No devices found using emqx.broker.com');
            return;
        }
        
        console.log(`\n🔧 Found ${emqxDevices.length} devices using emqx broker:`);
        emqxDevices.forEach(device => {
            console.log(`  - Device: ${device.device_id}`);
            console.log(`    Topic: ${device.mqtt_topic}`);
            console.log(`    Broker: ${device.broker_host}:${device.broker_port}`);
        });
        
        // Update all emqx references to hivemq
        console.log('\n🔄 Updating emqx.broker.com to broker.hivemq.com...');
        
        const updateResult = await prisma.$queryRaw`
            UPDATE device_connectivity 
            SET 
                broker_host = 'broker.hivemq.com',
                updated_at = CURRENT_TIMESTAMP
            WHERE broker_host LIKE '%emqx%'
        `;
        
        console.log(`✅ Updated ${updateResult.count || emqxDevices.length} device configurations`);
        
        // Verify update
        const verifyUpdate = await prisma.$queryRaw`
            SELECT DISTINCT broker_host, COUNT(*) as count
            FROM device_connectivity 
            WHERE broker_host IS NOT NULL
            GROUP BY broker_host
        `;
        
        console.log('\n📊 Updated MQTT brokers in database:');
        verifyUpdate.forEach(broker => {
            console.log(`  - ${broker.broker_host}: ${broker.count} devices`);
        });
        
        console.log('\n✅ MQTT broker update completed successfully!');
        
    } catch (error) {
        console.error('❌ Error updating MQTT broker:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the update
updateMqttBroker();