// Test User V2 Authentication System
// Usage: node test-auth-v2.js

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3005/actlog';

// Test data
const testUser = {
    organization_id: null, // Will be filled from API
    department_id: null,
    username: 'auth_test_user_' + Date.now(),
    password: 'TestPass123!',
    full_name: 'Authentication Test User',
    email: 'auth_test@example.com',
    phone: '0987654321'
};

async function testAuthSystem() {
    console.log('🔐 Testing User V2 Authentication System...\n');

    try {
        // Step 1: Get organizations
        console.log('1️⃣ Getting organizations...');
        const orgsResponse = await fetch(`${BASE_URL}/organizations`);
        const orgsData = await orgsResponse.json();
        
        if (orgsData.success && orgsData.data.length > 0) {
            testUser.organization_id = orgsData.data[0].id;
            console.log('✅ Using organization:', orgsData.data[0].name);
        } else {
            console.log('⚠️  No organizations found, proceeding without organization...');
        }

        // Step 2: Create User V2 with bcrypt password
        console.log('\n2️⃣ Creating User V2 (with bcrypt)...');
        const createResponse = await fetch(`${BASE_URL}/v2/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testUser)
        });
        const createData = await createResponse.json();
        
        if (createData.success) {
            console.log('✅ User V2 created successfully');
            console.log('User data:', JSON.stringify(createData.data, null, 2));
        } else {
            console.log('❌ Failed to create user:', createData.message);
            return;
        }

        // Step 3: Login User V2
        console.log('\n3️⃣ Testing login...');
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
            console.log('✅ Login successful');
            console.log('Token generated:', loginData.data.token ? 'Yes' : 'No');
            console.log('User info:', JSON.stringify(loginData.data.user, null, 2));
        } else {
            console.log('❌ Login failed:', loginData.message);
            return;
        }

        const token = loginData.data.token;

        // Step 4: Test token authentication
        console.log('\n4️⃣ Testing token authentication...');
        const authResponse = await fetch(`${BASE_URL}/auth/test`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const authData = await authResponse.json();
        
        if (authData.success) {
            console.log('✅ Token authentication successful');
            console.log('Authenticated user data:');
            console.log('- Table:', authData.user.table);
            console.log('- Username:', authData.user.username);
            console.log('- Full name:', authData.user.full_name);
            console.log('- Role:', authData.user.role);
            console.log('- Organization:', authData.user.organization_name || 'N/A');
        } else {
            console.log('❌ Token authentication failed:', authData.message);
            return;
        }

        // Step 5: Test wrong password
        console.log('\n5️⃣ Testing wrong password...');
        const wrongPasswordResponse = await fetch(`${BASE_URL}/v2/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: testUser.username,
                password: 'WrongPassword123!'
            })
        });
        const wrongPasswordData = await wrongPasswordResponse.json();
        
        if (!wrongPasswordData.success) {
            console.log('✅ Wrong password correctly rejected:', wrongPasswordData.message);
        } else {
            console.log('❌ Security issue: Wrong password was accepted!');
        }

        // Step 6: Test device creation with V2 user
        console.log('\n6️⃣ Testing device creation with V2 authentication...');
        
        // Get device models first
        const modelsResponse = await fetch(`${BASE_URL}/devices/device-models`);
        const modelsData = await modelsResponse.json();
        
        if (modelsData.success && modelsData.data.length > 0) {
            const testDevice = {
                model_id: modelsData.data[0].id,
                organization_id: testUser.organization_id,
                serial_number: 'TEST_V2_' + Date.now(),
                asset_tag: 'ASSET_V2_' + Date.now(),
                status: 'active'
            };

            const deviceResponse = await fetch(`${BASE_URL}/devices/devices`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(testDevice)
            });
            const deviceData = await deviceResponse.json();
            
            if (deviceData.success) {
                console.log('✅ Device created successfully with V2 authentication');
                console.log('Device ID:', deviceData.data.id);
            } else {
                console.log('❌ Device creation failed:', deviceData.message);
            }
        } else {
            console.log('⚠️  No device models found, skipping device creation test');
        }

        console.log('\n🎉 Authentication system test completed!');

    } catch (error) {
        console.error('❌ Test error:', error.message);
    }
}

// Run test
testAuthSystem();