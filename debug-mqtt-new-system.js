// Script để debug lỗi MQTT hệ thống mới
import socketMQTTClient from './features/mqtt/socket-mqtt-client.js';

console.log('\n🔍 DEBUGGING MQTT HỆ THỐNG MỚI\n');
console.log('='.repeat(60));

// Listen to all events
socketMQTTClient.on('connected', (data) => {
    console.log(`✅ MQTT Connected: Socket ${data.socketId}`);
});

socketMQTTClient.on('message', (data) => {
    console.log(`📨 MQTT Message received:`);
    console.log(`   Socket: ${data.socketId}`);
    console.log(`   Topic: ${data.topic}`);
    console.log(`   Data:`, JSON.stringify(data.data).substring(0, 100));
});

socketMQTTClient.on('data-stored', (data) => {
    console.log(`💾 Data stored successfully for socket ${data.socketId}`);
});

socketMQTTClient.on('error', (error) => {
    console.error(`❌ ERROR:`, error);
});

socketMQTTClient.on('reconnecting', (data) => {
    console.log(`🔄 Reconnecting socket ${data.socketId}...`);
});

// Initialize
console.log('\n🚀 Initializing MQTT connections...\n');
socketMQTTClient.initializeAll()
    .then(() => {
        console.log('\n✅ Initialization complete. Listening for messages...\n');
    })
    .catch(error => {
        console.error('\n❌ Initialization failed:', error);
    });

// Keep alive
setInterval(() => {
    console.log(`\n⏰ Still running... ${new Date().toLocaleTimeString()}`);
}, 60000); // Every minute
