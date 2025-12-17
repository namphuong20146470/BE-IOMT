// Test script để verify fix cho storeDeviceData
import { PrismaClient } from '@prisma/client';
import socketMQTTClient from './features/mqtt/socket-mqtt-client.js';

const prisma = new PrismaClient();

console.log('\n🧪 TESTING SOCKET-MQTT-CLIENT FIX\n');
console.log('='.repeat(60));

// Listen to events
let messagesReceived = 0;
let messagesStored = 0;
let messagesSkipped = 0;

socketMQTTClient.on('connected', (data) => {
    console.log(`\n✅ Socket connected: ${data.socket.name} (Socket ${data.socket.socket_number})`);
    console.log(`   Device assigned: ${data.socket.device_id ? 'YES ✓' : 'NO ✗'}`);
});

socketMQTTClient.on('data', async (eventData) => {
    messagesReceived++;
    
    const socket = eventData.socket;
    const hasDevice = !!socket.device_id;
    
    console.log(`\n📨 Message #${messagesReceived} received:`);
    console.log(`   Socket: ${socket.name} (Socket ${socket.socket_number})`);
    console.log(`   Device: ${hasDevice ? socket.device_id : '❌ NOT ASSIGNED'}`);
    console.log(`   Topic: ${eventData.topic}`);
    console.log(`   Data:`, JSON.stringify(eventData.data).substring(0, 100));
    
    if (hasDevice) {
        messagesStored++;
        console.log(`   ✅ Should be STORED in database`);
    } else {
        messagesSkipped++;
        console.log(`   ⚠️  SKIPPED - no device assigned`);
    }
});

socketMQTTClient.on('error', (error) => {
    console.error(`\n❌ ERROR:`, error);
});

// Initialize
console.log('\n🚀 Starting MQTT client...\n');
socketMQTTClient.initializeAll()
    .then(async () => {
        console.log('\n✅ MQTT client initialized successfully');
        console.log('\n📊 Waiting for MQTT messages... (Press Ctrl+C to stop)\n');
        
        // Check current socket configuration
        const sockets = await prisma.sockets.findMany({
            where: { is_enabled: true },
            include: {
                device: { select: { serial_number: true } },
                pdu: { select: { name: true } }
            }
        });
        
        console.log('\n📋 ACTIVE SOCKETS CONFIGURATION:');
        console.log('='.repeat(60));
        
        let withDevice = 0;
        let withoutDevice = 0;
        
        sockets.forEach(socket => {
            const hasDevice = !!socket.device_id;
            if (hasDevice) withDevice++;
            else withoutDevice++;
            
            console.log(`\n${hasDevice ? '✅' : '❌'} Socket ${socket.socket_number}: ${socket.name}`);
            console.log(`   PDU: ${socket.pdu?.name || 'N/A'}`);
            console.log(`   Device: ${hasDevice ? socket.device?.serial_number : 'NOT ASSIGNED'}`);
            console.log(`   Topic: ${socket.mqtt_topic_suffix}`);
            console.log(`   Will store data: ${hasDevice ? 'YES ✓' : 'NO ✗ (SKIPPED)'}`);
        });
        
        console.log('\n' + '='.repeat(60));
        console.log(`📊 Summary: ${withDevice} with device, ${withoutDevice} without device`);
        console.log('='.repeat(60) + '\n');
    })
    .catch(error => {
        console.error('\n❌ Failed to initialize:', error);
        process.exit(1);
    });

// Stats every 30 seconds
setInterval(() => {
    console.log(`\n📊 STATS: ${messagesReceived} received | ${messagesStored} stored | ${messagesSkipped} skipped`);
}, 30000);

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down...');
    console.log(`\n📊 FINAL STATS:`);
    console.log(`   Messages received: ${messagesReceived}`);
    console.log(`   Messages stored: ${messagesStored}`);
    console.log(`   Messages skipped: ${messagesSkipped}`);
    
    await prisma.$disconnect();
    process.exit(0);
});
