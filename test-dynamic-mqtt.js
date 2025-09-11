// Test Dynamic MQTT System
// Run with: node test-dynamic-mqtt.js

import fetch from 'node-fetch';

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3005/actlog/device-processor';

// Sample device IDs (replace with actual UUIDs from your database)
const SAMPLE_DEVICES = [
    '456e7890-e89b-12d3-a456-426614174001', // Temperature sensor
    '567e9012-e89b-12d3-a456-426614174002', // Humidity sensor  
    '678e0123-e89b-12d3-a456-426614174003'  // Pressure sensor
];

async function testDynamicMqttSystem() {
    console.log('🧪 Testing Dynamic MQTT System...\n');

    try {
        // Test 1: Check MQTT Connection Status
        console.log('1️⃣  Testing MQTT Connection Status...');
        const statusResponse = await fetch(`${BASE_URL}/mqtt/status`);
        const statusData = await statusResponse.json();
        console.log('✅ MQTT Status:', JSON.stringify(statusData, null, 2));
        console.log('\n');

        // Test 2: Get Available Data Tables
        console.log('2️⃣  Testing Available Data Tables...');
        const tablesResponse = await fetch(`${BASE_URL}/tables`);
        const tablesData = await tablesResponse.json();
        console.log('✅ Available Tables:', Object.keys(tablesData.tables || {}));
        console.log('\n');

        // Test 3: Simulate Device Data for each device
        for (const deviceId of SAMPLE_DEVICES) {
            console.log(`3️⃣  Testing Device Data Simulation for ${deviceId}...`);
            
            const simulateResponse = await fetch(`${BASE_URL}/device-data/${deviceId}/simulate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    data: {
                        temperature: 23.5 + Math.random() * 10,
                        humidity: 40 + Math.random() * 30,
                        battery: 70 + Math.random() * 30,
                        signal_strength: -30 - Math.random() * 40,
                        timestamp: new Date().toISOString(),
                        test_mode: true
                    }
                })
            });

            if (simulateResponse.ok) {
                const simulateData = await simulateResponse.json();
                console.log('✅ Simulation Result:', simulateData.message);
                console.log('   Device:', simulateData.device?.serial_number || 'Unknown');
            } else {
                const errorData = await simulateResponse.json();
                console.log('❌ Simulation Failed:', errorData.error);
            }
        }
        console.log('\n');

        // Test 4: Get Device Data Stream
        const testDeviceId = SAMPLE_DEVICES[0];
        console.log(`4️⃣  Testing Data Stream for ${testDeviceId}...`);
        const streamResponse = await fetch(`${BASE_URL}/device-data/${testDeviceId}/stream?limit=3`);
        
        if (streamResponse.ok) {
            const streamData = await streamResponse.json();
            console.log('✅ Latest Data Records:', streamData.data?.length || 0);
            if (streamData.data && streamData.data.length > 0) {
                console.log('   Latest Record:', streamData.data[0]);
            }
        } else {
            const errorData = await streamResponse.json();
            console.log('❌ Stream Failed:', errorData.error);
        }
        console.log('\n');

        // Test 5: Get Device Statistics
        console.log(`5️⃣  Testing Device Statistics for ${testDeviceId}...`);
        const statsResponse = await fetch(`${BASE_URL}/device-data/${testDeviceId}/stats?period=24h`);
        
        if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            console.log('✅ Device Statistics:');
            console.log('   Device:', statsData.device?.serial_number || 'Unknown');
            console.log('   Total Records:', statsData.statistics?.total_records || 0);
            console.log('   Period:', statsData.statistics?.period || 'Unknown');
        } else {
            const errorData = await statsResponse.json();
            console.log('❌ Statistics Failed:', errorData.error);
        }
        console.log('\n');

        // Test 6: Get Paginated Device Data
        console.log(`6️⃣  Testing Paginated Device Data for ${testDeviceId}...`);
        const dataResponse = await fetch(`${BASE_URL}/device-data/${testDeviceId}?limit=5&offset=0`);
        
        if (dataResponse.ok) {
            const dataResult = await dataResponse.json();
            console.log('✅ Device Data:');
            console.log('   Records Found:', dataResult.data?.length || 0);
            console.log('   Total Available:', dataResult.pagination?.total || 0);
            console.log('   Has More:', dataResult.pagination?.hasMore || false);
        } else {
            const errorData = await dataResponse.json();
            console.log('❌ Data Retrieval Failed:', errorData.error);
        }
        console.log('\n');

        // Test 7: Refresh MQTT Connections
        console.log('7️⃣  Testing MQTT Connection Refresh...');
        const refreshResponse = await fetch(`${BASE_URL}/mqtt/refresh`, {
            method: 'POST'
        });
        
        if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json();
            console.log('✅ Refresh Result:', refreshData.message);
        } else {
            const errorData = await refreshResponse.json();
            console.log('❌ Refresh Failed:', errorData.error);
        }
        console.log('\n');

        console.log('🎉 All tests completed!');
        
    } catch (error) {
        console.error('❌ Test execution failed:', error.message);
    }
}

// Helper function to test with different data patterns
async function testDifferentDataPatterns() {
    console.log('🔄 Testing Different Data Patterns...\n');

    const testDeviceId = SAMPLE_DEVICES[0];
    
    // Pattern 1: Temperature sensor data
    const tempSensorData = {
        data: {
            temperature: 25.3,
            humidity: 62.1,
            battery: 85,
            signal_strength: -45,
            location: 'Room 101',
            sensor_type: 'DHT22'
        }
    };

    // Pattern 2: Medical device data
    const medicalDeviceData = {
        data: {
            heart_rate: 72,
            blood_pressure_sys: 120,
            blood_pressure_dia: 80,
            oxygen_saturation: 98.2,
            patient_id: 'P123456',
            alert_status: 'normal'
        }
    };

    // Pattern 3: Environmental monitoring data
    const envMonitorData = {
        data: {
            temperature: 22.8,
            humidity: 45.2,
            air_pressure: 1013.25,
            co2_level: 420,
            air_quality_index: 85,
            noise_level: 35.2
        }
    };

    const dataPatterns = [
        { name: 'Temperature Sensor', data: tempSensorData },
        { name: 'Medical Device', data: medicalDeviceData },
        { name: 'Environmental Monitor', data: envMonitorData }
    ];

    for (const pattern of dataPatterns) {
        console.log(`🧪 Testing ${pattern.name} data pattern...`);
        
        const response = await fetch(`${BASE_URL}/device-data/${testDeviceId}/simulate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(pattern.data)
        });

        if (response.ok) {
            const result = await response.json();
            console.log(`✅ ${pattern.name} pattern processed successfully`);
        } else {
            const error = await response.json();
            console.log(`❌ ${pattern.name} pattern failed:`, error.error);
        }
    }

    console.log('\n✅ Data pattern tests completed!');
}

// Run tests
async function runAllTests() {
    await testDynamicMqttSystem();
    console.log('\n' + '='.repeat(60) + '\n');
    await testDifferentDataPatterns();
}

// Start testing
runAllTests().catch(console.error);
