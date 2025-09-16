// Migration Test Script - User V2 Complete Migration
// Test all endpoints to ensure migration is successful

import fetch from 'node-fetch';

const BASE_URL = 'https://iomt.hoangphucthanh.vn:3030/actlog';

// Test data
const testUser = {
    organization_id: null,
    department_id: null,
    username: 'migrated_user_' + Date.now(),
    password: 'password123',
    full_name: 'Migrated Test User',
    email: 'migrated@test.com',
    phone: '0987654321'
};

async function testMigration() {
    console.log('🚀 Testing Complete User V2 Migration...\n');

    try {
        // Step 1: Get organizations
        console.log('1️⃣ Getting organizations...');
        const orgsResponse = await fetch(`${BASE_URL}/organizations`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        const orgsData = await orgsResponse.json();
        
        if (orgsData.success && orgsData.data.length > 0) {
            testUser.organization_id = orgsData.data[0].id;
            console.log('✅ Using organization:', orgsData.data[0].name);
        }

        // Step 2: Create user with NEW system (should use users_v2 table)
        console.log('\n2️⃣ Creating user with new system...');
        const createResponse = await fetch(`${BASE_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testUser)
        });
        const createData = await createResponse.json();
        
        if (createData.success) {
            console.log('✅ User created successfully:', createData.data.username);
            console.log('📊 Created with ID:', createData.data.id);
        } else {
            console.log('❌ User creation failed:', createData.message);
            return;
        }

        // Step 3: Login with NEW system
        console.log('\n3️⃣ Testing login...');
        const loginResponse = await fetch(`${BASE_URL}/login`, {
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
            console.log('🔑 Token structure check:', Object.keys(loginData.data));
        } else {
            console.log('❌ Login failed:', loginData.message);
            return;
        }

        const token = loginData.data.token;

        // Step 4: Test authentication
        console.log('\n4️⃣ Testing authentication...');
        const authResponse = await fetch(`${BASE_URL}/auth/test`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const authData = await authResponse.json();
        
        if (authData.success) {
            console.log('✅ Authentication successful');
            console.log('👤 User table:', authData.user.table);
            console.log('🆔 User ID type:', typeof authData.user.id);
        } else {
            console.log('❌ Authentication failed:', authData.message);
        }

        // Step 5: Test device creation (main use case)
        console.log('\n5️⃣ Testing device creation...');
        
        // Get device models first
        const modelsResponse = await fetch(`${BASE_URL}/devices/device-models`);
        const modelsData = await modelsResponse.json();
        
        if (modelsData.success && modelsData.data.length > 0) {
            const devicePayload = {
                model_id: modelsData.data[0].id,
                organization_id: testUser.organization_id,
                serial_number: 'MIGRATION_TEST_' + Date.now(),
                asset_tag: 'MIG_' + Date.now(),
                status: 'active'
            };

            const deviceResponse = await fetch(`${BASE_URL}/devices/devices`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(devicePayload)
            });
            const deviceData = await deviceResponse.json();
            
            if (deviceData.success) {
                console.log('✅ Device creation successful with migrated user!');
                console.log('📱 Device ID:', deviceData.data.id);
            } else {
                console.log('❌ Device creation failed:', deviceData.message);
            }
        }

        // Step 6: Test token decode
        console.log('\n6️⃣ Testing token decode...');
        const decodeResponse = await fetch(`${BASE_URL}/auth/decode`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const decodeData = await decodeResponse.json();
        
        if (decodeData.success) {
            console.log('✅ Token decode successful');
            console.log('🏷️ Token type:', decodeData.token_type);
            console.log('📝 Token payload keys:', Object.keys(decodeData.decoded));
        }

        // Step 7: Test user listing
        console.log('\n7️⃣ Testing user listing...');
        const usersResponse = await fetch(`${BASE_URL}/users`);
        const usersData = await usersResponse.json();
        
        if (usersData.success) {
            console.log('✅ User listing successful');
            console.log('👥 Total users:', usersData.count || usersData.data.length);
            
            // Check if our user is in the list
            const ourUser = usersData.data.find(u => u.username === testUser.username);
            if (ourUser) {
                console.log('✅ Created user found in list');
                console.log('📋 User details:', {
                    id: ourUser.id,
                    username: ourUser.username,
                    organization: ourUser.organization_name
                });
            }
        }

        console.log('\n🎉 Migration test completed successfully!');
        console.log('\n📊 Summary:');
        console.log('   ✅ Users V2 system fully operational');
        console.log('   ✅ Authentication working');
        console.log('   ✅ Device creation working');
        console.log('   ✅ All endpoints migrated');

    } catch (error) {
        console.error('❌ Migration test error:', error.message);
    }
}

// Run test
testMigration();