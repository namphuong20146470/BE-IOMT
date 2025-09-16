// Test script for User V2 device creation
// Usage: node test-user-v2-device.js

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3005/actlog';

// Test data
const testUser = {
    organization_id: null, // Thay bằng ID organization thực tế
    department_id: null,   // Thay bằng ID department thực tế (optional)
    username: 'testuser_device_v2',
    password: 'password123',
    full_name: 'Test User For Device V2',
    email: 'testuser_device_v2@test.com',
    phone: '0123456789'
};

const testDevice = {
    model_id: null,        // Thay bằng ID model thực tế
    organization_id: null, // Thay bằng ID organization thực tế
    department_id: null,   // Thay bằng ID department thực tế (optional)
    serial_number: 'TEST_DEVICE_V2_' + Date.now(),
    asset_tag: 'ASSET_V2_' + Date.now(),
    status: 'active',
    purchase_date: '2025-01-01',
    installation_date: '2025-01-15'
};

async function test() {
    console.log('🚀 Testing User V2 Device Creation Flow...\n');

    try {
        // Step 1: Get organizations for reference
        console.log('1️⃣ Getting organizations...');
        const orgsResponse = await fetch(`${BASE_URL}/organizations`);
        const orgsData = await orgsResponse.json();
        
        if (orgsData.success && orgsData.data.length > 0) {
            testUser.organization_id = orgsData.data[0].id;
            testDevice.organization_id = orgsData.data[0].id;
            console.log('✅ Using organization:', orgsData.data[0].name, '(ID:', orgsData.data[0].id, ')');
        } else {
            console.log('❌ No organizations found. Create one first.');
            return;
        }

        // Step 2: Get device models for reference
        console.log('\n2️⃣ Getting device models...');
        const modelsResponse = await fetch(`${BASE_URL}/devices/device-models`);
        const modelsData = await modelsResponse.json();
        
        if (modelsData.success && modelsData.data.length > 0) {
            testDevice.model_id = modelsData.data[0].id;
            console.log('✅ Using device model:', modelsData.data[0].name, '(ID:', modelsData.data[0].id, ')');
        } else {
            console.log('❌ No device models found. Create one first.');
            return;
        }

        // Step 3: Create User V2
        console.log('\n3️⃣ Creating User V2...');
        const createUserResponse = await fetch(`${BASE_URL}/v2/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testUser)
        });
        const userData = await createUserResponse.json();
        
        if (userData.success) {
            console.log('✅ User V2 created:', userData.data.username);
        } else {
            console.log('❌ Failed to create User V2:', userData.message);
            return;
        }

        // Step 4: Login User V2
        console.log('\n4️⃣ Logging in User V2...');
        const loginResponse = await fetch(`${BASE_URL}/v2/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: testUser.username,
                password: testUser.password
            })
        });
        const loginData = await loginResponse.json();
        
        if (loginData.success) {
            console.log('✅ Login successful. Token received.');
            console.log('User info:', JSON.stringify(loginData.data.user, null, 2));
        } else {
            console.log('❌ Login failed:', loginData.message);
            return;
        }

        const token = loginData.data.token;

        // Step 5: Test token with auth middleware
        console.log('\n5️⃣ Testing token authentication...');
        const authTestResponse = await fetch(`${BASE_URL}/auth/test`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const authTestData = await authTestResponse.json();
        
        if (authTestData.success) {
            console.log('✅ Token authentication successful');
            console.log('Authenticated user:', JSON.stringify(authTestData.user, null, 2));
        } else {
            console.log('❌ Token authentication failed:', authTestData.message);
            return;
        }

        // Step 6: Create device using authenticated User V2
        console.log('\n6️⃣ Creating device with User V2 authentication...');
        const createDeviceResponse = await fetch(`${BASE_URL}/devices/devices`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(testDevice)
        });
        const deviceData = await createDeviceResponse.json();
        
        if (deviceData.success) {
            console.log('✅ Device created successfully!');
            console.log('Device info:', JSON.stringify(deviceData.data, null, 2));
        } else {
            console.log('❌ Device creation failed:', deviceData.message);
            if (deviceData.error) {
                console.log('Error details:', deviceData.error);
            }
        }

        console.log('\n🎉 Test completed!');

    } catch (error) {
        console.error('❌ Test error:', error.message);
    }
}

// Run test
test();