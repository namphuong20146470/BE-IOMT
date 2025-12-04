// scripts/check-mqtt-configuration.js
import { PrismaClient } from '@prisma/client';
import mqtt from 'mqtt';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

/**
 * Check MQTT Configuration Status
 */
async function checkMQTTConfiguration() {
    try {
        console.log('🔍 Checking MQTT Configuration...\n');
        
        // 1. Check Environment Variables
        console.log('📋 Environment Configuration:');
        console.log(`   MQTT_HOST: ${process.env.MQTT_HOST || 'NOT SET'}`);
        console.log(`   MQTT_PORT: ${process.env.MQTT_PORT || 'NOT SET'}`);
        console.log(`   MQTT_USERNAME: ${process.env.MQTT_USERNAME || 'NOT SET'}`);
        console.log(`   MQTT_PASSWORD: ${process.env.MQTT_PASSWORD ? '[SET]' : 'NOT SET'}`);
        
        // 2. Check Required Configuration from Document
        console.log('\n📋 Required Configuration (From Document):');
        const requiredConfig = {
            host: 'broker.hivemq.com',
            tcp_port: 1883,
            websocket_port: 8000,
            tls_tcp_port: 8883,
            tls_websocket_port: 8884,
            protocol: 'MQTT v3.1.1',
            qos: 0,
            retain: false,
            payload: 'JSON'
        };
        
        Object.entries(requiredConfig).forEach(([key, value]) => {
            console.log(`   ${key}: ${value}`);
        });
        
        // 3. Compare Current vs Required
        console.log('\n🔍 Configuration Comparison:');
        const currentHost = process.env.MQTT_HOST;
        const currentPort = process.env.MQTT_PORT;
        
        console.log(`   ✅ Host: ${currentHost} ${currentHost === requiredConfig.host ? '(CORRECT)' : '(MISMATCH - should be ' + requiredConfig.host + ')'}`);
        console.log(`   ✅ Port: ${currentPort} ${currentPort == requiredConfig.tcp_port ? '(CORRECT)' : '(MISMATCH - should be ' + requiredConfig.tcp_port + ')'}`);
        
        // 4. Test MQTT Connection
        console.log('\n🧪 Testing MQTT Connection...');
        
        try {
            const testClient = mqtt.connect({
                host: currentHost || requiredConfig.host,
                port: parseInt(currentPort) || requiredConfig.tcp_port,
                protocol: 'mqtt',
                keepalive: 60,
                reconnectPeriod: 1000,
                connectTimeout: 5000
            });
            
            await new Promise((resolve, reject) => {
                testClient.on('connect', () => {
                    console.log('   ✅ MQTT Connection: SUCCESS');
                    testClient.end();
                    resolve();
                });
                
                testClient.on('error', (error) => {
                    console.log(`   ❌ MQTT Connection: FAILED - ${error.message}`);
                    testClient.end();
                    reject(error);
                });
                
                // Timeout after 10 seconds
                setTimeout(() => {
                    console.log('   ❌ MQTT Connection: TIMEOUT');
                    testClient.end();
                    reject(new Error('Connection timeout'));
                }, 10000);
            });
            
        } catch (error) {
            console.log(`   ❌ MQTT Connection Test Failed: ${error.message}`);
        }
        
        // 5. Check Database MQTT Configuration
        console.log('\n💾 Database MQTT Configuration:');
        
        // Check PDU mqtt_base_topic
        const pdus = await prisma.power_distribution_units.findMany({
            select: {
                name: true,
                mqtt_base_topic: true
            }
        });
        
        console.log(`   PDUs with MQTT configuration: ${pdus.length}`);
        pdus.forEach(pdu => {
            console.log(`     ${pdu.name}: ${pdu.mqtt_base_topic || 'NOT SET'}`);
        });
        
        // Check socket mqtt configuration
        const sockets = await prisma.sockets.findMany({
            select: {
                socket_number: true,
                mqtt_topic_suffix: true,
                mqtt_broker_host: true,
                mqtt_broker_port: true,
                pdu: {
                    select: { name: true, mqtt_base_topic: true }
                }
            },
            take: 5
        });
        
        console.log(`\n   Sample Sockets MQTT configuration (${sockets.length} shown):`);
        sockets.forEach(socket => {
            const fullTopic = socket.pdu.mqtt_base_topic && socket.mqtt_topic_suffix 
                ? `${socket.pdu.mqtt_base_topic}/${socket.mqtt_topic_suffix}`
                : 'INCOMPLETE';
            console.log(`     Socket ${socket.socket_number}: ${fullTopic}`);
            console.log(`       Broker: ${socket.mqtt_broker_host || 'NOT SET'}:${socket.mqtt_broker_port || 'NOT SET'}`);
        });
        
        // 6. Check MQTT Service Files
        console.log('\n📁 MQTT Service Files Status:');
        const serviceFiles = [
            'features/devices/services/mqttTopicManager.js',
            'features/devices/services/mqttService.js'
        ];
        
        for (const file of serviceFiles) {
            try {
                const { stat } = await import('fs/promises');
                await stat(file);
                console.log(`   ✅ ${file}: EXISTS`);
            } catch {
                console.log(`   ❌ ${file}: NOT FOUND`);
            }
        }
        
        // 7. Generate Recommendations
        console.log('\n📋 Configuration Status Summary:');
        
        const issues = [];
        const fixes = [];
        
        if (currentHost !== requiredConfig.host) {
            issues.push('MQTT Host mismatch');
            fixes.push(`Update .env: MQTT_HOST=${requiredConfig.host}`);
        }
        
        if (currentPort != requiredConfig.tcp_port) {
            issues.push('MQTT Port mismatch');  
            fixes.push(`Update .env: MQTT_PORT=${requiredConfig.tcp_port}`);
        }
        
        const pduWithoutTopic = pdus.filter(p => !p.mqtt_base_topic);
        if (pduWithoutTopic.length > 0) {
            issues.push(`${pduWithoutTopic.length} PDU(s) missing mqtt_base_topic`);
            fixes.push('Update PDUs with mqtt_base_topic using update script');
        }
        
        if (issues.length === 0) {
            console.log('   ✅ All MQTT configuration looks correct!');
            console.log('   🚀 Ready for IoT device integration');
        } else {
            console.log('   ⚠️ Issues found:');
            issues.forEach(issue => console.log(`     - ${issue}`));
            console.log('\n   🔧 Recommended fixes:');
            fixes.forEach(fix => console.log(`     - ${fix}`));
        }
        
    } catch (error) {
        console.error('❌ Error checking MQTT configuration:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkMQTTConfiguration();