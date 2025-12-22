/**
 * Test WebSocket/Socket.IO Connection
 * Kiểm tra kết nối từ client tới server
 */

import { io } from 'socket.io-client';

const ENVIRONMENTS = {
    local: {
        url: 'http://localhost:3030',
        transport: 'ws://',
        secure: false
    },
    production: {
        url: 'https://iomt.hoangphucthanh.vn',
        transport: 'wss://',
        secure: true
    }
};

function testSocketConnection(env) {
    const config = ENVIRONMENTS[env];
    
    console.log(`\n🧪 Testing ${env.toUpperCase()} connection...`);
    console.log(`   URL: ${config.url}`);
    console.log(`   Transport: ${config.transport}`);
    console.log(`   Secure: ${config.secure ? 'Yes (WSS)' : 'No (WS)'}`);
    
    const socket = io(config.url, {
        transports: ['websocket', 'polling'],
        secure: config.secure,
        rejectUnauthorized: false, // For self-signed certs in dev
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
        timeout: 10000
    });

    socket.on('connect', () => {
        console.log(`   ✅ Connected successfully!`);
        console.log(`   Socket ID: ${socket.id}`);
        console.log(`   Transport: ${socket.io.engine.transport.name}`);
        
        // Test emit
        socket.emit('test-message', { test: true, timestamp: new Date() });
        
        setTimeout(() => {
            socket.disconnect();
            console.log(`   🔌 Disconnected`);
        }, 2000);
    });

    socket.on('connect_error', (error) => {
        console.error(`   ❌ Connection Error: ${error.message}`);
        console.error(`   Reason: ${error.description || 'Unknown'}`);
        
        // Detailed error info
        if (error.type) console.error(`   Type: ${error.type}`);
        if (error.code) console.error(`   Code: ${error.code}`);
    });

    socket.on('disconnect', (reason) => {
        console.log(`   ⚠️  Disconnected: ${reason}`);
    });

    socket.on('error', (error) => {
        console.error(`   ❌ Socket Error:`, error);
    });
}

// Run tests
const testEnv = process.argv[2] || 'local';

if (!ENVIRONMENTS[testEnv]) {
    console.error('❌ Invalid environment. Use: local or production');
    console.log('   Example: node scripts/test-websocket-connection.js production');
    process.exit(1);
}

console.log('🔍 WebSocket Connection Test');
console.log('=' .repeat(50));

testSocketConnection(testEnv);

// Keep process alive for async operations
setTimeout(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
}, 15000);
