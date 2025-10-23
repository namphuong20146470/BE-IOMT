import axios from 'axios';

// Simple specification endpoint tests
const BASE_URL = 'http://localhost:3030';

// Get auth token first
async function getAuthToken() {
    try {
        const response = await axios.post(`${BASE_URL}/auth/login`, {
            username: 'superadmin',
            password: 'SuperAdmin@2025'
        });
        return response.data.data.tokens.access_token;
    } catch (error) {
        console.error('Authentication failed:', error.response?.data);
        process.exit(1);
    }
}

async function testEndpoints() {
    console.log('🧪 TESTING SPECIFICATION ENDPOINTS');
    console.log('==================================');
    
    const token = await getAuthToken();
    const headers = { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    // 1. Test GET field templates
    console.log('\n1️⃣  GET /specifications/fields/templates');
    try {
        const response = await axios.get(`${BASE_URL}/specifications/fields/templates`, { headers });
        console.log('✅ Success:', response.data.message);
        console.log('📊 Data count:', response.data.data?.length || 0);
    } catch (error) {
        console.log('❌ Error:', error.response?.data);
    }

    // 2. Test CREATE field template
    console.log('\n2️⃣  PUT /specifications/fields/templates (CREATE)');
    const newField = {
        field_name: 'test_battery_capacity',
        field_name_vi: 'Dung lượng pin',
        field_name_en: 'Battery Capacity',
        unit: 'mAh',
        category: 'power',
        data_type: 'numeric',
        placeholder: 'Nhập dung lượng pin',
        help_text: 'Dung lượng pin tính bằng mAh',
        sort_order: 10
    };

    try {
        const response = await axios.put(`${BASE_URL}/specifications/fields/templates`, newField, { headers });
        console.log('✅ Success:', response.data.message);
        console.log('📝 Created field:', response.data.data.field_name);
    } catch (error) {
        console.log('❌ Error:', error.response?.data);
    }

    // 3. Test GET with search
    console.log('\n3️⃣  GET /specifications/fields/templates?search=pin');
    try {
        const response = await axios.get(`${BASE_URL}/specifications/fields/templates?search=pin`, { headers });
        console.log('✅ Search success, found:', response.data.data?.length || 0, 'results');
    } catch (error) {
        console.log('❌ Search error:', error.response?.data);
    }

    // 4. Get device model for testing
    let deviceModelId = null;
    console.log('\n4️⃣  Getting device model for testing...');
    try {
        const response = await axios.get(`${BASE_URL}/devices/device-models`, { headers });
        if (response.data.data?.length > 0) {
            deviceModelId = response.data.data[0].id;
            console.log('✅ Using device model:', deviceModelId);
        }
    } catch (error) {
        console.log('❌ Could not get device model:', error.response?.data);
    }

    // 5. Test model specifications
    if (deviceModelId) {
        console.log('\n5️⃣  PUT /specifications/models/:id (CREATE specifications)');
        const specifications = {
            specifications: [
                {
                    field_name: 'test_battery_capacity',
                    field_name_vi: 'Dung lượng pin',
                    value: '5000',
                    unit: 'mAh',
                    description: 'Pin lithium-ion dung lượng cao',
                    display_order: 1
                },
                {
                    field_name: 'test_screen_size',
                    field_name_vi: 'Kích thước màn hình',
                    value: '15.6',
                    unit: 'inch',
                    description: 'Màn hình LCD IPS',
                    display_order: 2
                }
            ]
        };

        try {
            const response = await axios.put(`${BASE_URL}/specifications/models/${deviceModelId}`, specifications, { headers });
            console.log('✅ Success:', response.data.message);
            console.log('📊 Updated count:', response.data.data.updated_count);
        } catch (error) {
            console.log('❌ Error:', error.response?.data);
        }

        // 6. Test GET model specifications
        console.log('\n6️⃣  GET /specifications/models/:id');
        try {
            const response = await axios.get(`${BASE_URL}/specifications/models/${deviceModelId}`, { headers });
            console.log('✅ Success, found:', response.data.data?.length || 0, 'specifications');
        } catch (error) {
            console.log('❌ Error:', error.response?.data);
        }
    }

    // 7. Test categories
    console.log('\n7️⃣  GET /specifications/categories');
    try {
        const response = await axios.get(`${BASE_URL}/specifications/categories`, { headers });
        console.log('✅ Success:', response.data.data);
    } catch (error) {
        console.log('❌ Error:', error.response?.data);
    }

    // 8. Test statistics
    console.log('\n8️⃣  GET /specifications/stats');
    try {
        const response = await axios.get(`${BASE_URL}/specifications/stats`, { headers });
        console.log('✅ Success: Field usage count =', response.data.data.field_usage?.length || 0);
        console.log('         Unit usage count =', response.data.data.unit_usage?.length || 0);
    } catch (error) {
        console.log('❌ Error:', error.response?.data);
    }

    // 9. Test validation error
    console.log('\n9️⃣  Testing validation (missing field_name_vi)');
    try {
        const invalidField = {
            field_name: 'invalid_test'
            // Missing required field_name_vi
        };
        const response = await axios.put(`${BASE_URL}/specifications/fields/templates`, invalidField, { headers });
        console.log('⚠️  Should have failed:', response.data);
    } catch (error) {
        console.log('✅ Validation error caught correctly:', error.response?.data?.message);
    }

    console.log('\n🎉 All endpoint tests completed!');
}

// Run the tests
testEndpoints().catch(console.error);