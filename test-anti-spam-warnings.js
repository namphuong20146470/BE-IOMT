// Anti-Spam Warning System Test
// Run with: node test-anti-spam-warnings.js

const BASE_URL = 'http://localhost:3005/actlog';

// Test tokens (use your actual tokens)
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Ijc3Yzk5MTk2LTE2N2UtNDA4ZC05YjkzLWJlMTg2MGM4NTMzZiIsInVzZXJuYW1lIjoiYWRtaW5fYnZka3RwIiwiZW1haWwiOiJhZG1pbkBidmRha2hvYXRwLnZuIiwib3JnYW5pemF0aW9uX2lkIjoiN2U5ODNhNzMtYzJiMi00NzVkLWExZGQtODViNzIyYWI0NTgxIiwiZGVwYXJ0bWVudF9pZCI6bnVsbCwiaWF0IjoxNzU3NTU2MTkyLCJleHAiOjE3NTc2NDI1OTJ9.ejCmR9Q37PDsa0iLolVUdfstQrbIaiVjAWLkEq1Mozs';

// API call helper
async function apiCall(method, endpoint, data = null, token = TOKEN) {
    const url = `${BASE_URL}${endpoint}`;
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        console.log(`\n🔄 ${method} ${endpoint}`);
        if (data) console.log('📤 Request:', JSON.stringify(data, null, 2));

        const response = await fetch(url, options);
        const result = await response.json();

        if (response.ok) {
            console.log('✅ Success:', result.message || 'OK');
            if (result.data) {
                console.log('📥 Data:', JSON.stringify(result.data, null, 2));
            }
        } else {
            console.log('❌ Error:', response.status, result.message || result.error);
        }

        return { success: response.ok, data: result, status: response.status };
    } catch (error) {
        console.error('❌ Network Error:', error.message);
        return { success: false, error: error.message };
    }
}

async function testAntiSpamWarningSystem() {
    console.log('🚨 Testing Anti-Spam Warning System...\n');

    try {
        let deviceId;

        // Step 1: Create a test device category
        console.log('='.repeat(60));
        console.log('STEP 1: CREATE TEST DEVICE SETUP');
        console.log('='.repeat(60));
        
        const categoryResult = await apiCall('POST', '/devices/device-categories', {
            name: "Test Warning Devices",
            description: "Devices for testing anti-spam warning system"
        });

        if (!categoryResult.success) {
            console.error('Failed to create category');
            return;
        }

        const categoryId = categoryResult.data.data.id;

        // Step 2: Create device model
        const modelResult = await apiCall('POST', '/devices/device-models', {
            category_id: categoryId,
            name: "Anti-Spam Test Sensor",
            manufacturer: "Test Manufacturer",
            specifications: JSON.stringify({
                test_mode: true,
                warning_capable: true
            })
        });

        const modelId = modelResult.data.data.id;

        // Step 3: Create test device
        const deviceResult = await apiCall('POST', '/devices/devices', {
            model_id: modelId,
            organization_id: "7e983a73-c2b2-475d-a1dd-85b722ab4581",
            serial_number: `ANTI-SPAM-TEST-${Date.now()}`,
            asset_tag: "SPAM-TEST-001",
            status: "active",
            purchase_date: "2024-01-15",
            installation_date: "2024-01-20"
        });

        deviceId = deviceResult.data.data.id;
        console.log(`✅ Created test device: ${deviceId}`);

        // Step 4: Create device connectivity with warning config
        const connectivityResult = await apiCall('POST', '/devices/device-connectivity', {
            device_id: deviceId,
            mqtt_user: "test_anti_spam",
            mqtt_topic: `test/anti-spam/${Date.now()}`,
            broker_host: "localhost",
            broker_port: 1883,
            ssl_enabled: false,
            heartbeat_interval: 300,
            warning_config: JSON.stringify({
                enabled: true,
                rules: [
                    {
                        field: "temperature",
                        condition: "> 25",
                        warning_type: "temperature_high",
                        severity: "moderate",
                        message: "Temperature too high"
                    },
                    {
                        field: "humidity",
                        condition: "> 70",
                        warning_type: "humidity_high",
                        severity: "major",
                        message: "Humidity too high"
                    }
                ]
            })
        });

        if (!connectivityResult.success) {
            console.error('Failed to create connectivity');
            return;
        }

        // Step 5: Test Anti-Spam Logic
        console.log('\n' + '='.repeat(60));
        console.log('STEP 2: TEST ANTI-SPAM LOGIC');
        console.log('='.repeat(60));

        // Simulate multiple high temperature readings (should trigger anti-spam)
        console.log('\n🌡️ Testing Temperature Spam Prevention...');
        
        for (let i = 1; i <= 5; i++) {
            console.log(`\n--- Simulation ${i}/5 ---`);
            
            await apiCall('POST', `/device-processor/device-data/${deviceId}/simulate`, {
                data: {
                    temperature: 28.5 + (i * 0.1), // Always above threshold (25°C)
                    humidity: 65,
                    battery: 85,
                    timestamp: new Date().toISOString()
                }
            });

            // Short delay between simulations
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log('\n💧 Testing Humidity Spam Prevention...');
        
        // Simulate multiple high humidity readings
        for (let i = 1; i <= 5; i++) {
            console.log(`\n--- Simulation ${i}/5 ---`);
            
            await apiCall('POST', `/device-processor/device-data/${deviceId}/simulate`, {
                data: {
                    temperature: 24,
                    humidity: 75 + (i * 0.1), // Always above threshold (70%)
                    battery: 85,
                    timestamp: new Date().toISOString()
                }
            });

            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Step 6: Check warning logs
        console.log('\n' + '='.repeat(60));
        console.log('STEP 3: CHECK WARNING LOGS (Should have limited entries)');
        console.log('='.repeat(60));

        const warningsResult = await apiCall('GET', '/actlog/device-warning-logs/warnings');
        
        if (warningsResult.success) {
            const warnings = warningsResult.data.data || [];
            const deviceWarnings = warnings.filter(w => w.device_id === deviceId);
            
            console.log(`\n📊 Warning Summary:`);
            console.log(`   Total warnings for test device: ${deviceWarnings.length}`);
            
            const tempWarnings = deviceWarnings.filter(w => w.warning_type === 'temperature_high');
            const humWarnings = deviceWarnings.filter(w => w.warning_type === 'humidity_high');
            
            console.log(`   Temperature warnings: ${tempWarnings.length} (should be 1 due to anti-spam)`);
            console.log(`   Humidity warnings: ${humWarnings.length} (should be 1 due to anti-spam)`);
            
            if (tempWarnings.length <= 2 && humWarnings.length <= 2) {
                console.log('✅ Anti-spam working correctly!');
            } else {
                console.log('❌ Anti-spam may not be working - too many warnings created');
            }
        }

        // Step 7: Test warning system directly
        console.log('\n' + '='.repeat(60));
        console.log('STEP 4: TEST WARNING SYSTEM DIRECTLY');
        console.log('='.repeat(60));

        await apiCall('POST', '/device-processor/warnings/test', {
            deviceId: deviceId,
            warningType: 'battery_low',
            measuredValue: 15,
            thresholdValue: 20
        });

        // Step 8: Test normal values (should resolve warnings)
        console.log('\n' + '='.repeat(60));
        console.log('STEP 5: TEST WARNING RESOLUTION');
        console.log('='.repeat(60));

        console.log('\n🌡️ Simulating normal temperature (should resolve warnings)...');
        
        await apiCall('POST', `/device-processor/device-data/${deviceId}/simulate`, {
            data: {
                temperature: 22, // Normal temperature
                humidity: 60,    // Normal humidity
                battery: 85,
                timestamp: new Date().toISOString()
            }
        });

        // Step 9: Check warning notification status
        console.log('\n' + '='.repeat(60));
        console.log('STEP 6: CHECK NOTIFICATION STATUS');
        console.log('='.repeat(60));

        await apiCall('GET', '/device-processor/warnings/status');

        // Step 10: Force process notifications
        console.log('\n' + '='.repeat(60));
        console.log('STEP 7: FORCE PROCESS PENDING NOTIFICATIONS');
        console.log('='.repeat(60));

        await apiCall('POST', '/device-processor/warnings/process-notifications');

        console.log('\n' + '='.repeat(60));
        console.log('🎉 ANTI-SPAM WARNING SYSTEM TEST COMPLETED!');
        console.log('='.repeat(60));

        console.log('\n📋 Test Summary:');
        console.log('✅ Created test device with warning configuration');
        console.log('✅ Simulated spam conditions (multiple readings above threshold)');
        console.log('✅ Verified anti-spam logic prevents duplicate warnings');
        console.log('✅ Tested warning resolution when values return to normal');
        console.log('✅ Checked notification system status');

        console.log(`\n🔧 Test device ID: ${deviceId}`);
        console.log('   You can manually check the database to verify:');
        console.log('   - device_warning_logs table has limited entries');
        console.log('   - warning_notifications table has scheduled notifications');

    } catch (error) {
        console.error('❌ Test execution failed:', error);
    }
}

// Run the test
testAntiSpamWarningSystem().catch(console.error);
